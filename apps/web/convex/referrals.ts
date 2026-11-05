import { ConvexError, v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import { getViewer, requireViewer, writeAudit } from './lib'
import {
  normalizeReferralCode,
  referralCodeValidationError,
  REFERRAL_REWARDED_BOOKINGS,
} from '@lets-be-friends/shared'

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const REFERRAL_CODE_LENGTH = 8

function randomReferralCode() {
  let code = ''
  for (let index = 0; index < REFERRAL_CODE_LENGTH; index += 1) {
    code += REFERRAL_ALPHABET[Math.floor(Math.random() * REFERRAL_ALPHABET.length)]
  }
  return code
}

export const myReferral = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return null

    const [code, referralRows, recentReferrals, rewardRows, referredByRow] = await Promise.all([
      ctx.db.query('referralCodes').withIndex('by_owner', (q) => q.eq('ownerUserId', viewer._id)).first(),
      ctx.db.query('referrals').withIndex('by_referrer', (q) => q.eq('referrerUserId', viewer._id)).collect(),
      ctx.db.query('referrals')
        .withIndex('by_referrer_created_at', (q) => q.eq('referrerUserId', viewer._id))
        .order('desc')
        .take(3),
      ctx.db.query('referralRewards').withIndex('by_referrer', (q) => q.eq('referrerUserId', viewer._id)).collect(),
      ctx.db.query('referrals').withIndex('by_referred', (q) => q.eq('referredUserId', viewer._id)).first(),
    ])

    const rewards = rewardRows
      .slice()
      .sort((left, right) => right.createdAt - left.createdAt)
    const [referredUsers, referredByUser] = await Promise.all([
      Promise.all(recentReferrals.map((referral) => ctx.db.get(referral.referredUserId))),
      referredByRow ? ctx.db.get(referredByRow.referrerUserId) : Promise.resolve(null),
    ])

    return {
      code: code?.code ?? null,
      referrals: recentReferrals.map((referral, index) => ({
        _id: referral._id,
        referredDisplayName: referredUsers[index]?.displayName ?? 'Friend',
        status: referral.status,
        rewardedBookings: referral.rewardedBookings,
        totalRewardedBookings: REFERRAL_REWARDED_BOOKINGS,
        createdAt: referral.createdAt,
      })),
      totalReferrals: referralRows.length,
      totalRewardedBookings: rewards.filter((reward) => reward.status === 'credited').length,
      rewards: rewards.map((reward) => ({
        _id: reward._id,
        bookingId: reward.bookingId,
        amountCentavos: reward.amountCentavos,
        status: reward.status,
        createdAt: reward.createdAt,
      })),
      totalEarnedCentavos: rewards
        .filter((reward) => reward.status === 'credited')
        .reduce((total, reward) => total + reward.amountCentavos, 0),
      totalReversedCentavos: rewards
        .filter((reward) => reward.status === 'reversed')
        .reduce((total, reward) => total + reward.amountCentavos, 0),
      promptDismissedAt: viewer.referralPromptDismissedAt ?? null,
      referredBy: referredByRow
        ? {
            referrerDisplayName: referredByUser?.displayName ?? 'A friend',
            code: referredByRow.code,
            rewardedBookings: referredByRow.rewardedBookings,
            totalRewardedBookings: REFERRAL_REWARDED_BOOKINGS,
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
        status: referral.status,
        rewardedBookings: referral.rewardedBookings,
        totalRewardedBookings: REFERRAL_REWARDED_BOOKINGS,
        createdAt: referral.createdAt,
      })),
    }
  },
})

export const ensureReferralCode = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    if (viewer.suspended) throw new ConvexError('Account is suspended')
    const existing = await ctx.db.query('referralCodes').withIndex('by_owner', (q) => q.eq('ownerUserId', viewer._id)).first()
    if (existing) return { code: existing.code }

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
      createdAt: Date.now(),
    })
    return { code }
  },
})

export const attributeReferral = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (viewer.suspended) throw new ConvexError('Account is suspended')

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

    const firstBooking = await ctx.db.query('bookings').withIndex('by_member', (q) => q.eq('memberId', viewer._id)).first()
    if (firstBooking) throw new ConvexError('Referral codes can only be added before your first booking.')

    const now = Date.now()
    const referralId = await ctx.db.insert('referrals', {
      referrerUserId: referralCode.ownerUserId,
      referredUserId: viewer._id,
      code,
      status: 'active',
      rewardedBookings: 0,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(viewer._id, {
      referralPromptDismissedAt: viewer.referralPromptDismissedAt ?? now,
      updatedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'referral.attributed',
      targetType: 'referral',
      targetId: String(referralId),
      after: { code, referrerUserId: String(referralCode.ownerUserId) },
    })
    return { referralId }
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
