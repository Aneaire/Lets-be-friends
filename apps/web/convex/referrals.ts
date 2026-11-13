import { ConvexError, v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import { getViewer, requireViewer, writeAudit } from './lib'
import {
  REFERRAL_REWARD_BPS,
  REFERRAL_TERMS_VERSION,
  normalizeReferralCode,
  referralCodeValidationError,
  referralRewardBpsFor,
} from '@lets-be-friends/shared'
import {
  getReferralProgram,
  getReferralSummary,
  incrementReferralSummary,
  recordReferralFraudSignal,
  requireActiveReferralProgram,
} from './referralProgram'

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const REFERRAL_CODE_LENGTH = 8
const VOLUME_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000
const VOLUME_THRESHOLD = 5
const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000

function randomReferralCode() {
  let code = ''
  for (let index = 0; index < REFERRAL_CODE_LENGTH; index += 1) {
    code += REFERRAL_ALPHABET[Math.floor(Math.random() * REFERRAL_ALPHABET.length)]
  }
  return code
}

async function firstBookingForMember(ctx: { db: any }, userId: any) {
  return await ctx.db.query('bookings')
    .withIndex('by_member', (q: any) => q.eq('memberId', userId))
    .first()
}

/** Keeps device history even when push notifications are disabled. */
async function recordUserDevice(
  ctx: { db: any },
  userId: any,
  installationId: string | undefined,
  now: number,
) {
  if (!installationId) return
  const existing = await ctx.db.query('userDevices')
    .withIndex('by_user_installation', (q: any) => q.eq('userId', userId).eq('installationId', installationId))
    .unique()
  if (existing) {
    await ctx.db.patch(existing._id, { lastSeenAt: now })
    return
  }
  await ctx.db.insert('userDevices', {
    userId,
    installationId,
    firstSeenAt: now,
    lastSeenAt: now,
  })
}

async function recordAttributionSignals(
  ctx: { db: any },
  referral: { _id: any; referrerUserId: any; referredUserId: any; code: string },
  now: number,
  referredDeviceId?: string,
) {
  const [referrerHistory, referredHistory, referrerPush, referredPush, recentReferrals, codeRow] = await Promise.all([
    ctx.db.query('userDevices')
      .withIndex('by_user', (q: any) => q.eq('userId', referral.referrerUserId))
      .collect(),
    ctx.db.query('userDevices')
      .withIndex('by_user', (q: any) => q.eq('userId', referral.referredUserId))
      .collect(),
    ctx.db.query('pushDevices')
      .withIndex('by_user_enabled', (q: any) => q.eq('userId', referral.referrerUserId))
      .collect(),
    ctx.db.query('pushDevices')
      .withIndex('by_user_enabled', (q: any) => q.eq('userId', referral.referredUserId))
      .collect(),
    // The referral was inserted before this check, so the current row is included.
    ctx.db.query('referrals')
      .withIndex('by_referrer_created_at', (q: any) => q.eq('referrerUserId', referral.referrerUserId).gte('createdAt', now - VOLUME_WINDOW_MS))
      .collect(),
    ctx.db.query('referralCodes').withIndex('by_code', (q: any) => q.eq('code', referral.code)).unique(),
  ])
  const referrerInstallations = new Set<string>(
    [...referrerHistory, ...referrerPush]
      .map((device: any) => device.installationId)
      .filter(Boolean),
  )
  if (codeRow?.deviceId) referrerInstallations.add(codeRow.deviceId)
  const referredInstallations = [...referredHistory, ...referredPush]
    .map((device: any) => device.installationId)
    .filter(Boolean)
  if (referredDeviceId) referredInstallations.push(referredDeviceId)
  if (referredInstallations.some((installationId) => referrerInstallations.has(installationId))) {
    await recordReferralFraudSignal(ctx, referral, 'same_device', 'The referrer and the invited friend share a device.')
  }
  if (recentReferrals.length >= VOLUME_THRESHOLD) {
    await recordReferralFraudSignal(ctx, referral, 'referral_volume', `${recentReferrals.length} referrals in seven days.`)
  }
}

export const myReferral = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return null

    const [code, referredByRow, firstBooking, program, wallet, summary, recentRewardRows, referralSamples] = await Promise.all([
      ctx.db.query('referralCodes').withIndex('by_owner', (q) => q.eq('ownerUserId', viewer._id)).first(),
      ctx.db.query('referrals').withIndex('by_referred', (q) => q.eq('referredUserId', viewer._id)).first(),
      firstBookingForMember(ctx, viewer._id),
      getReferralProgram(ctx),
      ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${viewer._id}:booking`))
        .unique(),
      getReferralSummary(ctx, viewer._id),
      ctx.db.query('referralRewards')
        .withIndex('by_referrer_created_at', (q) => q.eq('referrerUserId', viewer._id))
        .order('desc')
        .take(3),
      ctx.db.query('referrals')
        .withIndex('by_referrer', (q) => q.eq('referrerUserId', viewer._id))
        .take(100),
    ])

    let totals = summary
    if (!totals) {
      // Legacy accounts without a summary row get a one-time bounded fallback.
      // Run the summary migration to move them to the counter path.
      const [referralRows, rewardRows] = await Promise.all([
        ctx.db.query('referrals').withIndex('by_referrer', (q) => q.eq('referrerUserId', viewer._id)).take(500),
        ctx.db.query('referralRewards').withIndex('by_referrer', (q) => q.eq('referrerUserId', viewer._id)).take(500),
      ])
      totals = {
        totalReferrals: referralRows.length,
        totalRewardedBookings: referralRows.reduce((total: number, referral: any) => total + referral.rewardedBookings, 0),
        totalEarnedCentavos: rewardRows
          .filter((reward: any) => reward.status === 'credited')
          .reduce((total: number, reward: any) => total + reward.amountCentavos, 0),
        totalPendingCentavos: rewardRows
          .filter((reward: any) => reward.status === 'pending')
          .reduce((total: number, reward: any) => total + reward.amountCentavos, 0),
        totalReversedCentavos: rewardRows
          .filter((reward: any) => reward.status === 'reversed')
          .reduce((total: number, reward: any) => total + reward.amountCentavos, 0),
      }
    }
    const referredByUser = referredByRow ? await ctx.db.get(referredByRow.referrerUserId) : null
    const referralById = new Map(referralSamples.map((referral) => [String(referral._id), referral]))
    const unrewardedSamples = referralSamples.filter((referral) => referral.rewardedBookings === 0)
    const bonusEligible = totals.totalReferrals === 0
      || unrewardedSamples.some((referral) => (
        referral.termsVersion === REFERRAL_TERMS_VERSION
        || referral.rewardBps === REFERRAL_REWARD_BPS
      ))

    return {
      code: code?.code ?? null,
      programActive: program.active,
      launchBonusActive: program.launchBonusActive,
      launchBonusCentavos: program.launchBonusCentavos,
      launchBonusClaims: program.launchBonusClaims,
      launchBonusMaxClaims: program.launchBonusMaxClaims,
      launchBonusAvailable: Boolean(
        program.active
        && program.launchBonusActive
        && program.launchBonusCentavos > 0
        && program.launchBonusClaims < program.launchBonusMaxClaims
        && bonusEligible,
      ),
      totalReferrals: totals.totalReferrals,
      totalRewardedBookings: totals.totalRewardedBookings,
      totalEarnedCentavos: totals.totalEarnedCentavos,
      totalPendingCentavos: totals.totalPendingCentavos,
      totalReversedCentavos: totals.totalReversedCentavos,
      referralCreditAvailableCentavos: wallet?.referralCreditCentavos ?? 0,
      referralDebtCentavos: wallet?.referralDebtCentavos ?? 0,
      recentRewards: recentRewardRows.map((reward: any) => ({
        _id: reward._id,
        bookingId: reward.bookingId,
        kind: reward.kind ?? 'lifetime',
        amountCentavos: reward.amountCentavos,
        rewardBps: reward.rewardBps
          ?? referralRewardBpsFor(referralById.get(String(reward.referralId)) ?? { rewardedBookings: 0 }),
        status: reward.status,
        reviewRequired: reward.reviewRequired === true,
        createdAt: reward.createdAt,
        releasedAt: reward.releasedAt ?? null,
      })),
      promptDismissedAt: viewer.referralPromptDismissedAt ?? null,
      canAddReferralCode: Boolean(
        program.active
        && !referredByRow
        && !firstBooking
        && !viewer.suspended
        && viewer.createdAt >= Date.now() - ATTRIBUTION_WINDOW_MS,
      ),
      referredBy: referredByRow
        ? {
            referrerDisplayName: referredByUser?.displayName ?? 'A friend',
            code: referredByRow.code,
            rewardedBookings: referredByRow.rewardedBookings,
            termsVersion: referredByRow.termsVersion ?? null,
          }
        : null,
    }
  },
})

export const myReferralPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return { page: [], isDone: true, continueCursor: '' }

    const result = await ctx.db.query('referrals')
      .withIndex('by_referrer_created_at', (q) => q.eq('referrerUserId', viewer._id))
      .order('desc')
      .paginate(args.paginationOpts)
    const referredUsers = await Promise.all(
      result.page.map((referral) => ctx.db.get(referral.referredUserId)),
    )

    return {
      ...result,
      page: result.page.map((referral, index) => ({
        _id: referral._id,
        referredDisplayName: referredUsers[index]?.displayName ?? 'Friend',
        // Older rows were marked completed when the program capped rewards at
        // three bookings. Lifetime referrals are always active.
        status: referral.status === 'completed' ? 'active' : referral.status,
        rewardedBookings: referral.rewardedBookings,
        termsVersion: referral.termsVersion ?? 'legacy_68_3',
        createdAt: referral.createdAt,
      })),
    }
  },
})

export const myReferralRewards = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return { page: [], isDone: true, continueCursor: '' }
    const result = await ctx.db.query('referralRewards')
      .withIndex('by_referrer_created_at', (q) => q.eq('referrerUserId', viewer._id))
      .order('desc')
      .paginate(args.paginationOpts)
    const referredUsers = await Promise.all(
      result.page.map((reward) => ctx.db.get(reward.referredUserId)),
    )
    const referrals = await Promise.all(
      result.page.map((reward) => ctx.db.get(reward.referralId)),
    )
    return {
      ...result,
      page: result.page.map((reward, index) => ({
        _id: reward._id,
        bookingId: reward.bookingId,
        kind: reward.kind ?? 'lifetime',
        amountCentavos: reward.amountCentavos,
        rewardBps: reward.rewardBps
          ?? referralRewardBpsFor(referrals[index] ?? { rewardedBookings: 0 }),
        status: reward.status,
        reviewRequired: reward.reviewRequired === true,
        createdAt: reward.createdAt,
        releasedAt: reward.releasedAt ?? null,
        referredDisplayName: referredUsers[index]?.displayName ?? 'Friend',
      })),
    }
  },
})

export const programStatus = query({
  args: {},
  handler: async (ctx) => await getReferralProgram(ctx),
})

export const ensureReferralCode = mutation({
  args: { deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (viewer.suspended) throw new ConvexError('Account is suspended')
    await requireActiveReferralProgram(ctx)
    const now = Date.now()
    await recordUserDevice(ctx, viewer._id, args.deviceId, now)
    const existing = await ctx.db.query('referralCodes').withIndex('by_owner', (q) => q.eq('ownerUserId', viewer._id)).first()
    if (existing) {
      if (!existing.deviceId && args.deviceId) {
        await ctx.db.patch(existing._id, { deviceId: args.deviceId })
      }
      return { code: existing.code }
    }

    let code: string | null = null
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = randomReferralCode()
      const collision = await ctx.db.query('referralCodes').withIndex('by_code', (q) => q.eq('code', candidate)).unique()
      if (!collision) {
        code = candidate
        break
      }
    }
    if (!code) throw new ConvexError('Could not create a referral code. Please try again.')

    await ctx.db.insert('referralCodes', {
      ownerUserId: viewer._id,
      code,
      termsVersion: REFERRAL_TERMS_VERSION,
      rewardBps: REFERRAL_REWARD_BPS,
      deviceId: args.deviceId,
      createdAt: Date.now(),
    })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'referral.code_created',
      targetType: 'referralCode',
      targetId: code,
      after: { termsVersion: REFERRAL_TERMS_VERSION, rewardBps: REFERRAL_REWARD_BPS },
    })
    return { code }
  },
})

export const attributeReferral = mutation({
  args: { code: v.string(), deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (viewer.suspended) throw new ConvexError('Account is suspended')
    await requireActiveReferralProgram(ctx)

    const code = normalizeReferralCode(args.code)
    const validationError = referralCodeValidationError(code)
    if (validationError) throw new ConvexError(validationError)

    const referralCode = await ctx.db.query('referralCodes').withIndex('by_code', (q) => q.eq('code', code)).unique()
    if (!referralCode) throw new ConvexError('That referral code was not found.')
    if (referralCode.ownerUserId === viewer._id) throw new ConvexError('You cannot use your own referral code.')

    const referrer = await ctx.db.get(referralCode.ownerUserId)
    if (!referrer || referrer.suspended) throw new ConvexError('That referral code is not available.')

    const existing = await ctx.db.query('referrals').withIndex('by_referred', (q) => q.eq('referredUserId', viewer._id)).first()
    if (existing) throw new ConvexError('A referral is already linked to this account.')

    const firstBooking = await firstBookingForMember(ctx, viewer._id)
    if (firstBooking) throw new ConvexError('Referral codes can only be added before your first booking.')
    if (viewer.createdAt < Date.now() - ATTRIBUTION_WINDOW_MS) {
      throw new ConvexError('Referral codes can only be added within 30 days of joining.')
    }

    const now = Date.now()
    await recordUserDevice(ctx, viewer._id, args.deviceId, now)
    const termsVersion = referralCode.termsVersion ?? REFERRAL_TERMS_VERSION
    const rewardBps = referralCode.rewardBps ?? REFERRAL_REWARD_BPS
    const referralId = await ctx.db.insert('referrals', {
      referrerUserId: referralCode.ownerUserId,
      referredUserId: viewer._id,
      code,
      status: 'active',
      rewardedBookings: 0,
      termsVersion,
      rewardBps,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(viewer._id, {
      referralPromptDismissedAt: viewer.referralPromptDismissedAt ?? now,
      updatedAt: now,
    })
    await incrementReferralSummary(ctx, referralCode.ownerUserId, { totalReferrals: 1 }, now)
    await recordAttributionSignals(ctx, {
      _id: referralId,
      referrerUserId: referralCode.ownerUserId,
      referredUserId: viewer._id,
      code,
    }, now, args.deviceId)
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'referral.attributed',
      targetType: 'referral',
      targetId: String(referralId),
      after: { code, referrerUserId: String(referralCode.ownerUserId), termsVersion, rewardBps },
    })
    return { referralId, termsVersion, rewardBps }
  },
})

export const dismissReferralPrompt = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    if (viewer.referralPromptDismissedAt) return { dismissedAt: viewer.referralPromptDismissedAt }
    const now = Date.now()
    await ctx.db.patch(viewer._id, {
      referralPromptDismissedAt: now,
      updatedAt: now,
    })
    return { dismissedAt: now }
  },
})
