import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { REFERRAL_REWARD_HOLD_MS } from '@lets-be-friends/shared'
import { api, internal } from '../../../convex/_generated/api'
import { applyWalletTransaction, reverseReferralRewardForBooking } from '../../../convex/finance'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
const SUBTOTAL = 50_000
const FEE = 7_500
const TOTAL = 57_500
const REWARD = 2_500

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

async function seed(t: ReturnType<typeof createTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const identity = {
      verificationStatus: 'approved' as const,
      verificationSource: 'persona' as const,
      identityVerifiedAt: now,
      identityExpiresAt: now + 86_400_000,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    }
    const referrerId = await ctx.db.insert('users', {
      clerkUserId: 'referral-referrer', displayName: 'Referral Referrer', role: 'member', ...identity,
    })
    const memberId = await ctx.db.insert('users', {
      clerkUserId: 'referral-member', displayName: 'Referral Member', role: 'member', ...identity,
    })
    const companionUserId = await ctx.db.insert('users', {
      clerkUserId: 'referral-companion', displayName: 'Referral Companion', role: 'companion', ...identity,
    })
    const adminUserId = await ctx.db.insert('users', {
      clerkUserId: 'referral-admin', displayName: 'Referral Admin', role: 'admin', ...identity,
    })
    await ctx.db.insert('referralProgram', {
      key: 'referrals',
      active: true,
      launchBonusCentavos: 5_000,
      launchBonusMaxClaims: 100,
      launchBonusClaims: 0,
      launchBonusActive: true,
      updatedAt: now,
    })
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Referral Companion',
      intro: 'A verified Companion for referral settlement tests.',
      city: 'Test City',
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: SUBTOTAL,
      status: 'approved',
      rating: 5,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    return { now, referrerId, memberId, companionUserId, adminUserId, companionProfileId }
  })
}

async function insertReferral(
  t: ReturnType<typeof createTest>,
  ids: Awaited<ReturnType<typeof seed>>,
  options: {
    referrerId?: any
    code?: string
    status?: 'active' | 'completed' | 'reversed'
    rewardedBookings?: number
    termsVersion?: string | null
    rewardBps?: number | null
  } = {},
) {
  return await t.run(async (ctx) => {
    const referrerId = options.referrerId ?? ids.referrerId
    const code = options.code ?? 'REFERRER1'
    await ctx.db.insert('referralCodes', {
      ownerUserId: referrerId,
      code,
      termsVersion: options.termsVersion ?? 'lifetime_5_v1',
      rewardBps: options.rewardBps ?? 500,
      createdAt: ids.now,
    })
    return await ctx.db.insert('referrals', {
      referrerUserId: referrerId,
      referredUserId: ids.memberId,
      code,
      status: options.status ?? 'active',
      rewardedBookings: options.rewardedBookings ?? 0,
      termsVersion: options.termsVersion === null ? undefined : options.termsVersion ?? 'lifetime_5_v1',
      rewardBps: options.rewardBps === null ? undefined : options.rewardBps ?? 500,
      createdAt: ids.now,
      updatedAt: ids.now,
    })
  })
}

async function insertSettledBooking(
  t: ReturnType<typeof createTest>,
  ids: Awaited<ReturnType<typeof seed>>,
  options: { subtotal?: number; fee?: number } = {},
) {
  const subtotal = options.subtotal ?? SUBTOTAL
  const fee = options.fee ?? FEE
  return await t.run(async (ctx) => {
    const companionAccount = await ctx.db.query('walletAccounts')
      .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.companionUserId}:booking`))
      .unique()
    if (!companionAccount) {
      await ctx.db.insert('walletAccounts', {
        deterministicKey: `member:${ids.companionUserId}:booking`,
        accountType: 'member_booking',
        ownerUserId: ids.companionUserId,
        currency: 'PHP',
        availableCentavos: 0,
        reservedCentavos: 0,
        pendingCentavos: subtotal,
        createdAt: ids.now,
        updatedAt: ids.now,
      })
    } else {
      await ctx.db.patch(companionAccount._id, {
        pendingCentavos: companionAccount.pendingCentavos + subtotal,
        updatedAt: ids.now,
      })
    }
    const platformAccount = await ctx.db.query('walletAccounts')
      .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', 'platform:booking-revenue'))
      .unique()
    if (!platformAccount) {
      await ctx.db.insert('walletAccounts', {
        deterministicKey: 'platform:booking-revenue',
        accountType: 'platform_revenue',
        currency: 'PHP',
        availableCentavos: 0,
        reservedCentavos: 0,
        pendingCentavos: fee,
        createdAt: ids.now,
        updatedAt: ids.now,
      })
    } else {
      await ctx.db.patch(platformAccount._id, {
        pendingCentavos: platformAccount.pendingCentavos + fee,
        updatedAt: ids.now,
      })
    }
    return await ctx.db.insert('bookings', {
      memberId: ids.memberId,
      companionProfileId: ids.companionProfileId,
      category: 'Coffee or meal companion',
      mode: 'in_person',
      requestedAt: ids.now - 3_600_000,
      durationMinutes: 60,
      status: 'review_window',
      pricingModel: 'member_wallet_v2',
      serviceSubtotalCentavos: subtotal,
      memberBookingFeeBps: 1_500,
      memberBookingFeeCentavos: fee,
      memberTotalCentavos: subtotal + fee,
      companionEarningsCentavos: subtotal,
      currency: 'PHP',
      settlementState: 'pending',
      settlementEligibleAt: ids.now - 1_000,
      jointlyCompletedAt: ids.now - 1_000,
      memberCompletedAt: ids.now - 1_000,
      companionCompletedAt: ids.now - 1_000,
      createdAt: ids.now,
      updatedAt: ids.now,
    })
  })
}

describe('referral program', () => {
  it('creates one code per member and attributes a new member once', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referrer = t.withIdentity({ subject: 'referral-referrer' })
    const member = t.withIdentity({ subject: 'referral-member' })

    const first = await referrer.mutation(api.referrals.ensureReferralCode, {})
    const second = await referrer.mutation(api.referrals.ensureReferralCode, {})
    expect(first.code).toMatch(/^[A-Z2-9]{8}$/)
    expect(second.code).toBe(first.code)

    await member.mutation(api.referrals.attributeReferral, { code: first.code })
    await expect(member.mutation(api.referrals.attributeReferral, { code: first.code }))
      .rejects.toThrow('already linked')
    await expect(referrer.mutation(api.referrals.attributeReferral, { code: first.code }))
      .rejects.toThrow('own referral code')

    const summary = await member.query(api.referrals.myReferral, {})
    expect(summary?.referredBy).toMatchObject({
      referrerDisplayName: 'Referral Referrer',
      code: first.code,
      rewardedBookings: 0,
    })
    expect(summary?.totalReferrals).toBe(0)
    expect(summary?.promptDismissedAt).toEqual(expect.any(Number))
  })

  it('dismisses the one-time referral prompt idempotently', async () => {
    const t = createTest()
    await seed(t)
    const member = t.withIdentity({ subject: 'referral-member' })

    const first = await member.mutation(api.referrals.dismissReferralPrompt, {})
    const second = await member.mutation(api.referrals.dismissReferralPrompt, {})

    expect(second.dismissedAt).toBe(first.dismissedAt)
    const summary = await member.query(api.referrals.myReferral, {})
    expect(summary?.promptDismissedAt).toBe(first.dismissedAt)
  })

  it('credits 5% of the booking subtotal on every settled booking for life', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referralId = await insertReferral(t, ids)

    for (let index = 0; index < 4; index += 1) {
      const bookingId = await insertSettledBooking(t, ids)
      await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now + index })
    }

    const state = await t.run(async (ctx) => {
      const rewards = await ctx.db.query('referralRewards').collect()
      const referral = await ctx.db.get(referralId)
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      return { rewards, referral, wallet }
    })
    const lifetimeRewards = state.rewards.filter((reward) => (reward.kind ?? 'lifetime') === 'lifetime')
    const bonusRewards = state.rewards.filter((reward) => reward.kind === 'launch_bonus')
    expect(lifetimeRewards).toHaveLength(4)
    expect(lifetimeRewards.every((reward) => reward.amountCentavos === REWARD && reward.status === 'pending')).toBe(true)
    expect(bonusRewards).toHaveLength(1)
    expect(bonusRewards[0]?.amountCentavos).toBe(5_000)
    expect(state.referral).toMatchObject({ rewardedBookings: 4, status: 'active' })
    expect(state.wallet?.availableCentavos).toBe(0)
    expect(state.wallet?.pendingCentavos).toBe(REWARD * 4 + 5_000)

    for (const reward of state.rewards) {
      await t.mutation(internal.finance.releaseReferralReward, { rewardId: reward._id, now: ids.now + REFERRAL_REWARD_HOLD_MS + 20 })
    }
    const released = await t.run(async (ctx) => {
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      const rewards = await ctx.db.query('referralRewards').collect()
      return { wallet, rewards }
    })
    expect(released.wallet?.availableCentavos).toBe(REWARD * 4 + 5_000)
    expect(released.wallet?.pendingCentavos).toBe(0)
    expect(released.rewards.every((reward) => reward.status === 'credited')).toBe(true)

    const fifthBookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId: fifthBookingId, now: ids.now + 10 })
    const afterFifth = await t.run(async (ctx) => ({
      rewards: await ctx.db.query('referralRewards').collect(),
      referral: await ctx.db.get(referralId),
    }))
    expect(afterFifth.rewards).toHaveLength(6)
    expect(afterFifth.referral?.rewardedBookings).toBe(5)
  })

  it('preserves the legacy first-three rate for unversioned referrals then moves to 5%', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referralId = await insertReferral(t, ids, { rewardedBookings: 1, termsVersion: null, rewardBps: null })

    for (let index = 0; index < 3; index += 1) {
      const bookingId = await insertSettledBooking(t, ids)
      await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now + index })
    }

    const state = await t.run(async (ctx) => ({
      rewards: await ctx.db.query('referralRewards').collect(),
      referral: await ctx.db.get(referralId),
    }))
    const lifetime = state.rewards
      .filter((reward) => (reward.kind ?? 'lifetime') === 'lifetime')
      .sort((left, right) => left.createdAt - right.createdAt)
    expect(lifetime.map((reward) => reward.amountCentavos)).toEqual([5_100, 5_100, REWARD])
    expect(lifetime.map((reward) => reward.rewardBps)).toEqual([6_800, 6_800, 500])
    expect(state.referral).toMatchObject({ rewardedBookings: 4, status: 'active' })

    const summary = await t.withIdentity({ subject: 'referral-referrer' }).query(api.referrals.myReferral, {})
    expect(summary?.recentRewards.map((reward: { rewardBps: number | null }) => reward.rewardBps)).toEqual([500, 6_800, 6_800])
  })

  it('holds a flagged reward for review and releases it after admin review', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referralId = await insertReferral(t, ids)
    const signalId = await t.run(async (ctx) => {
      return await ctx.db.insert('referralFraudSignals', {
        referralId,
        referrerUserId: ids.referrerId,
        referredUserId: ids.memberId,
        signal: 'same_device',
        status: 'open',
        createdAt: ids.now,
      })
    })
    const bookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })

    const pending = await t.run(async (ctx) => {
      const rewards = await ctx.db.query('referralRewards').collect()
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      return { rewards, wallet }
    })
    expect(pending.rewards.every((reward) => reward.status === 'pending' && reward.reviewRequired === true)).toBe(true)
    expect(pending.wallet?.availableCentavos).toBe(0)
    expect(pending.wallet?.pendingCentavos).toBe(REWARD + 5_000)

    const lifetime = pending.rewards.find((reward) => (reward.kind ?? 'lifetime') === 'lifetime')
    expect(lifetime).toBeDefined()
    const early = await t.mutation(internal.finance.releaseReferralReward, { rewardId: lifetime!._id, now: ids.now + 1 })
    expect(early.outcome).toBe('not_due')

    const admin = t.withIdentity({ subject: 'referral-admin' })
    await admin.mutation(api.admin.resolveReferralFraudSignal, { signalId, decision: 'legitimate' })
    await t.mutation(internal.finance.releaseReferralReward, {
      rewardId: lifetime!._id,
      now: ids.now + REFERRAL_REWARD_HOLD_MS + 2,
    })
    const released = await t.run(async (ctx) => {
      const reward = await ctx.db.get(lifetime!._id)
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      return { reward, wallet }
    })
    expect(released.reward?.status).toBe('credited')
    expect(released.wallet?.availableCentavos).toBe(REWARD)
  })

  it('blocks a Companion from referring their own client', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referralId = await insertReferral(t, ids, { referrerId: ids.companionUserId })
    const bookingId = await insertSettledBooking(t, ids)

    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })

    const state = await t.run(async (ctx) => ({
      rewards: await ctx.db.query('referralRewards').collect(),
      signals: await ctx.db.query('referralFraudSignals').collect(),
      referral: await ctx.db.get(referralId),
    }))
    expect(state.rewards).toHaveLength(0)
    expect(state.referral?.rewardedBookings).toBe(0)
    expect(state.signals.some((signal) => signal.signal === 'companion_self_dealing')).toBe(true)
  })

  it('lets an unattributed member add a code before their first booking', async () => {
    const t = createTest()
    const ids = await seed(t)
    const member = t.withIdentity({ subject: 'referral-member' })
    const before = await member.query(api.referrals.myReferral, {})
    expect(before?.canAddReferralCode).toBe(true)

    await insertSettledBooking(t, ids)

    const after = await member.query(api.referrals.myReferral, {})
    expect(after?.canAddReferralCode).toBe(false)
  })

  it('reverses a released reward through the admin refund path', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids)
    const bookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })
    const rewards = await t.run(async (ctx) => ctx.db.query('referralRewards').collect())
    for (const reward of rewards) {
      await t.mutation(internal.finance.releaseReferralReward, { rewardId: reward._id, now: ids.now + REFERRAL_REWARD_HOLD_MS + 1 })
    }

    const admin = t.withIdentity({ subject: 'referral-admin' })
    await admin.mutation(api.admin.reverseReferralForBooking, { bookingId, reason: 'Member refund' })

    const after = await t.run(async (ctx) => ({
      rewards: await ctx.db.query('referralRewards').collect(),
      wallet: await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique(),
    }))
    expect(after.rewards.every((reward) => reward.status === 'reversed')).toBe(true)
    expect(after.wallet?.availableCentavos).toBe(0)
  })

  it('resumes credit for referrals marked completed by the old capped program', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referralId = await insertReferral(t, ids, { status: 'completed', rewardedBookings: 3, termsVersion: null, rewardBps: null })
    const bookingId = await insertSettledBooking(t, ids)

    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })

    const state = await t.run(async (ctx) => ({
      rewards: await ctx.db.query('referralRewards').collect(),
      referral: await ctx.db.get(referralId),
    }))
    expect(state.rewards).toHaveLength(1)
    expect(state.rewards[0]?.amountCentavos).toBe(REWARD)
    expect(state.referral).toMatchObject({ rewardedBookings: 4, status: 'active' })
  })

  it('does not credit the same booking twice', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referralId = await insertReferral(t, ids)
    const bookingId = await insertSettledBooking(t, ids)

    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now + 1_000 })

    const state = await t.run(async (ctx) => ({
      rewards: await ctx.db.query('referralRewards').collect(),
      referral: await ctx.db.get(referralId),
    }))
    expect(state.rewards).toHaveLength(2)
    expect(state.rewards.filter((reward) => (reward.kind ?? 'lifetime') === 'lifetime')).toHaveLength(1)
    expect(state.referral?.rewardedBookings).toBe(1)
  })

  it('credits a booking below the old minimum subtotal too', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids)
    const bookingId = await insertSettledBooking(t, ids, { subtotal: 30_000, fee: 4_500 })

    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })

    const rewards = await t.run(async (ctx) => ctx.db.query('referralRewards').collect())
    const lifetime = rewards.filter((reward) => (reward.kind ?? 'lifetime') === 'lifetime')
    expect(lifetime).toHaveLength(1)
    expect(lifetime[0]?.amountCentavos).toBe(1_500)
    expect(rewards).toHaveLength(2)
  })

  it('skips a self-referral', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids, { referrerId: ids.memberId })
    const bookingId = await insertSettledBooking(t, ids)

    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })

    expect(await t.run(async (ctx) => ctx.db.query('referralRewards').collect())).toHaveLength(0)
  })

  it('keeps a no-referral settlement unchanged and creates no referral credit', async () => {
    const t = createTest()
    const ids = await seed(t)
    const bookingId = await insertSettledBooking(t, ids)

    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })

    const state = await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId)
      const companionAccount = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.companionUserId}:booking`))
        .unique()
      const platformAccount = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', 'platform:booking-revenue'))
        .unique()
      const rewards = await ctx.db.query('referralRewards').collect()
      const referralTransactions = (await ctx.db.query('walletTransactions').collect())
        .filter((transaction) => transaction.kind === 'referral_credit' || transaction.kind === 'referral_reversal')
      return { booking, companionAccount, platformAccount, rewards, referralTransactions }
    })

    expect(state.booking?.settlementState).toBe('settled')
    expect(state.companionAccount?.availableCentavos).toBe(SUBTOTAL)
    expect(state.platformAccount?.availableCentavos).toBe(FEE)
    expect(state.rewards).toHaveLength(0)
    expect(state.referralTransactions).toHaveLength(0)
  })

  it('returns referral totals without loading the full list', async () => {
    const t = createTest()
    const ids = await seed(t)
    await t.run(async (ctx) => {
      const identity = {
        verificationStatus: 'approved' as const,
        verificationSource: 'persona' as const,
        identityVerifiedAt: ids.now,
        identityExpiresAt: ids.now + 86_400_000,
        suspended: false,
        createdAt: ids.now,
        updatedAt: ids.now,
      }
      for (let index = 0; index < 4; index += 1) {
        const referredUserId = await ctx.db.insert('users', {
          clerkUserId: `recent-referral-${index}`,
          displayName: `Recent ${index}`,
          role: 'member',
          ...identity,
        })
        await ctx.db.insert('referrals', {
          referrerUserId: ids.referrerId,
          referredUserId,
          code: 'REFERRER1',
          status: 'active',
          rewardedBookings: 0,
          createdAt: ids.now + index,
          updatedAt: ids.now + index,
        })
      }
    })

    const summary = await t.withIdentity({ subject: 'referral-referrer' }).query(api.referrals.myReferral, {})

    expect(summary?.totalReferrals).toBe(4)
    expect(summary?.totalRewardedBookings).toBe(0)
  })

  it('paginates referrals newest first', async () => {
    const t = createTest()
    const ids = await seed(t)
    await t.run(async (ctx) => {
      const identity = {
        verificationStatus: 'approved' as const,
        verificationSource: 'persona' as const,
        identityVerifiedAt: ids.now,
        identityExpiresAt: ids.now + 86_400_000,
        suspended: false,
        createdAt: ids.now,
        updatedAt: ids.now,
      }
      for (let index = 0; index < 4; index += 1) {
        const referredUserId = await ctx.db.insert('users', {
          clerkUserId: `page-referral-${index}`,
          displayName: `Page ${index}`,
          role: 'member',
          ...identity,
        })
        await ctx.db.insert('referrals', {
          referrerUserId: ids.referrerId,
          referredUserId,
          code: 'REFERRER1',
          status: 'active',
          rewardedBookings: 0,
          createdAt: ids.now + index,
          updatedAt: ids.now + index,
        })
      }
    })
    const referrer = t.withIdentity({ subject: 'referral-referrer' })

    const first = await referrer.query(api.referrals.myReferralPage, {
      paginationOpts: { numItems: 2, cursor: null },
    })
    expect(first.page.map((referral) => referral.referredDisplayName)).toEqual(['Page 3', 'Page 2'])
    expect(first.isDone).toBe(false)

    const second = await referrer.query(api.referrals.myReferralPage, {
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    })
    expect(second.page.map((referral) => referral.referredDisplayName)).toEqual(['Page 1', 'Page 0'])
    expect(second.isDone).toBe(true)
  })

  it('rejects a suspended referrer code', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referrer = t.withIdentity({ subject: 'referral-referrer' })
    const member = t.withIdentity({ subject: 'referral-member' })
    const code = (await referrer.mutation(api.referrals.ensureReferralCode, {})).code

    await t.run(async (ctx) => {
      await ctx.db.patch(ids.referrerId, { suspended: true, updatedAt: ids.now })
    })

    await expect(member.mutation(api.referrals.attributeReferral, { code }))
      .rejects.toThrow('not available')
  })

  it('skips referral credit when the referrer is suspended', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids)
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.referrerId, { suspended: true, updatedAt: ids.now })
    })
    const bookingId = await insertSettledBooking(t, ids)

    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })

    const state = await t.run(async (ctx) => ({
      rewards: await ctx.db.query('referralRewards').collect(),
      wallet: await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique(),
    }))
    expect(state.rewards).toHaveLength(0)
    expect(state.wallet?.availableCentavos ?? 0).toBe(0)
  })

  it('reverses referral credit when a rewarded booking is refunded', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids)
    const bookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })

    const before = await t.run(async (ctx) => {
      const rewards = await ctx.db.query('referralRewards').collect()
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      return { rewards, wallet }
    })
    expect(before.rewards).toHaveLength(2)
    expect(before.rewards.every((reward) => reward.status === 'pending')).toBe(true)
    expect(before.wallet?.availableCentavos).toBe(0)
    expect(before.wallet?.pendingCentavos).toBe(REWARD + 5_000)

    await t.run(async (ctx) => {
      await reverseReferralRewardForBooking(ctx, bookingId, ids.now + 1)
    })

    const after = await t.run(async (ctx) => {
      const rewards = await ctx.db.query('referralRewards').collect()
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      const referral = await ctx.db.query('referrals').first()
      const transactions = await ctx.db.query('walletTransactions').collect()
      return { rewards, wallet, referral, transactions }
    })
    expect(after.rewards.every((reward) => reward.status === 'reversed')).toBe(true)
    expect(after.wallet?.availableCentavos).toBe(0)
    expect(after.wallet?.pendingCentavos).toBe(0)
    expect(after.referral).toMatchObject({ rewardedBookings: 0, status: 'active' })
    expect(after.transactions.filter((transaction) => transaction.kind === 'referral_reversal')).toHaveLength(2)
  })

  it('pauses new codes and attributions but still credits existing referrals', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids)
    await t.run(async (ctx) => {
      const program = await ctx.db.query('referralProgram').first()
      if (program) await ctx.db.patch(program._id, { active: false })
    })

    await expect(t.withIdentity({ subject: 'referral-referrer' }).mutation(api.referrals.ensureReferralCode, {}))
      .rejects.toThrow('paused')
    await expect(t.withIdentity({ subject: 'referral-member' }).mutation(api.referrals.attributeReferral, { code: 'REFERRER1' }))
      .rejects.toThrow('paused')

    const bookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })
    const rewards = await t.run(async (ctx) => ctx.db.query('referralRewards').collect())
    expect(rewards.length).toBeGreaterThan(0)
  })

  it('rejects a code after the 30-day attribution window', async () => {
    const t = createTest()
    const ids = await seed(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        clerkUserId: 'old-member',
        displayName: 'Old Member',
        role: 'member',
        verificationStatus: 'approved',
        suspended: false,
        createdAt: ids.now - 31 * 86_400_000,
        updatedAt: ids.now,
      })
      await ctx.db.insert('referralCodes', {
        ownerUserId: ids.referrerId,
        code: 'OLDCODE1',
        termsVersion: 'lifetime_5_v1',
        rewardBps: 500,
        createdAt: ids.now,
      })
    })

    await expect(t.withIdentity({ subject: 'old-member' }).mutation(api.referrals.attributeReferral, { code: 'OLDCODE1' }))
      .rejects.toThrow('within 30 days')
  })

  it('stops the launch bonus at the claim cap', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids)
    await t.run(async (ctx) => {
      const program = await ctx.db.query('referralProgram').first()
      if (program) await ctx.db.patch(program._id, { launchBonusClaims: program.launchBonusMaxClaims })
    })
    const bookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })
    const rewards = await t.run(async (ctx) => ctx.db.query('referralRewards').collect())
    expect(rewards.filter((reward) => (reward.kind ?? 'lifetime') === 'lifetime')).toHaveLength(1)
    expect(rewards.some((reward) => reward.kind === 'launch_bonus')).toBe(false)
  })

  it('does not pay the launch bonus on a legacy referral', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids, { rewardedBookings: 0, termsVersion: null, rewardBps: null })
    const bookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })
    const rewards = await t.run(async (ctx) => ctx.db.query('referralRewards').collect())
    const lifetime = rewards.find((reward) => (reward.kind ?? 'lifetime') === 'lifetime')
    expect(lifetime?.amountCentavos).toBe(5_100)
    expect(rewards.some((reward) => reward.kind === 'launch_bonus')).toBe(false)
  })

  it('ends the referral on a fraud decision and blocks the next booking', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referralId = await insertReferral(t, ids)
    const bookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })
    const signalId = await t.run(async (ctx) => ctx.db.insert('referralFraudSignals', {
      referralId,
      referrerUserId: ids.referrerId,
      referredUserId: ids.memberId,
      signal: 'same_device',
      status: 'open',
      createdAt: ids.now,
    }))

    const admin = t.withIdentity({ subject: 'referral-admin' })
    await admin.mutation(api.admin.resolveReferralFraudSignal, { signalId, decision: 'fraud', note: 'Confirmed fraud' })
    const state = await t.run(async (ctx) => ({
      referral: await ctx.db.get(referralId),
      rewards: await ctx.db.query('referralRewards').collect(),
    }))
    expect(state.referral?.status).toBe('reversed')
    expect(state.rewards.every((reward) => reward.status === 'reversed')).toBe(true)

    const secondBookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId: secondBookingId, now: ids.now + 1_000 })
    const after = await t.run(async (ctx) => ctx.db.query('referralRewards').collect())
    expect(after.filter((reward) => reward.status !== 'reversed')).toHaveLength(0)
  })

  it('does not release while another signal is open', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referralId = await insertReferral(t, ids)
    const signalIds = await t.run(async (ctx) => [
      await ctx.db.insert('referralFraudSignals', {
        referralId,
        referrerUserId: ids.referrerId,
        referredUserId: ids.memberId,
        signal: 'same_device',
        status: 'open',
        createdAt: ids.now,
      }),
      await ctx.db.insert('referralFraudSignals', {
        referralId,
        referrerUserId: ids.referrerId,
        referredUserId: ids.memberId,
        signal: 'referral_volume',
        status: 'open',
        createdAt: ids.now,
      }),
    ])
    const bookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })

    const admin = t.withIdentity({ subject: 'referral-admin' })
    const first = await admin.mutation(api.admin.resolveReferralFraudSignal, { signalId: signalIds[0]!, decision: 'legitimate' })
    expect(first.blockedByOpenSignals).toBe(true)
    const held = await t.run(async (ctx) => ctx.db.query('referralRewards').first())
    expect(held?.status).toBe('pending')
    expect(held?.reviewRequired).toBe(true)

    const second = await admin.mutation(api.admin.resolveReferralFraudSignal, { signalId: signalIds[1]!, decision: 'legitimate' })
    expect(second.blockedByOpenSignals).toBe(false)
  })

  it('refuses an admin from resolving a signal on their own referral', async () => {
    const t = createTest()
    const ids = await seed(t)
    await t.run(async (ctx) => ctx.db.patch(ids.referrerId, { role: 'admin' }))
    const referralId = await insertReferral(t, ids)
    const signalId = await t.run(async (ctx) => ctx.db.insert('referralFraudSignals', {
      referralId,
      referrerUserId: ids.referrerId,
      referredUserId: ids.memberId,
      signal: 'companion_self_dealing',
      status: 'open',
      createdAt: ids.now,
    }))

    const selfAdmin = t.withIdentity({ subject: 'referral-referrer' })
    await expect(selfAdmin.mutation(api.admin.resolveReferralFraudSignal, { signalId, decision: 'legitimate' }))
      .rejects.toThrow('Another admin must resolve a referral signal for your own account')
  })

  it('refuses to release a reward while a signal is open', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referralId = await insertReferral(t, ids)
    await t.run(async (ctx) => ctx.db.insert('referralFraudSignals', {
      referralId,
      referrerUserId: ids.referrerId,
      referredUserId: ids.memberId,
      signal: 'same_device',
      status: 'open',
      createdAt: ids.now,
    }))
    const bookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })
    const reward = await t.run(async (ctx) => ctx.db.query('referralRewards').first())
    expect(reward).toBeTruthy()

    const admin = t.withIdentity({ subject: 'referral-admin' })
    await expect(admin.mutation(api.admin.clearReferralRewardReview, { rewardId: reward!._id }))
      .rejects.toThrow('Resolve the open referral signals')
  })

  it('flags a same-device claim when the code owner and claimant share an installation', async () => {
    const t = createTest()
    const ids = await seed(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('referralCodes', {
        ownerUserId: ids.referrerId,
        code: 'SAMEDEV1',
        termsVersion: 'lifetime_5_v1',
        rewardBps: 500,
        deviceId: 'device-a',
        createdAt: ids.now,
      })
    })

    const member = t.withIdentity({ subject: 'referral-member' })
    await member.mutation(api.referrals.attributeReferral, { code: 'SAMEDEV1', deviceId: 'device-a' })

    const signals = await t.run(async (ctx) => await ctx.db.query('referralFraudSignals').collect())
    expect(signals.some((signal) => signal.signal === 'same_device')).toBe(true)
  })

  it('records device history for code creation and claims without push registration', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referrer = t.withIdentity({ subject: 'referral-referrer' })
    const { code } = await referrer.mutation(api.referrals.ensureReferralCode, { deviceId: 'device-referrer' })

    const member = t.withIdentity({ subject: 'referral-member' })
    await member.mutation(api.referrals.attributeReferral, { code, deviceId: 'device-friend' })

    const state = await t.run(async (ctx) => ({
      devices: await ctx.db.query('userDevices').collect(),
      codeRow: await ctx.db.query('referralCodes').withIndex('by_code', (q) => q.eq('code', code)).unique(),
    }))
    expect(state.codeRow?.deviceId).toBe('device-referrer')
    expect(state.devices).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: ids.referrerId, installationId: 'device-referrer' }),
      expect.objectContaining({ userId: ids.memberId, installationId: 'device-friend' }),
    ]))
  })

  it('counts legacy rewarded bookings from the referral row', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids, { rewardedBookings: 3, termsVersion: null, rewardBps: null })
    const summary = await t.withIdentity({ subject: 'referral-referrer' }).query(api.referrals.myReferral, {})
    expect(summary?.totalRewardedBookings).toBe(3)
  })

  it('keeps a top-up intact when a released referral reward is reversed', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids)
    const bookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })
    const rewards = await t.run(async (ctx) => ctx.db.query('referralRewards').collect())
    for (const reward of rewards) {
      await t.mutation(internal.finance.releaseReferralReward, {
        rewardId: reward._id,
        now: ids.now + REFERRAL_REWARD_HOLD_MS + 1,
      })
    }
    await t.run(async (ctx) => {
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      await applyWalletTransaction(ctx, {
        kind: 'test_member_credit',
        idempotencyKey: 'test:referral:topup',
        actorUserId: ids.referrerId,
        amountCentavos: 10_000,
        now: ids.now,
        legs: [{ accountId: wallet!._id, bucket: 'available', direction: 'credit', amountCentavos: 10_000 }],
        allowExternalCredit: true,
      })
    })

    const admin = t.withIdentity({ subject: 'referral-admin' })
    await admin.mutation(api.admin.reverseReferralForBooking, { bookingId, reason: 'Member refund' })

    const after = await t.run(async (ctx) => {
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      return wallet
    })
    expect(after?.availableCentavos).toBe(10_000)
    expect(after?.referralCreditCentavos ?? 0).toBe(0)
    expect(after?.referralDebtCentavos ?? 0).toBe(0)
  })

  it('records referral debt instead of taking a top-up after the credit was spent', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids)
    const bookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })
    const rewards = await t.run(async (ctx) => ctx.db.query('referralRewards').collect())
    for (const reward of rewards) {
      await t.mutation(internal.finance.releaseReferralReward, {
        rewardId: reward._id,
        now: ids.now + REFERRAL_REWARD_HOLD_MS + 1,
      })
    }
    await t.run(async (ctx) => {
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      await applyWalletTransaction(ctx, {
        kind: 'test_member_credit',
        idempotencyKey: 'test:referral:topup',
        actorUserId: ids.referrerId,
        amountCentavos: 10_000,
        now: ids.now,
        legs: [{ accountId: wallet!._id, bucket: 'available', direction: 'credit', amountCentavos: 10_000 }],
        allowExternalCredit: true,
      })
      await applyWalletTransaction(ctx, {
        kind: 'booking_reserve',
        idempotencyKey: 'test:referral:spend',
        actorUserId: ids.referrerId,
        amountCentavos: 5_375,
        now: ids.now,
        legs: [{ accountId: wallet!._id, bucket: 'available', direction: 'debit', amountCentavos: 5_375 }],
        allowExternalDebit: true,
      })
    })

    const admin = t.withIdentity({ subject: 'referral-admin' })
    await admin.mutation(api.admin.reverseReferralForBooking, { bookingId, reason: 'Member refund' })

    const after = await t.run(async (ctx) => {
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      return wallet
    })
    expect(after?.availableCentavos).toBe(10_000)
    expect(after?.referralCreditCentavos ?? 0).toBe(0)
    expect(after?.referralDebtCentavos ?? 0).toBe(5_375)
  })
})
