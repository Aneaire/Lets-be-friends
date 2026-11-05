import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import { reverseReferralRewardForBooking } from '../../../convex/finance'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
const SUBTOTAL = 50_000
const FEE = 7_500
const TOTAL = 57_500
const REWARD = 5_100

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
    return { now, referrerId, memberId, companionUserId, companionProfileId }
  })
}

async function insertReferral(
  t: ReturnType<typeof createTest>,
  ids: Awaited<ReturnType<typeof seed>>,
  options: { referrerId?: any; code?: string } = {},
) {
  return await t.run(async (ctx) => {
    const referrerId = options.referrerId ?? ids.referrerId
    const code = options.code ?? 'REFERRER1'
    await ctx.db.insert('referralCodes', {
      ownerUserId: referrerId,
      code,
      createdAt: ids.now,
    })
    return await ctx.db.insert('referrals', {
      referrerUserId: referrerId,
      referredUserId: ids.memberId,
      code,
      status: 'active',
      rewardedBookings: 0,
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
    expect(summary?.referrals).toHaveLength(0)
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

  it('credits 68% of the service fee for each of the first three settled bookings', async () => {
    const t = createTest()
    const ids = await seed(t)
    const referralId = await insertReferral(t, ids)

    for (let index = 0; index < 3; index += 1) {
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
    expect(state.rewards).toHaveLength(3)
    expect(state.rewards.every((reward) => reward.amountCentavos === REWARD && reward.status === 'credited')).toBe(true)
    expect(state.referral).toMatchObject({ rewardedBookings: 3, status: 'completed' })
    expect(state.wallet?.availableCentavos).toBe(REWARD * 3)

    const fourthBookingId = await insertSettledBooking(t, ids)
    await t.mutation(internal.finance.settleBooking, { bookingId: fourthBookingId, now: ids.now + 10 })
    const afterFourth = await t.run(async (ctx) => ({
      rewards: await ctx.db.query('referralRewards').collect(),
      referral: await ctx.db.get(referralId),
    }))
    expect(afterFourth.rewards).toHaveLength(3)
    expect(afterFourth.referral?.rewardedBookings).toBe(3)
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
    expect(state.rewards).toHaveLength(1)
    expect(state.referral?.rewardedBookings).toBe(1)
  })

  it('skips bookings below the minimum subtotal', async () => {
    const t = createTest()
    const ids = await seed(t)
    await insertReferral(t, ids)
    const bookingId = await insertSettledBooking(t, ids, { subtotal: 30_000, fee: 4_500 })

    await t.mutation(internal.finance.settleBooking, { bookingId, now: ids.now })

    expect(await t.run(async (ctx) => ctx.db.query('referralRewards').collect())).toHaveLength(0)
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

  it('returns only the three most recent referrals with totals', async () => {
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

    expect(summary?.referrals).toHaveLength(3)
    expect(summary?.referrals.map((referral) => referral.referredDisplayName)).toEqual([
      'Recent 3',
      'Recent 2',
      'Recent 1',
    ])
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
      const reward = await ctx.db.query('referralRewards').first()
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      return { reward, wallet }
    })
    expect(before.reward?.status).toBe('credited')
    expect(before.wallet?.availableCentavos).toBe(REWARD)

    await t.run(async (ctx) => {
      await reverseReferralRewardForBooking(ctx, bookingId, ids.now + 1)
    })

    const after = await t.run(async (ctx) => {
      const reward = await ctx.db.query('referralRewards').first()
      const wallet = await ctx.db.query('walletAccounts')
        .withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${ids.referrerId}:booking`))
        .unique()
      const referral = await ctx.db.query('referrals').first()
      const transactions = await ctx.db.query('walletTransactions').collect()
      return { reward, wallet, referral, transactions }
    })
    expect(after.reward?.status).toBe('reversed')
    expect(after.wallet?.availableCentavos).toBe(0)
    expect(after.referral).toMatchObject({ rewardedBookings: 0, status: 'active' })
    expect(after.transactions.some((transaction) => transaction.kind === 'referral_reversal')).toBe(true)
  })
})
