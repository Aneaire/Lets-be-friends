import {
  BOOKING_CURRENCY,
  LEGACY_REFERRAL_REWARD_BPS,
  MEMBER_WALLET_PRICING_MODEL,
  REFERRAL_REWARD_BPS,
  REFERRAL_REWARD_HOLD_MS,
  REFERRAL_TERMS_VERSION,
  calculateReferralRewardCentavos,
  nextSaturdayManilaCutoff,
  referralRewardBpsFor,
} from '@lets-be-friends/shared'
import { internalMutation, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { ConvexError, v } from 'convex/values'
import { getViewer, writeAudit } from './lib'
import { ensureReferralProgram, getReferralProgram, incrementReferralSummary, recordReferralFraudSignal } from './referralProgram'
import { createNotification } from './notifications'

const COLLECTION_BATCH_SIZE = 200
const SETTLEMENT_BATCH_SIZE = 100
const PLATFORM_REVENUE_ACCOUNT_KEY = 'platform:booking-revenue'
const MAX_BOOKING_TRANSACTION_HISTORY = 100
const MAX_TRANSACTION_BOOKINGS_SCAN = 50
const MEMBER_BOOKING_TRANSACTION_KINDS = [
  'booking_reserve',
  'booking_complete',
  'booking_release',
  'booking_admin_refund',
] as const

type MemberBookingTransactionKind = typeof MEMBER_BOOKING_TRANSACTION_KINDS[number]
type MemberTopUpStatus = 'awaiting_payment' | 'processing' | 'paid' | 'failed' | 'expired'

type WalletBucket = 'available' | 'reserved' | 'pending'
type WalletAccountType = 'member_booking' | 'companion_earnings' | 'platform_revenue'
type WalletTransactionKind = Doc<'walletTransactions'>['kind']
type WalletLeg = {
  accountId: Id<'walletAccounts'>
  bucket: WalletBucket
  direction: 'debit' | 'credit'
  amountCentavos: number
}

export function memberWalletV2Enabled() {
  return process.env.MEMBER_WALLET_V2_ENABLED?.trim().toLowerCase() === 'true'
}

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return null
    if (viewer.suspended) throw new ConvexError('Account is suspended')
    const companion = await ctx.db.query('companionProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    if (!companion) return null

    const now = Date.now()
    const nextCutoff = nextSaturdayManilaCutoff(now)
    const [ledger, obligations, topUps, earningsAccount] = await Promise.all([
      ctx.db.query('platformFeeLedger').withIndex('by_companion_created_at', (q) => q.eq('companionUserId', viewer._id)).order('desc').collect(),
      ctx.db.query('commissionObligations').withIndex('by_companion_due_at', (q) => q.eq('companionUserId', viewer._id)).collect(),
      ctx.db.query('paymongoTopUps').withIndex('by_companion_created_at', (q) => q.eq('companionUserId', viewer._id)).order('desc').take(10),
      readUnifiedWalletBalance(ctx, viewer._id),
    ])

    const paidByObligation = new Map<string, number>()
    let availableBalanceCentavos = 0
    for (const entry of ledger) {
      availableBalanceCentavos += entry.direction === 'credit' ? entry.amountCentavos : -entry.amountCentavos
      if (entry.direction === 'debit' && entry.obligationId) {
        const key = String(entry.obligationId)
        paidByObligation.set(key, (paidByObligation.get(key) ?? 0) + entry.amountCentavos)
      }
    }

    let pastDueCentavos = 0
    let dueThisSaturdayCentavos = 0
    const obligationRows = obligations.map((obligation) => {
      const paidCentavos = paidByObligation.get(String(obligation._id)) ?? 0
      const remainingCentavos = Math.max(0, obligation.amountCentavos - paidCentavos)
      if (remainingCentavos > 0 && obligation.dueAt <= now) pastDueCentavos += remainingCentavos
      if (remainingCentavos > 0 && obligation.dueAt === nextCutoff) dueThisSaturdayCentavos += remainingCentavos
      return { ...obligation, paidCentavos, remainingCentavos }
    })

    return {
      currency: BOOKING_CURRENCY,
      availableBalanceCentavos,
      dueThisSaturdayCentavos,
      dueAt: nextCutoff,
      pastDueCentavos,
      canAcceptBookings: pastDueCentavos === 0,
      pendingEarningsCentavos: earningsAccount.pendingCentavos,
      availableEarningsCentavos: earningsAccount.availableCentavos,
      inTransferEarningsCentavos: earningsAccount.reservedCentavos,
      payoutsAvailable: process.env.COMPANION_WITHDRAWALS_ENABLED?.trim().toLowerCase() === 'true',
      payoutNotice: process.env.COMPANION_WITHDRAWALS_ENABLED?.trim().toLowerCase() === 'true'
        ? 'Withdraw available wallet funds to your verified payout account. A transfer fee applies to each withdrawal.'
        : 'Withdrawals are temporarily unavailable. Your wallet balance remains recorded.',
      obligations: obligationRows.filter((row) => row.remainingCentavos > 0).sort((a, b) => a.dueAt - b.dueAt).slice(0, 20),
      ledger: ledger.slice(0, 20),
      topUps: topUps.filter((topUp) => topUp.purpose !== 'member_booking_balance'),
    }
  },
})

export const memberDashboard = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return null
    if (viewer.suspended) throw new ConvexError('Account is suspended')
    const account = await readUnifiedWalletBalance(ctx, viewer._id)
    const topUps = await ctx.db.query('paymongoTopUps')
      .withIndex('by_beneficiary_created_at', (q) => q.eq('beneficiaryUserId', viewer._id))
      .order('desc')
      .take(10)
    return {
      currency: BOOKING_CURRENCY,
      enabled: memberWalletV2Enabled(),
      availableCentavos: account.availableCentavos,
      reservedCentavos: account.reservedCentavos,
      pendingCentavos: account.pendingCentavos,
      topUps: topUps.filter((topUp) => topUp.purpose === 'member_booking_balance'),
    }
  },
})

/**
 * The member-facing booking ledger. Booking transactions are linked from their
 * booking row, so the read starts with the member's bookings and keeps only the
 * kinds that move member funds. The dashboard asks for five and the history
 * page for the full bounded list.
 */
export const memberBookingTransactions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return []
    if (viewer.suspended) throw new ConvexError('Account is suspended')
    const requestedLimit = Number.isFinite(args.limit) ? Math.floor(args.limit!) : 20
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_BOOKING_TRANSACTION_HISTORY)
    const bookings = await ctx.db.query('bookings')
      .withIndex('by_member', (q) => q.eq('memberId', viewer._id))
      .order('desc')
      .take(MAX_TRANSACTION_BOOKINGS_SCAN)
    const rows: Array<{ booking: Doc<'bookings'>; transaction: Doc<'walletTransactions'> }> = []
    for (const booking of bookings) {
      const transactions = await ctx.db.query('walletTransactions')
        .withIndex('by_booking', (q) => q.eq('bookingId', booking._id))
        .order('desc')
        .collect()
      for (const transaction of transactions) {
        if (!MEMBER_BOOKING_TRANSACTION_KINDS.includes(transaction.kind as MemberBookingTransactionKind)) continue
        rows.push({ booking, transaction })
      }
    }
    rows.sort((left, right) => right.transaction.createdAt - left.transaction.createdAt)
    const companionCache = new Map<string, { displayName: string }>()
    return await Promise.all(rows.slice(0, limit).map(async ({ booking, transaction }) => {
      const cacheKey = String(booking.companionProfileId)
      let companion = companionCache.get(cacheKey)
      if (!companion) {
        companion = await memberTransactionCompanion(ctx, booking.companionProfileId)
        companionCache.set(cacheKey, companion)
      }
      return {
        _id: transaction._id,
        kind: transaction.kind as MemberBookingTransactionKind,
        amountCentavos: transaction.amountCentavos,
        createdAt: transaction.createdAt,
        bookingId: booking._id,
        category: booking.category,
        companionDisplayName: companion.displayName,
      }
    }))
  },
})

async function memberTransactionCompanion(
  ctx: any,
  companionProfileId: Id<'companionProfiles'>,
): Promise<{ displayName: string }> {
  const companion = await ctx.db.get(companionProfileId)
  if (!companion) return { displayName: 'Companion' }
  const user = await ctx.db.get(companion.userId)
  return { displayName: user?.displayName ?? companion.displayName }
}

/** Member wallet top-ups that have left the transient creation stage. */
export const memberTopUps = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return []
    if (viewer.suspended) throw new ConvexError('Account is suspended')
    const requestedLimit = Number.isFinite(args.limit) ? Math.floor(args.limit!) : 20
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_BOOKING_TRANSACTION_HISTORY)
    const rows = await ctx.db.query('paymongoTopUps')
      .withIndex('by_beneficiary_created_at', (q) => q.eq('beneficiaryUserId', viewer._id))
      .order('desc')
      .take(Math.min(limit + 5, MAX_BOOKING_TRANSACTION_HISTORY))
    return rows
      .filter((topUp) => topUp.purpose === 'member_booking_balance' && topUp.status !== 'creating')
      .slice(0, limit)
      .map((topUp) => ({
        _id: topUp._id,
        amountCentavos: topUp.amountCentavos,
        status: topUp.status as MemberTopUpStatus,
        createdAt: topUp.createdAt,
        paidAt: topUp.paidAt,
        expiresAt: topUp.expiresAt,
      }))
  },
})

export const collectWeekly = internalMutation({
  args: { now: v.optional(v.number()), cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    const cycleAt = mostRecentSaturdayManilaCutoff(now)
    const page = await ctx.db
      .query('commissionObligations')
      .withIndex('by_due_at', (q) => q.lte('dueAt', now))
      .order('asc')
      .paginate({ cursor: args.cursor ?? null, numItems: COLLECTION_BATCH_SIZE })
    const availableByCompanion = new Map<string, number>()
    let collectedCentavos = 0

    for (const obligation of page.page) {
      const idempotencyKey = `weekly:${cycleAt}:${obligation._id}`
      const existing = await ctx.db.query('platformFeeLedger').withIndex('by_idempotency_key', (q) => q.eq('idempotencyKey', idempotencyKey)).unique()
      if (existing) continue

      const remainingCentavos = await obligationRemainingCentavos(ctx, obligation)
      if (remainingCentavos <= 0) continue
      const companionKey = String(obligation.companionUserId)
      const cachedAvailable = availableByCompanion.get(companionKey)
      const available: number = cachedAvailable === undefined
        ? await availableBalanceForCompanion(ctx, obligation.companionUserId)
        : cachedAvailable
      const appliedCentavos = Math.min(available, remainingCentavos)
      if (appliedCentavos <= 0) {
        availableByCompanion.set(companionKey, available)
        continue
      }

      await ctx.db.insert('platformFeeLedger', {
        companionUserId: obligation.companionUserId,
        direction: 'debit',
        amountCentavos: appliedCentavos,
        currency: BOOKING_CURRENCY,
        kind: 'commission_collection',
        obligationId: obligation._id,
        idempotencyKey,
        createdAt: now,
      })
      availableByCompanion.set(companionKey, available - appliedCentavos)
      collectedCentavos += appliedCentavos
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.finance.collectWeekly, { now, cursor: page.continueCursor })
    }
    return { processed: page.page.length, collectedCentavos, done: page.isDone }
  },
})

export const settleBooking = internalMutation({
  args: { bookingId: v.id('bookings'), now: v.optional(v.number()) },
  handler: async (ctx, args) => settleBookingFunds(ctx, args.bookingId, args.now ?? Date.now()),
})

export const reconcileSettlements = internalMutation({
  args: { now: v.optional(v.number()), cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    const page = await ctx.db.query('bookings')
      .withIndex('by_settlement_state_eligible_at', (q) => q.eq('settlementState', 'pending').lte('settlementEligibleAt', now))
      .paginate({ cursor: args.cursor ?? null, numItems: SETTLEMENT_BATCH_SIZE })
    let settled = 0
    let blocked = 0
    for (const booking of page.page) {
      const result = await settleBookingFunds(ctx, booking._id, now)
      if (result.outcome === 'settled') settled += 1
      if (result.outcome === 'blocked') blocked += 1
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.finance.reconcileSettlements, { now, cursor: page.continueCursor })
    }
    return { processed: page.page.length, settled, blocked, done: page.isDone }
  },
})

export async function pastDueCommissionCentavos(ctx: { db: any }, companionUserId: Id<'users'>, now = Date.now()) {
  const obligations = await ctx.db
    .query('commissionObligations')
    .withIndex('by_companion_due_at', (q: any) => q.eq('companionUserId', companionUserId).lte('dueAt', now))
    .collect()
  let total = 0
  for (const obligation of obligations) total += await obligationRemainingCentavos(ctx, obligation)
  return total
}

export async function availableMemberBookingBalance(ctx: { db: any }, memberId: Id<'users'>) {
  return (await readUnifiedWalletBalance(ctx, memberId)).availableCentavos
}

export async function creditMemberTopUpInTransaction(
  ctx: { db: any },
  topUp: Doc<'paymongoTopUps'>,
  paidAt: number,
) {
  if (topUp.purpose !== 'member_booking_balance' || !topUp.beneficiaryUserId) {
    throw new ConvexError('Top-up is not a member booking-balance top-up')
  }
  const account = await getOrCreateUserWalletAccount(ctx, topUp.beneficiaryUserId, paidAt)
  const applied = await applyWalletTransaction(ctx, {
    kind: 'paymongo_member_credit',
    idempotencyKey: `topup:${topUp._id}:member-credit`,
    topUpId: topUp._id,
    actorUserId: topUp.beneficiaryUserId,
    amountCentavos: topUp.amountCentavos,
    now: paidAt,
    allowExternalCredit: true,
    legs: [{ accountId: account._id, bucket: 'available', direction: 'credit', amountCentavos: topUp.amountCentavos }],
  })
  if (applied) {
    await writeAudit(ctx, {
      actorUserId: topUp.beneficiaryUserId,
      action: 'member_wallet.top_up_credited',
      targetType: 'paymongoTopUp',
      targetId: String(topUp._id),
      after: { amountCentavos: topUp.amountCentavos, currency: BOOKING_CURRENCY },
    })
  }
}

export async function reserveBookingFunds(ctx: { db: any }, booking: Doc<'bookings'>, now = Date.now()) {
  const amounts = requireV2BookingAmounts(booking)
  const memberAccount = await getOrCreateUserWalletAccount(ctx, booking.memberId, now)
  const applied = await applyWalletTransaction(ctx, {
    kind: 'booking_reserve',
    idempotencyKey: `booking:${booking._id}:reserve`,
    bookingId: booking._id,
    actorUserId: booking.memberId,
    amountCentavos: amounts.total,
    now,
    legs: [
      { accountId: memberAccount._id, bucket: 'available', direction: 'debit', amountCentavos: amounts.total },
      { accountId: memberAccount._id, bucket: 'reserved', direction: 'credit', amountCentavos: amounts.total },
    ],
  })
  return { applied, totalCentavos: amounts.total }
}

export async function releaseBookingFunds(ctx: { db: any }, booking: Doc<'bookings'>, actorUserId: Id<'users'>, now = Date.now()) {
  if (booking.settlementState === 'refunded') throw new ConvexError('Refunded booking funds cannot be released again')
  const amounts = requireV2BookingAmounts(booking)
  const memberAccount = await getOrCreateUserWalletAccount(ctx, booking.memberId, now)
  return await applyWalletTransaction(ctx, {
    kind: 'booking_release',
    idempotencyKey: `booking:${booking._id}:release`,
    bookingId: booking._id,
    actorUserId,
    amountCentavos: amounts.total,
    now,
    legs: [
      { accountId: memberAccount._id, bucket: 'reserved', direction: 'debit', amountCentavos: amounts.total },
      { accountId: memberAccount._id, bucket: 'available', direction: 'credit', amountCentavos: amounts.total },
    ],
  })
}

export async function allocateCompletedBookingFunds(
  ctx: { db: any },
  booking: Doc<'bookings'>,
  companionUserId: Id<'users'>,
  now = Date.now(),
) {
  if (booking.settlementState === 'refunded') throw new ConvexError('Refunded bookings cannot allocate completion funds')
  const amounts = requireV2BookingAmounts(booking)
  const [memberAccount, companionAccount, platformAccount] = await Promise.all([
    getOrCreateUserWalletAccount(ctx, booking.memberId, now),
    getOrCreateUserWalletAccount(ctx, companionUserId, now),
    getOrCreateWalletAccount(ctx, {
      deterministicKey: PLATFORM_REVENUE_ACCOUNT_KEY, accountType: 'platform_revenue', now,
    }),
  ])
  const applied = await applyWalletTransaction(ctx, {
    kind: 'booking_complete',
    idempotencyKey: `booking:${booking._id}:complete`,
    bookingId: booking._id,
    actorUserId: companionUserId,
    amountCentavos: amounts.total,
    now,
    legs: [
      { accountId: memberAccount._id, bucket: 'reserved', direction: 'debit', amountCentavos: amounts.total },
      { accountId: companionAccount._id, bucket: 'pending', direction: 'credit', amountCentavos: amounts.companion },
      { accountId: platformAccount._id, bucket: 'pending', direction: 'credit', amountCentavos: amounts.fee },
    ],
  })
  const settlementEligibleAt = now
  return { applied, settlementEligibleAt }
}

async function safeReferralNotification(ctx: { db: any; scheduler?: any }, input: any) {
  try {
    await createNotification(ctx as any, input)
  } catch {
    // Notifications are best effort. A delivery failure must never reverse a
    // settled reward or block a refund.
  }
}

export async function creditReferralForSettledBooking(
  ctx: { db: any; scheduler?: any },
  booking: Doc<'bookings'>,
  now = Date.now(),
) {
  if (booking.pricingModel !== MEMBER_WALLET_PRICING_MODEL) return { outcome: 'not_v2' as const }
  if (booking.memberBookingFeeCentavos === undefined) return { outcome: 'missing_fee' as const }

  const referral = await ctx.db.query('referrals')
    .withIndex('by_referred', (q: any) => q.eq('referredUserId', booking.memberId))
    .first()
  if (!referral || referral.status === 'reversed') return { outcome: 'no_referral' as const }
  if (referral.referrerUserId === booking.memberId) return { outcome: 'self_referral' as const }
  const referrer = await ctx.db.get(referral.referrerUserId)
  if (!referrer || referrer.suspended) return { outcome: 'referrer_unavailable' as const }

  // A Companion cannot refer their own client. Without this check the
  // Companion earns the platform fee share on bookings they already serve.
  const companion = await ctx.db.get(booking.companionProfileId)
  if (companion?.userId === referral.referrerUserId) {
    await recordReferralFraudSignal(ctx, referral, 'companion_self_dealing', 'The referrer is the Companion on this booking.', now)
    await writeAudit(ctx, {
      actorUserId: referral.referrerUserId,
      action: 'referral.self_dealing_blocked',
      targetType: 'referral',
      targetId: String(referral._id),
      after: { bookingId: String(booking._id) },
    })
    return { outcome: 'companion_self_dealing' as const }
  }

  const existingRewards = await ctx.db.query('referralRewards')
    .withIndex('by_booking', (q: any) => q.eq('bookingId', booking._id))
    .collect()
  if (existingRewards.some((reward: any) => (reward.kind ?? 'lifetime') === 'lifetime')) {
    return { outcome: 'already_credited' as const }
  }

  const rewardBps = referralRewardBpsFor(referral)
  // New lifetime terms pay 5% of the booking subtotal, funded from the 15%
  // platform fee. The grandfathered 68% rate stays on the fee itself.
  const rewardBasisCentavos = rewardBps === LEGACY_REFERRAL_REWARD_BPS
    ? booking.memberBookingFeeCentavos
    : booking.serviceSubtotalCentavos ?? booking.grossPriceCentavos
  if (rewardBasisCentavos === undefined) return { outcome: 'missing_fee' as const }
  const grossAmountCentavos = calculateReferralRewardCentavos(rewardBasisCentavos, rewardBps)
  if (grossAmountCentavos <= 0) return { outcome: 'zero_reward' as const }

  const openSignals = await ctx.db.query('referralFraudSignals')
    .withIndex('by_referral', (q: any) => q.eq('referralId', referral._id))
    .collect()
  const reviewRequired = openSignals.some((signal: any) => signal.status === 'open')
  const account = await getOrCreateUserWalletAccount(ctx, referral.referrerUserId, now)

  // Recover any prior post-release shortfall before adding new credit.
  const debtCentavos = account.referralDebtCentavos ?? 0
  const debtOffsetCentavos = Math.min(debtCentavos, grossAmountCentavos)
  const amountCentavos = grossAmountCentavos - debtOffsetCentavos
  if (debtOffsetCentavos > 0) {
    await ctx.db.patch(account._id, {
      referralDebtCentavos: debtCentavos - debtOffsetCentavos,
      updatedAt: now,
    })
  }
  if (amountCentavos <= 0) return { outcome: 'zero_reward' as const }

  const idempotencyKey = `referral:${String(referral._id)}:lifetime:${String(booking._id)}`
  const applied = await applyWalletTransaction(ctx, {
    kind: 'referral_credit',
    idempotencyKey,
    bookingId: booking._id,
    actorUserId: referral.referrerUserId,
    amountCentavos,
    note: reviewRequired ? 'Referral credit pending review' : 'Referral credit pending release',
    now,
    legs: [
      { accountId: account._id, bucket: 'pending', direction: 'credit', amountCentavos },
    ],
    allowExternalCredit: true,
  })
  if (!applied) return { outcome: 'already_credited' as const }

  const rewardId = await ctx.db.insert('referralRewards', {
    referralId: referral._id,
    referrerUserId: referral.referrerUserId,
    referredUserId: booking.memberId,
    bookingId: booking._id,
    kind: 'lifetime',
    amountCentavos,
    rewardBps,
    platformFeeCentavos: booking.memberBookingFeeCentavos,
    status: 'pending',
    reviewRequired: reviewRequired || undefined,
    releaseEligibleAt: now + REFERRAL_REWARD_HOLD_MS,
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
  })
  if (ctx.scheduler) {
    await ctx.scheduler.runAfter(REFERRAL_REWARD_HOLD_MS, internal.finance.releaseReferralReward, { rewardId })
  }
  await incrementReferralSummary(ctx, referral.referrerUserId, {
    totalRewardedBookings: 1,
    totalPendingCentavos: amountCentavos,
  }, now)

  let bonusCentavos = 0
  const newTerms = referral.termsVersion === REFERRAL_TERMS_VERSION || referral.rewardBps === REFERRAL_REWARD_BPS
  if (referral.rewardedBookings === 0 && newTerms) {
    const program = await getReferralProgram(ctx)
    const bonusCapCentavos = Math.max(0, booking.memberBookingFeeCentavos - grossAmountCentavos)
    const bonusAmountCentavos = Math.min(program.launchBonusCentavos, bonusCapCentavos)
    if (
      program.launchBonusActive
      && bonusAmountCentavos > 0
      && program.launchBonusClaims < program.launchBonusMaxClaims
    ) {
      const bonusKey = `referral:${String(referral._id)}:bonus:${String(booking._id)}`
      const bonusApplied = await applyWalletTransaction(ctx, {
        kind: 'referral_credit',
        idempotencyKey: bonusKey,
        bookingId: booking._id,
        actorUserId: referral.referrerUserId,
        amountCentavos: bonusAmountCentavos,
        note: 'Referral launch bonus pending release',
        now,
        legs: [
          { accountId: account._id, bucket: 'pending', direction: 'credit', amountCentavos: bonusAmountCentavos },
        ],
        allowExternalCredit: true,
      })
      if (bonusApplied) {
        bonusCentavos = bonusAmountCentavos
        const bonusId = await ctx.db.insert('referralRewards', {
          referralId: referral._id,
          referrerUserId: referral.referrerUserId,
          referredUserId: booking.memberId,
          bookingId: booking._id,
          kind: 'launch_bonus',
          amountCentavos: bonusCentavos,
          rewardBps: 0,
          platformFeeCentavos: booking.memberBookingFeeCentavos,
          status: 'pending',
          reviewRequired: reviewRequired || undefined,
          releaseEligibleAt: now + REFERRAL_REWARD_HOLD_MS,
          idempotencyKey: bonusKey,
          createdAt: now,
          updatedAt: now,
        })
        if (ctx.scheduler) {
          await ctx.scheduler.runAfter(REFERRAL_REWARD_HOLD_MS, internal.finance.releaseReferralReward, { rewardId: bonusId })
        }
        const programRow = await ensureReferralProgram(ctx as any, now)
        await ctx.db.patch(programRow._id, {
          launchBonusClaims: programRow.launchBonusClaims + 1,
          updatedAt: now,
        })
        await incrementReferralSummary(ctx, referral.referrerUserId, {
          totalPendingCentavos: bonusCentavos,
        }, now)
        await ctx.db.patch(referral._id, { bonusPaidAt: now })
      }
    }
  }

  await ctx.db.patch(referral._id, {
    rewardedBookings: referral.rewardedBookings + 1,
    // Lifetime referrals never reach a completion cap. The patch also clears
    // the legacy completed status left by the old three-booking program.
    status: 'active',
    updatedAt: now,
  })
  await writeAudit(ctx, {
    actorUserId: referral.referrerUserId,
    action: 'referral.credit_pending',
    targetType: 'referral',
    targetId: String(referral._id),
    after: {
      bookingId: String(booking._id),
      amountCentavos,
      grossAmountCentavos,
      rewardBps,
      bonusCentavos,
      reviewRequired,
    },
  })
  return { outcome: 'credited' as const, amountCentavos, grossAmountCentavos, bonusCentavos, reviewRequired }
}

export const releaseReferralReward = internalMutation({
  args: { rewardId: v.id('referralRewards'), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    const reward = await ctx.db.get(args.rewardId)
    if (!reward || reward.status !== 'pending') return { outcome: 'not_pending' as const }
    const referrer = await ctx.db.get(reward.referrerUserId)
    if (!referrer || referrer.suspended) {
      if (!reward.reviewRequired) {
        await ctx.db.patch(reward._id, { reviewRequired: true, updatedAt: now })
      }
      return { outcome: 'review_required' as const }
    }
    if (reward.releaseEligibleAt && reward.releaseEligibleAt > now) {
      return { outcome: 'not_due' as const }
    }
    const openSignals = await ctx.db.query('referralFraudSignals')
      .withIndex('by_referral', (q: any) => q.eq('referralId', reward.referralId))
      .collect()
    if (openSignals.some((signal: any) => signal.status === 'open')) {
      if (!reward.reviewRequired) {
        await ctx.db.patch(reward._id, { reviewRequired: true, updatedAt: now })
      }
      return { outcome: 'review_required' as const }
    }
    if (reward.reviewRequired) return { outcome: 'review_required' as const }

    const account = await getOrCreateUserWalletAccount(ctx, reward.referrerUserId, now)
    const referralPending = Math.min(account.referralPendingCentavos ?? 0, account.pendingCentavos)
    const amountCentavos = Math.min(reward.amountCentavos, referralPending)
    if (amountCentavos <= 0) {
      await ctx.db.patch(reward._id, { reviewRequired: true, updatedAt: now })
      return { outcome: 'no_pending_balance' as const }
    }
    const shortfallCentavos = reward.amountCentavos - amountCentavos
    if (shortfallCentavos > 0) {
      await ctx.db.patch(account._id, {
        referralDebtCentavos: (account.referralDebtCentavos ?? 0) + shortfallCentavos,
        updatedAt: now,
      })
      await ctx.db.patch(reward._id, { amountCentavos, updatedAt: now })
    }
    const applied = await applyWalletTransaction(ctx, {
      kind: 'referral_credit',
      idempotencyKey: `referral:${String(reward._id)}:release`,
      bookingId: reward.bookingId,
      actorUserId: reward.referrerUserId,
      amountCentavos,
      note: 'Referral credit released',
      now,
      legs: [
        { accountId: account._id, bucket: 'pending', direction: 'debit', amountCentavos },
        { accountId: account._id, bucket: 'available', direction: 'credit', amountCentavos },
      ],
    })
    if (!applied) return { outcome: 'already_released' as const }
    await ctx.db.patch(reward._id, { status: 'credited', releasedAt: now, updatedAt: now })
    await incrementReferralSummary(ctx, reward.referrerUserId, {
      totalPendingCentavos: -(amountCentavos + shortfallCentavos),
      totalEarnedCentavos: amountCentavos,
    }, now)
    await safeReferralNotification(ctx, {
      recipientUserId: reward.referrerUserId,
      kind: 'referral_credit',
      priority: 'standard',
      dedupeKey: `referral:${String(reward._id)}:credited`,
      bookingId: reward.bookingId,
    })
    await writeAudit(ctx, {
      actorUserId: reward.referrerUserId,
      action: 'referral.credit_released',
      targetType: 'referralReward',
      targetId: String(reward._id),
      after: { amountCentavos, kind: reward.kind ?? 'lifetime' },
    })
    return { outcome: 'released' as const, amountCentavos }
  },
})

async function reverseOneReferralReward(
  ctx: { db: any; scheduler?: any },
  reward: Doc<'referralRewards'>,
  now: number,
) {
  if (reward.status === 'reversed') return 0
  const priorStatus = reward.status
  const account = await getOrCreateUserWalletAccount(ctx, reward.referrerUserId, now)
  let amountCentavos = 0
  if (reward.status === 'pending') {
    amountCentavos = Math.min(reward.amountCentavos, account.referralPendingCentavos ?? 0, account.pendingCentavos)
    if (amountCentavos > 0) {
      await applyWalletTransaction(ctx, {
        kind: 'referral_reversal',
        idempotencyKey: `referral:${String(reward._id)}:reverse`,
        bookingId: reward.bookingId,
        actorUserId: reward.referrerUserId,
        amountCentavos,
        note: 'Pending referral credit reversed',
        now,
        legs: [
          { accountId: account._id, bucket: 'pending', direction: 'debit', amountCentavos },
        ],
        allowExternalDebit: true,
      })
    }
  } else {
    amountCentavos = Math.min(reward.amountCentavos, account.referralCreditCentavos ?? 0, account.availableCentavos)
    if (amountCentavos > 0) {
      await applyWalletTransaction(ctx, {
        kind: 'referral_reversal',
        idempotencyKey: `referral:${String(reward._id)}:reverse`,
        bookingId: reward.bookingId,
        actorUserId: reward.referrerUserId,
        amountCentavos,
        note: 'Referral credit reversed',
        now,
        legs: [
          { accountId: account._id, bucket: 'available', direction: 'debit', amountCentavos },
        ],
        allowExternalDebit: true,
      })
    }
  }
  const shortfallCentavos = reward.amountCentavos - amountCentavos
  if (shortfallCentavos > 0) {
    await ctx.db.patch(account._id, {
      referralDebtCentavos: (account.referralDebtCentavos ?? 0) + shortfallCentavos,
      updatedAt: now,
    })
  }
  await ctx.db.patch(reward._id, { status: 'reversed', updatedAt: now })
  await incrementReferralSummary(ctx, reward.referrerUserId, {
    totalPendingCentavos: priorStatus === 'pending' ? -reward.amountCentavos : 0,
    totalEarnedCentavos: priorStatus === 'credited' ? -reward.amountCentavos : 0,
    totalReversedCentavos: reward.amountCentavos,
    totalRewardedBookings: (reward.kind ?? 'lifetime') === 'lifetime' ? -1 : 0,
  }, now)
  const referral = await ctx.db.get(reward.referralId)
  if (referral) {
    if ((reward.kind ?? 'lifetime') === 'lifetime') {
      await ctx.db.patch(referral._id, {
        rewardedBookings: Math.max(0, referral.rewardedBookings - 1),
        status: 'active',
        updatedAt: now,
      })
    } else {
      await ctx.db.patch(referral._id, { bonusPaidAt: undefined, updatedAt: now })
      const programRow = await ctx.db.query('referralProgram')
        .withIndex('by_key', (q: any) => q.eq('key', 'referrals'))
        .unique()
      if (programRow && programRow.launchBonusClaims > 0) {
        await ctx.db.patch(programRow._id, {
          launchBonusClaims: programRow.launchBonusClaims - 1,
          updatedAt: now,
        })
      }
    }
  }
  await safeReferralNotification(ctx, {
    recipientUserId: reward.referrerUserId,
    kind: 'referral_reversal',
    priority: 'attention',
    dedupeKey: `referral:${String(reward._id)}:reversed`,
    bookingId: reward.bookingId,
  })
  await writeAudit(ctx, {
    actorUserId: reward.referrerUserId,
    action: 'referral.credit_reversed',
    targetType: 'referralReward',
    targetId: String(reward._id),
    after: { amountCentavos: reward.amountCentavos, kind: reward.kind ?? 'lifetime' },
  })
  return reward.amountCentavos
}

export async function reverseReferralRewardForBooking(
  ctx: { db: any; scheduler?: any },
  bookingId: Id<'bookings'>,
  now = Date.now(),
) {
  const rewards = await ctx.db.query('referralRewards')
    .withIndex('by_booking', (q: any) => q.eq('bookingId', bookingId))
    .collect()
  let totalCentavos = 0
  for (const reward of rewards) totalCentavos += await reverseOneReferralReward(ctx, reward, now)
  return totalCentavos > 0
    ? { outcome: 'reversed' as const, amountCentavos: totalCentavos }
    : { outcome: 'no_reward' as const }
}

export async function reverseReferralRewardsForReferral(
  ctx: { db: any; scheduler?: any },
  referralId: Id<'referrals'>,
  now = Date.now(),
) {
  const rewards = await ctx.db.query('referralRewards')
    .withIndex('by_referral', (q: any) => q.eq('referralId', referralId))
    .collect()
  let totalCentavos = 0
  for (const reward of rewards) totalCentavos += await reverseOneReferralReward(ctx, reward, now)
  return totalCentavos > 0
    ? { outcome: 'reversed' as const, amountCentavos: totalCentavos }
    : { outcome: 'no_reward' as const }
}

export async function settleBookingFunds(ctx: { db: any }, bookingId: Id<'bookings'>, now = Date.now()) {
  const booking = await ctx.db.get(bookingId) as Doc<'bookings'> | null
  if (!booking || booking.pricingModel !== MEMBER_WALLET_PRICING_MODEL) return { outcome: 'not_v2' as const }
  if (booking.settlementState === 'settled' || booking.settlementState === 'refunded') {
    if (booking.settlementState === 'settled') {
      await creditReferralForSettledBooking(ctx, booking, now)
    }
    return { outcome: booking.settlementState as 'settled' | 'refunded' }
  }
  if (booking.settlementState === 'blocked') return { outcome: 'blocked' as const }
  if (!booking.jointlyCompletedAt || !booking.settlementEligibleAt || booking.settlementEligibleAt > now) return { outcome: 'not_due' as const }
  if (await hasActiveBookingReport(ctx, booking._id)) {
    await ctx.db.patch(booking._id, { settlementState: 'blocked', settlementBlockedAt: booking.settlementBlockedAt ?? now, updatedAt: now })
    return { outcome: 'blocked' as const }
  }

  const companion = await ctx.db.get(booking.companionProfileId)
  if (!companion) throw new ConvexError('Companion profile not found')
  const amounts = requireV2BookingAmounts(booking)
  const [companionAccount, platformAccount] = await Promise.all([
    getOrCreateUserWalletAccount(ctx, companion.userId, now),
    getOrCreateWalletAccount(ctx, { deterministicKey: PLATFORM_REVENUE_ACCOUNT_KEY, accountType: 'platform_revenue', now }),
  ])
  const applied = await applyWalletTransaction(ctx, {
    kind: 'booking_settle',
    idempotencyKey: `booking:${booking._id}:settle`,
    bookingId: booking._id,
    amountCentavos: amounts.total,
    now,
    legs: [
      { accountId: companionAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.companion },
      { accountId: companionAccount._id, bucket: 'available', direction: 'credit', amountCentavos: amounts.companion },
      { accountId: platformAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.fee },
      { accountId: platformAccount._id, bucket: 'available', direction: 'credit', amountCentavos: amounts.fee },
    ],
  })
  await ctx.db.patch(booking._id, { settlementState: 'settled', updatedAt: now })
  const referral = await creditReferralForSettledBooking(ctx, { ...booking, settlementState: 'settled' }, now)
  return { outcome: 'settled' as const, applied, referral }
}

export async function resolveBlockedBookingFunds(
  ctx: { db: any },
  booking: Doc<'bookings'>,
  adminUserId: Id<'users'>,
  resolution: 'release_to_companion' | 'return_to_member',
  note: string,
  now = Date.now(),
) {
  const amounts = requireV2BookingAmounts(booking)
  if (booking.settlementState === 'settled' || booking.settlementState === 'refunded') {
    const expectedResolution = resolution === 'release_to_companion' ? 'released' : 'returned_to_member'
    if (booking.settlementResolution !== expectedResolution) {
      throw new ConvexError('Booking funds were already resolved with a conflicting outcome')
    }
    return { outcome: booking.settlementState, applied: false }
  }
  if (booking.settlementState !== 'blocked') throw new ConvexError('Booking funds are not blocked by an active report')
  const companion = await ctx.db.get(booking.companionProfileId)
  if (!companion) throw new ConvexError('Companion profile not found')
  const memberAccount = await getOrCreateUserWalletAccount(ctx, booking.memberId, now)

  if (resolution === 'release_to_companion') {
    if (!booking.jointlyCompletedAt) throw new ConvexError('Funds can be released to the Companion only after mutual completion')
    const [companionAccount, platformAccount] = await Promise.all([
      getOrCreateUserWalletAccount(ctx, companion.userId, now),
      getOrCreateWalletAccount(ctx, { deterministicKey: PLATFORM_REVENUE_ACCOUNT_KEY, accountType: 'platform_revenue', now }),
    ])
    const applied = await applyWalletTransaction(ctx, {
      kind: 'booking_admin_release',
      idempotencyKey: `booking:${booking._id}:admin-release`,
      bookingId: booking._id,
      actorUserId: adminUserId,
      amountCentavos: amounts.total,
      note,
      now,
      legs: [
        { accountId: companionAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.companion },
        { accountId: companionAccount._id, bucket: 'available', direction: 'credit', amountCentavos: amounts.companion },
        { accountId: platformAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.fee },
        { accountId: platformAccount._id, bucket: 'available', direction: 'credit', amountCentavos: amounts.fee },
      ],
    })
    await creditReferralForSettledBooking(ctx, { ...booking, settlementState: 'settled' }, now)
    return { outcome: 'settled' as const, applied }
  }

  await reverseReferralRewardForBooking(ctx, booking._id, now)
  const legs: WalletLeg[] = booking.jointlyCompletedAt
    ? await refundPendingLegs(ctx, booking, companion.userId, memberAccount._id, amounts, now)
    : [
        { accountId: memberAccount._id, bucket: 'reserved', direction: 'debit', amountCentavos: amounts.total },
        { accountId: memberAccount._id, bucket: 'available', direction: 'credit', amountCentavos: amounts.total },
      ]
  const applied = await applyWalletTransaction(ctx, {
    kind: 'booking_admin_refund',
    idempotencyKey: `booking:${booking._id}:admin-refund`,
    bookingId: booking._id,
    actorUserId: adminUserId,
    amountCentavos: amounts.total,
    note,
    now,
    legs,
  })
  return { outcome: 'refunded' as const, applied }
}

export async function hasActiveBookingReport(ctx: { db: any }, bookingId: Id<'bookings'>) {
  const reports = await ctx.db.query('reports').withIndex('by_booking', (q: any) => q.eq('bookingId', bookingId)).collect()
  return reports.some((report: Doc<'reports'>) => report.status === 'open' || report.status === 'reviewing')
}

export async function settleTopUpInTransaction(
  ctx: { db: any },
  topUp: Doc<'paymongoTopUps'>,
  paidAt: number,
) {
  if (topUp.purpose === 'member_booking_balance') {
    await creditMemberTopUpInTransaction(ctx, topUp, paidAt)
    return
  }
  if (!topUp.companionUserId) throw new ConvexError('Legacy companion-fee top-up is missing its Companion beneficiary')
  const creditKey = `topup:${topUp._id}:credit`
  const existingCredit = await ctx.db.query('platformFeeLedger').withIndex('by_idempotency_key', (q: any) => q.eq('idempotencyKey', creditKey)).unique()
  if (!existingCredit) {
    await ctx.db.insert('platformFeeLedger', {
      companionUserId: topUp.companionUserId,
      direction: 'credit',
      amountCentavos: topUp.amountCentavos,
      currency: BOOKING_CURRENCY,
      kind: 'top_up_credit',
      topUpId: topUp._id,
      idempotencyKey: creditKey,
      createdAt: paidAt,
    })
  }

  let available = await availableBalanceForCompanion(ctx, topUp.companionUserId)
  const pastDue = await ctx.db
    .query('commissionObligations')
    .withIndex('by_companion_due_at', (q: any) => q.eq('companionUserId', topUp.companionUserId).lte('dueAt', paidAt))
    .collect()
  for (const obligation of pastDue) {
    if (available <= 0) break
    const applicationKey = `topup:${topUp._id}:obligation:${obligation._id}`
    const existing = await ctx.db.query('platformFeeLedger').withIndex('by_idempotency_key', (q: any) => q.eq('idempotencyKey', applicationKey)).unique()
    if (existing) continue
    const remaining = await obligationRemainingCentavos(ctx, obligation)
    const applied = Math.min(available, remaining)
    if (applied <= 0) continue
    await ctx.db.insert('platformFeeLedger', {
      companionUserId: topUp.companionUserId,
      direction: 'debit',
      amountCentavos: applied,
      currency: BOOKING_CURRENCY,
      kind: 'commission_collection',
      obligationId: obligation._id,
      topUpId: topUp._id,
      idempotencyKey: applicationKey,
      createdAt: paidAt,
    })
    available -= applied
  }

  await writeAudit(ctx, {
    actorUserId: topUp.companionUserId,
    action: 'platform_fee.top_up_credited',
    targetType: 'paymongoTopUp',
    targetId: String(topUp._id),
    after: { amountCentavos: topUp.amountCentavos, currency: BOOKING_CURRENCY },
  })
}

async function refundPendingLegs(
  ctx: { db: any },
  booking: Doc<'bookings'>,
  companionUserId: Id<'users'>,
  memberAccountId: Id<'walletAccounts'>,
  amounts: { total: number; companion: number; fee: number },
  now: number,
): Promise<WalletLeg[]> {
  const [companionAccount, platformAccount] = await Promise.all([
    getOrCreateUserWalletAccount(ctx, companionUserId, now),
    getOrCreateWalletAccount(ctx, { deterministicKey: PLATFORM_REVENUE_ACCOUNT_KEY, accountType: 'platform_revenue', now }),
  ])
  return [
    { accountId: companionAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.companion },
    { accountId: platformAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.fee },
    { accountId: memberAccountId, bucket: 'available', direction: 'credit', amountCentavos: amounts.total },
  ]
}

export async function applyWalletTransaction(
  ctx: { db: any },
  input: {
    kind: WalletTransactionKind
    idempotencyKey: string
    bookingId?: Id<'bookings'>
    topUpId?: Id<'paymongoTopUps'>
    withdrawalId?: Id<'withdrawals'>
    actorUserId?: Id<'users'>
    amountCentavos: number
    note?: string
    now: number
    legs: WalletLeg[]
    allowExternalCredit?: boolean
    allowExternalDebit?: boolean
  },
) {
  const existing = await ctx.db.query('walletTransactions')
    .withIndex('by_idempotency_key', (q: any) => q.eq('idempotencyKey', input.idempotencyKey))
    .unique()
  if (existing) return false
  assertMoney(input.amountCentavos, 'Transaction amount')
  if (input.legs.length === 0) throw new ConvexError('Wallet transaction requires entries')

  let debits = 0
  let credits = 0
  const deltas = new Map<string, { accountId: Id<'walletAccounts'>; bucket: WalletBucket; delta: number }>()
  const referralDeltas = new Map<Id<'walletAccounts'>, { pending: number; credit: number }>()
  for (const leg of input.legs) {
    assertMoney(leg.amountCentavos, 'Wallet entry amount')
    if (leg.direction === 'debit') debits += leg.amountCentavos
    else credits += leg.amountCentavos
    const key = `${leg.accountId}:${leg.bucket}`
    const current = deltas.get(key)
    deltas.set(key, {
      accountId: leg.accountId,
      bucket: leg.bucket,
      delta: (current?.delta ?? 0) + (leg.direction === 'credit' ? leg.amountCentavos : -leg.amountCentavos),
    })

    const referralCurrent = referralDeltas.get(leg.accountId) ?? { pending: 0, credit: 0 }
    const isReferralKind = input.kind === 'referral_credit' || input.kind === 'referral_reversal'
    if (leg.bucket === 'pending' && isReferralKind) {
      referralCurrent.pending += leg.direction === 'credit' ? leg.amountCentavos : -leg.amountCentavos
    }
    if (leg.bucket === 'available') {
      if (isReferralKind) {
        referralCurrent.credit += leg.direction === 'credit' ? leg.amountCentavos : -leg.amountCentavos
      } else if (leg.direction === 'debit') {
        // Referral credit is treated as spent first. A later reversal can then
        // create debt instead of taking a top-up or Companion earnings.
        referralCurrent.credit -= leg.amountCentavos
      }
    }
    referralDeltas.set(leg.accountId, referralCurrent)
  }
  if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits)) throw new ConvexError('Wallet transaction total is outside supported bounds')
  const externallyBalanced = input.allowExternalCredit
    ? debits === 0 && credits === input.amountCentavos
    : input.allowExternalDebit
      ? credits === 0 && debits === input.amountCentavos
      : debits === credits && debits === input.amountCentavos
  if (!externallyBalanced) {
    throw new ConvexError('Wallet transaction entries are not balanced')
  }

  const patches = new Map<Id<'walletAccounts'>, Doc<'walletAccounts'>>()
  for (const change of deltas.values()) {
    const account = patches.get(change.accountId) ?? await ctx.db.get(change.accountId) as Doc<'walletAccounts'> | null
    if (!account) throw new ConvexError('Wallet account not found')
    const field = bucketField(change.bucket)
    const next = account[field] + change.delta
    assertMoney(next, 'Wallet balance')
    patches.set(change.accountId, { ...account, [field]: next, updatedAt: input.now })
  }

  const transactionId = await ctx.db.insert('walletTransactions', {
    kind: input.kind,
    idempotencyKey: input.idempotencyKey,
    bookingId: input.bookingId,
    topUpId: input.topUpId,
    withdrawalId: input.withdrawalId,
    actorUserId: input.actorUserId,
    amountCentavos: input.amountCentavos,
    currency: BOOKING_CURRENCY,
    note: input.note,
    createdAt: input.now,
  })
  for (const leg of input.legs) {
    await ctx.db.insert('walletEntries', { transactionId, ...leg, createdAt: input.now })
  }
  for (const [accountId, account] of patches) {
    const referral = referralDeltas.get(accountId) ?? { pending: 0, credit: 0 }
    await ctx.db.patch(accountId, {
      availableCentavos: account.availableCentavos,
      reservedCentavos: account.reservedCentavos,
      pendingCentavos: account.pendingCentavos,
      referralPendingCentavos: Math.max(0, (account.referralPendingCentavos ?? 0) + referral.pending),
      referralCreditCentavos: Math.max(0, (account.referralCreditCentavos ?? 0) + referral.credit),
      updatedAt: input.now,
    })
  }
  return true
}

export async function getOrCreateWalletAccount(
  ctx: { db: any },
  input: { deterministicKey: string; accountType: WalletAccountType; ownerUserId?: Id<'users'>; now: number },
) {
  const existing = await findWalletAccount(ctx, input.deterministicKey)
  if (existing) {
    if (existing.accountType !== input.accountType || existing.ownerUserId !== input.ownerUserId) {
      throw new ConvexError('Wallet account key is attached to the wrong beneficiary')
    }
    return existing
  }
  const accountId = await ctx.db.insert('walletAccounts', {
    deterministicKey: input.deterministicKey,
    accountType: input.accountType,
    ownerUserId: input.ownerUserId,
    currency: BOOKING_CURRENCY,
    availableCentavos: 0,
    reservedCentavos: 0,
    pendingCentavos: 0,
    referralPendingCentavos: 0,
    referralCreditCentavos: 0,
    createdAt: input.now,
    updatedAt: input.now,
  })
  return await ctx.db.get(accountId) as Doc<'walletAccounts'>
}

export async function findWalletAccount(ctx: { db: any }, deterministicKey: string) {
  return await ctx.db.query('walletAccounts')
    .withIndex('by_deterministic_key', (q: any) => q.eq('deterministicKey', deterministicKey))
    .unique() as Doc<'walletAccounts'> | null
}

export async function readUnifiedWalletBalance(ctx: { db: any }, userId: Id<'users'>) {
  const [wallet, legacyEarnings] = await Promise.all([
    findWalletAccount(ctx, memberBookingAccountKey(userId)),
    findWalletAccount(ctx, companionEarningsAccountKey(userId)),
  ])
  return {
    availableCentavos: (wallet?.availableCentavos ?? 0) + (legacyEarnings?.availableCentavos ?? 0),
    reservedCentavos: (wallet?.reservedCentavos ?? 0) + (legacyEarnings?.reservedCentavos ?? 0),
    pendingCentavos: (wallet?.pendingCentavos ?? 0) + (legacyEarnings?.pendingCentavos ?? 0),
  }
}

export async function getOrCreateUserWalletAccount(ctx: { db: any }, userId: Id<'users'>, now = Date.now()) {
  const wallet = await getOrCreateWalletAccount(ctx, {
    deterministicKey: memberBookingAccountKey(userId),
    accountType: 'member_booking',
    ownerUserId: userId,
    now,
  })
  const legacyEarnings = await findWalletAccount(ctx, companionEarningsAccountKey(userId))
  if (!legacyEarnings) return wallet

  const balances = [
    ['available', legacyEarnings.availableCentavos],
    ['reserved', legacyEarnings.reservedCentavos],
    ['pending', legacyEarnings.pendingCentavos],
  ] as const
  const amountCentavos = balances.reduce((total, [, amount]) => total + amount, 0)
  if (amountCentavos === 0) return wallet

  const legs: WalletLeg[] = balances.flatMap(([bucket, amount]) => amount > 0 ? [
    { accountId: legacyEarnings._id, bucket, direction: 'debit' as const, amountCentavos: amount },
    { accountId: wallet._id, bucket, direction: 'credit' as const, amountCentavos: amount },
  ] : [])
  await applyWalletTransaction(ctx, {
    kind: 'wallet_consolidation',
    idempotencyKey: `wallet:${String(userId)}:consolidate-companion-earnings`,
    actorUserId: userId,
    amountCentavos,
    note: 'Consolidated booking balance and Companion earnings into one wallet',
    now,
    legs,
  })
  return await ctx.db.get(wallet._id) as Doc<'walletAccounts'>
}

function requireV2BookingAmounts(booking: Doc<'bookings'>) {
  if (booking.pricingModel !== MEMBER_WALLET_PRICING_MODEL || booking.currency !== BOOKING_CURRENCY) {
    throw new ConvexError('Booking does not use the member wallet')
  }
  const total = booking.memberTotalCentavos
  const companion = booking.companionEarningsCentavos
  const fee = booking.memberBookingFeeCentavos
  if (total === undefined || companion === undefined || fee === undefined || total !== companion + fee) {
    throw new ConvexError('Booking wallet amounts are incomplete')
  }
  assertMoney(total, 'Member total')
  assertMoney(companion, 'Companion entitlement')
  assertMoney(fee, 'Member booking fee')
  return { total, companion, fee }
}

function memberBookingAccountKey(userId: Id<'users'>) {
  return `member:${userId}:booking`
}

export function companionEarningsAccountKey(userId: Id<'users'>) {
  return `companion:${userId}:earnings`
}

function bucketField(bucket: WalletBucket): 'availableCentavos' | 'reservedCentavos' | 'pendingCentavos' {
  if (bucket === 'available') return 'availableCentavos'
  if (bucket === 'reserved') return 'reservedCentavos'
  return 'pendingCentavos'
}

function assertMoney(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new ConvexError(`${label} must be a nonnegative safe integer of centavos`)
}

async function obligationRemainingCentavos(ctx: { db: any }, obligation: Doc<'commissionObligations'>) {
  const entries = await ctx.db.query('platformFeeLedger').withIndex('by_obligation', (q: any) => q.eq('obligationId', obligation._id)).collect()
  const paid = entries.reduce((sum: number, entry: Doc<'platformFeeLedger'>) => (
    entry.direction === 'debit' ? sum + entry.amountCentavos : sum
  ), 0)
  return Math.max(0, obligation.amountCentavos - paid)
}

async function availableBalanceForCompanion(ctx: { db: any }, companionUserId: Id<'users'>) {
  const entries = await ctx.db.query('platformFeeLedger').withIndex('by_companion', (q: any) => q.eq('companionUserId', companionUserId)).collect()
  return entries.reduce((balance: number, entry: Doc<'platformFeeLedger'>) => (
    balance + (entry.direction === 'credit' ? entry.amountCentavos : -entry.amountCentavos)
  ), 0)
}

export function mostRecentSaturdayManilaCutoff(timestamp: number) {
  const next = nextSaturdayManilaCutoff(timestamp)
  return next - 7 * 24 * 60 * 60 * 1_000
}
