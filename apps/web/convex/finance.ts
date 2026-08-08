import { BOOKING_CURRENCY, MEMBER_WALLET_PRICING_MODEL, MEMBER_WALLET_SETTLEMENT_DELAY_MS, nextSaturdayManilaCutoff } from '@lets-be-friends/shared'
import { internalMutation, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { getViewer, writeAudit } from './lib'

const COLLECTION_BATCH_SIZE = 200
const SETTLEMENT_BATCH_SIZE = 100
const PLATFORM_REVENUE_ACCOUNT_KEY = 'platform:booking-revenue'

type WalletBucket = 'available' | 'reserved' | 'pending'
type WalletAccountType = 'member_booking' | 'host_earnings' | 'platform_revenue'
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

export function memberWalletTestCreditEnabled() {
  return process.env.MEMBER_WALLET_TEST_CREDIT_ENABLED?.trim().toLowerCase() === 'true'
}

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return null
    if (viewer.suspended) throw new Error('Account is suspended')
    const host = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    if (!host) return null

    const now = Date.now()
    const nextCutoff = nextSaturdayManilaCutoff(now)
    const [ledger, obligations, topUps, earningsAccount] = await Promise.all([
      ctx.db.query('platformFeeLedger').withIndex('by_host_created_at', (q) => q.eq('hostUserId', viewer._id)).order('desc').collect(),
      ctx.db.query('commissionObligations').withIndex('by_host_due_at', (q) => q.eq('hostUserId', viewer._id)).collect(),
      ctx.db.query('paymongoTopUps').withIndex('by_host_created_at', (q) => q.eq('hostUserId', viewer._id)).order('desc').take(10),
      findWalletAccount(ctx, hostEarningsAccountKey(viewer._id)),
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
      pendingEarningsCentavos: earningsAccount?.pendingCentavos ?? 0,
      availableEarningsCentavos: earningsAccount?.availableCentavos ?? 0,
      payoutsAvailable: false,
      payoutNotice: 'Payouts await provider activation. Available earnings remain an internal balance.',
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
    if (viewer.suspended) throw new Error('Account is suspended')
    const account = await findWalletAccount(ctx, memberBookingAccountKey(viewer._id))
    const topUps = await ctx.db.query('paymongoTopUps')
      .withIndex('by_beneficiary_created_at', (q) => q.eq('beneficiaryUserId', viewer._id))
      .order('desc')
      .take(10)
    return {
      currency: BOOKING_CURRENCY,
      enabled: memberWalletV2Enabled(),
      testCreditEnabled: memberWalletTestCreditEnabled(),
      availableCentavos: account?.availableCentavos ?? 0,
      reservedCentavos: account?.reservedCentavos ?? 0,
      pendingCentavos: account?.pendingCentavos ?? 0,
      topUps: topUps.filter((topUp) => topUp.purpose === 'member_booking_balance'),
    }
  },
})

export const addTestCredit = mutation({
  args: { amountCentavos: v.number() },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    if (!viewer) throw new Error('Sign in to add test balance')
    if (viewer.suspended) throw new Error('Account is suspended')
    if (!memberWalletTestCreditEnabled()) throw new Error('Test wallet credit is not enabled on this server')
    assertMoney(args.amountCentavos, 'Test credit amount')
    if (args.amountCentavos < 100 || args.amountCentavos > 10_000_000) {
      throw new Error('Test credit must be between PHP 1.00 and PHP 100,000.00')
    }

    const now = Date.now()
    const account = await getOrCreateWalletAccount(ctx, {
      deterministicKey: memberBookingAccountKey(viewer._id),
      accountType: 'member_booking',
      ownerUserId: viewer._id,
      now,
    })
    await applyWalletTransaction(ctx, {
      kind: 'test_member_credit',
      idempotencyKey: `test-credit:${viewer._id}:${now}`,
      actorUserId: viewer._id,
      amountCentavos: args.amountCentavos,
      note: 'Test-only member wallet credit',
      now,
      allowExternalCredit: true,
      legs: [{ accountId: account._id, bucket: 'available', direction: 'credit', amountCentavos: args.amountCentavos }],
    })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'member_wallet.test_credit_added',
      targetType: 'walletAccount',
      targetId: String(account._id),
      after: { amountCentavos: args.amountCentavos, currency: BOOKING_CURRENCY },
    })
    return { amountCentavos: args.amountCentavos, availableCentavos: account.availableCentavos + args.amountCentavos }
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
    const availableByHost = new Map<string, number>()
    let collectedCentavos = 0

    for (const obligation of page.page) {
      const idempotencyKey = `weekly:${cycleAt}:${obligation._id}`
      const existing = await ctx.db.query('platformFeeLedger').withIndex('by_idempotency_key', (q) => q.eq('idempotencyKey', idempotencyKey)).unique()
      if (existing) continue

      const remainingCentavos = await obligationRemainingCentavos(ctx, obligation)
      if (remainingCentavos <= 0) continue
      const hostKey = String(obligation.hostUserId)
      const cachedAvailable = availableByHost.get(hostKey)
      const available: number = cachedAvailable === undefined
        ? await availableBalanceForHost(ctx, obligation.hostUserId)
        : cachedAvailable
      const appliedCentavos = Math.min(available, remainingCentavos)
      if (appliedCentavos <= 0) {
        availableByHost.set(hostKey, available)
        continue
      }

      await ctx.db.insert('platformFeeLedger', {
        hostUserId: obligation.hostUserId,
        direction: 'debit',
        amountCentavos: appliedCentavos,
        currency: BOOKING_CURRENCY,
        kind: 'commission_collection',
        obligationId: obligation._id,
        idempotencyKey,
        createdAt: now,
      })
      availableByHost.set(hostKey, available - appliedCentavos)
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

export async function pastDueCommissionCentavos(ctx: { db: any }, hostUserId: Id<'users'>, now = Date.now()) {
  const obligations = await ctx.db
    .query('commissionObligations')
    .withIndex('by_host_due_at', (q: any) => q.eq('hostUserId', hostUserId).lte('dueAt', now))
    .collect()
  let total = 0
  for (const obligation of obligations) total += await obligationRemainingCentavos(ctx, obligation)
  return total
}

export async function availableMemberBookingBalance(ctx: { db: any }, memberId: Id<'users'>) {
  const account = await findWalletAccount(ctx, memberBookingAccountKey(memberId))
  return account?.availableCentavos ?? 0
}

export async function creditMemberTopUpInTransaction(
  ctx: { db: any },
  topUp: Doc<'paymongoTopUps'>,
  paidAt: number,
) {
  if (topUp.purpose !== 'member_booking_balance' || !topUp.beneficiaryUserId) {
    throw new Error('Top-up is not a member booking-balance top-up')
  }
  const account = await getOrCreateWalletAccount(ctx, {
    deterministicKey: memberBookingAccountKey(topUp.beneficiaryUserId),
    accountType: 'member_booking',
    ownerUserId: topUp.beneficiaryUserId,
    now: paidAt,
  })
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
  const memberAccount = await getOrCreateWalletAccount(ctx, {
    deterministicKey: memberBookingAccountKey(booking.memberId),
    accountType: 'member_booking',
    ownerUserId: booking.memberId,
    now,
  })
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
  if (booking.settlementState === 'refunded') throw new Error('Refunded booking funds cannot be released again')
  const amounts = requireV2BookingAmounts(booking)
  const memberAccount = await getOrCreateWalletAccount(ctx, {
    deterministicKey: memberBookingAccountKey(booking.memberId),
    accountType: 'member_booking',
    ownerUserId: booking.memberId,
    now,
  })
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
  ctx: { db: any; scheduler: any },
  booking: Doc<'bookings'>,
  hostUserId: Id<'users'>,
  now = Date.now(),
) {
  if (booking.settlementState === 'refunded') throw new Error('Refunded bookings cannot allocate completion funds')
  const amounts = requireV2BookingAmounts(booking)
  const [memberAccount, hostAccount, platformAccount] = await Promise.all([
    getOrCreateWalletAccount(ctx, {
      deterministicKey: memberBookingAccountKey(booking.memberId), accountType: 'member_booking', ownerUserId: booking.memberId, now,
    }),
    getOrCreateWalletAccount(ctx, {
      deterministicKey: hostEarningsAccountKey(hostUserId), accountType: 'host_earnings', ownerUserId: hostUserId, now,
    }),
    getOrCreateWalletAccount(ctx, {
      deterministicKey: PLATFORM_REVENUE_ACCOUNT_KEY, accountType: 'platform_revenue', now,
    }),
  ])
  const applied = await applyWalletTransaction(ctx, {
    kind: 'booking_complete',
    idempotencyKey: `booking:${booking._id}:complete`,
    bookingId: booking._id,
    actorUserId: hostUserId,
    amountCentavos: amounts.total,
    now,
    legs: [
      { accountId: memberAccount._id, bucket: 'reserved', direction: 'debit', amountCentavos: amounts.total },
      { accountId: hostAccount._id, bucket: 'pending', direction: 'credit', amountCentavos: amounts.host },
      { accountId: platformAccount._id, bucket: 'pending', direction: 'credit', amountCentavos: amounts.fee },
    ],
  })
  const settlementEligibleAt = now + MEMBER_WALLET_SETTLEMENT_DELAY_MS
  if (applied) await ctx.scheduler.runAt(settlementEligibleAt, internal.finance.settleBooking, { bookingId: booking._id })
  return { applied, settlementEligibleAt }
}

export async function settleBookingFunds(ctx: { db: any }, bookingId: Id<'bookings'>, now = Date.now()) {
  const booking = await ctx.db.get(bookingId) as Doc<'bookings'> | null
  if (!booking || booking.pricingModel !== MEMBER_WALLET_PRICING_MODEL) return { outcome: 'not_v2' as const }
  if (booking.settlementState === 'settled' || booking.settlementState === 'refunded') return { outcome: booking.settlementState as 'settled' | 'refunded' }
  if (booking.settlementState === 'blocked') return { outcome: 'blocked' as const }
  if (!booking.jointlyCompletedAt || !booking.settlementEligibleAt || booking.settlementEligibleAt > now) return { outcome: 'not_due' as const }
  if (await hasActiveBookingReport(ctx, booking._id)) {
    await ctx.db.patch(booking._id, { settlementState: 'blocked', settlementBlockedAt: booking.settlementBlockedAt ?? now, updatedAt: now })
    return { outcome: 'blocked' as const }
  }

  const host = await ctx.db.get(booking.hostProfileId)
  if (!host) throw new Error('Friend Host profile not found')
  const amounts = requireV2BookingAmounts(booking)
  const [hostAccount, platformAccount] = await Promise.all([
    getOrCreateWalletAccount(ctx, {
      deterministicKey: hostEarningsAccountKey(host.userId), accountType: 'host_earnings', ownerUserId: host.userId, now,
    }),
    getOrCreateWalletAccount(ctx, { deterministicKey: PLATFORM_REVENUE_ACCOUNT_KEY, accountType: 'platform_revenue', now }),
  ])
  const applied = await applyWalletTransaction(ctx, {
    kind: 'booking_settle',
    idempotencyKey: `booking:${booking._id}:settle`,
    bookingId: booking._id,
    amountCentavos: amounts.total,
    now,
    legs: [
      { accountId: hostAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.host },
      { accountId: hostAccount._id, bucket: 'available', direction: 'credit', amountCentavos: amounts.host },
      { accountId: platformAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.fee },
      { accountId: platformAccount._id, bucket: 'available', direction: 'credit', amountCentavos: amounts.fee },
    ],
  })
  await ctx.db.patch(booking._id, { settlementState: 'settled', updatedAt: now })
  return { outcome: 'settled' as const, applied }
}

export async function resolveBlockedBookingFunds(
  ctx: { db: any },
  booking: Doc<'bookings'>,
  adminUserId: Id<'users'>,
  resolution: 'release_to_host' | 'return_to_member',
  note: string,
  now = Date.now(),
) {
  const amounts = requireV2BookingAmounts(booking)
  if (booking.settlementState === 'settled' || booking.settlementState === 'refunded') {
    const expectedResolution = resolution === 'release_to_host' ? 'released' : 'returned_to_member'
    if (booking.settlementResolution !== expectedResolution) {
      throw new Error('Booking funds were already resolved with a conflicting outcome')
    }
    return { outcome: booking.settlementState, applied: false }
  }
  if (booking.settlementState !== 'blocked') throw new Error('Booking funds are not blocked by an active report')
  const host = await ctx.db.get(booking.hostProfileId)
  if (!host) throw new Error('Friend Host profile not found')
  const memberAccount = await getOrCreateWalletAccount(ctx, {
    deterministicKey: memberBookingAccountKey(booking.memberId), accountType: 'member_booking', ownerUserId: booking.memberId, now,
  })

  if (resolution === 'release_to_host') {
    if (!booking.jointlyCompletedAt) throw new Error('Funds can be released to the Friend Host only after mutual completion')
    const [hostAccount, platformAccount] = await Promise.all([
      getOrCreateWalletAccount(ctx, {
        deterministicKey: hostEarningsAccountKey(host.userId), accountType: 'host_earnings', ownerUserId: host.userId, now,
      }),
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
        { accountId: hostAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.host },
        { accountId: hostAccount._id, bucket: 'available', direction: 'credit', amountCentavos: amounts.host },
        { accountId: platformAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.fee },
        { accountId: platformAccount._id, bucket: 'available', direction: 'credit', amountCentavos: amounts.fee },
      ],
    })
    return { outcome: 'settled' as const, applied }
  }

  const legs: WalletLeg[] = booking.jointlyCompletedAt
    ? await refundPendingLegs(ctx, booking, host.userId, memberAccount._id, amounts, now)
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
  if (!topUp.hostUserId) throw new Error('Legacy host-fee top-up is missing its Friend Host beneficiary')
  const creditKey = `topup:${topUp._id}:credit`
  const existingCredit = await ctx.db.query('platformFeeLedger').withIndex('by_idempotency_key', (q: any) => q.eq('idempotencyKey', creditKey)).unique()
  if (!existingCredit) {
    await ctx.db.insert('platformFeeLedger', {
      hostUserId: topUp.hostUserId,
      direction: 'credit',
      amountCentavos: topUp.amountCentavos,
      currency: BOOKING_CURRENCY,
      kind: 'top_up_credit',
      topUpId: topUp._id,
      idempotencyKey: creditKey,
      createdAt: paidAt,
    })
  }

  let available = await availableBalanceForHost(ctx, topUp.hostUserId)
  const pastDue = await ctx.db
    .query('commissionObligations')
    .withIndex('by_host_due_at', (q: any) => q.eq('hostUserId', topUp.hostUserId).lte('dueAt', paidAt))
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
      hostUserId: topUp.hostUserId,
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
    actorUserId: topUp.hostUserId,
    action: 'platform_fee.top_up_credited',
    targetType: 'paymongoTopUp',
    targetId: String(topUp._id),
    after: { amountCentavos: topUp.amountCentavos, currency: BOOKING_CURRENCY },
  })
}

async function refundPendingLegs(
  ctx: { db: any },
  booking: Doc<'bookings'>,
  hostUserId: Id<'users'>,
  memberAccountId: Id<'walletAccounts'>,
  amounts: { total: number; host: number; fee: number },
  now: number,
): Promise<WalletLeg[]> {
  const [hostAccount, platformAccount] = await Promise.all([
    getOrCreateWalletAccount(ctx, {
      deterministicKey: hostEarningsAccountKey(hostUserId), accountType: 'host_earnings', ownerUserId: hostUserId, now,
    }),
    getOrCreateWalletAccount(ctx, { deterministicKey: PLATFORM_REVENUE_ACCOUNT_KEY, accountType: 'platform_revenue', now }),
  ])
  return [
    { accountId: hostAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.host },
    { accountId: platformAccount._id, bucket: 'pending', direction: 'debit', amountCentavos: amounts.fee },
    { accountId: memberAccountId, bucket: 'available', direction: 'credit', amountCentavos: amounts.total },
  ]
}

async function applyWalletTransaction(
  ctx: { db: any },
  input: {
    kind: WalletTransactionKind
    idempotencyKey: string
    bookingId?: Id<'bookings'>
    topUpId?: Id<'paymongoTopUps'>
    actorUserId?: Id<'users'>
    amountCentavos: number
    note?: string
    now: number
    legs: WalletLeg[]
    allowExternalCredit?: boolean
  },
) {
  const existing = await ctx.db.query('walletTransactions')
    .withIndex('by_idempotency_key', (q: any) => q.eq('idempotencyKey', input.idempotencyKey))
    .unique()
  if (existing) return false
  assertMoney(input.amountCentavos, 'Transaction amount')
  if (input.legs.length === 0) throw new Error('Wallet transaction requires entries')

  let debits = 0
  let credits = 0
  const deltas = new Map<string, { accountId: Id<'walletAccounts'>; bucket: WalletBucket; delta: number }>()
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
  }
  if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits)) throw new Error('Wallet transaction total is outside supported bounds')
  if (input.allowExternalCredit ? debits !== 0 || credits !== input.amountCentavos : debits !== credits || debits !== input.amountCentavos) {
    throw new Error('Wallet transaction entries are not balanced')
  }

  const patches = new Map<Id<'walletAccounts'>, Doc<'walletAccounts'>>()
  for (const change of deltas.values()) {
    const account = patches.get(change.accountId) ?? await ctx.db.get(change.accountId) as Doc<'walletAccounts'> | null
    if (!account) throw new Error('Wallet account not found')
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
    await ctx.db.patch(accountId, {
      availableCentavos: account.availableCentavos,
      reservedCentavos: account.reservedCentavos,
      pendingCentavos: account.pendingCentavos,
      updatedAt: input.now,
    })
  }
  return true
}

async function getOrCreateWalletAccount(
  ctx: { db: any },
  input: { deterministicKey: string; accountType: WalletAccountType; ownerUserId?: Id<'users'>; now: number },
) {
  const existing = await findWalletAccount(ctx, input.deterministicKey)
  if (existing) {
    if (existing.accountType !== input.accountType || existing.ownerUserId !== input.ownerUserId) {
      throw new Error('Wallet account key is attached to the wrong beneficiary')
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
    createdAt: input.now,
    updatedAt: input.now,
  })
  return await ctx.db.get(accountId) as Doc<'walletAccounts'>
}

async function findWalletAccount(ctx: { db: any }, deterministicKey: string) {
  return await ctx.db.query('walletAccounts')
    .withIndex('by_deterministic_key', (q: any) => q.eq('deterministicKey', deterministicKey))
    .unique() as Doc<'walletAccounts'> | null
}

function requireV2BookingAmounts(booking: Doc<'bookings'>) {
  if (booking.pricingModel !== MEMBER_WALLET_PRICING_MODEL || booking.currency !== BOOKING_CURRENCY) {
    throw new Error('Booking does not use the member wallet')
  }
  const total = booking.memberTotalCentavos
  const host = booking.hostEntitlementCentavos
  const fee = booking.memberBookingFeeCentavos
  if (total === undefined || host === undefined || fee === undefined || total !== host + fee) {
    throw new Error('Booking wallet amounts are incomplete')
  }
  assertMoney(total, 'Member total')
  assertMoney(host, 'Friend Host entitlement')
  assertMoney(fee, 'Member booking fee')
  return { total, host, fee }
}

function memberBookingAccountKey(userId: Id<'users'>) {
  return `member:${userId}:booking`
}

function hostEarningsAccountKey(userId: Id<'users'>) {
  return `host:${userId}:earnings`
}

function bucketField(bucket: WalletBucket): 'availableCentavos' | 'reservedCentavos' | 'pendingCentavos' {
  if (bucket === 'available') return 'availableCentavos'
  if (bucket === 'reserved') return 'reservedCentavos'
  return 'pendingCentavos'
}

function assertMoney(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative safe integer of centavos`)
}

async function obligationRemainingCentavos(ctx: { db: any }, obligation: Doc<'commissionObligations'>) {
  const entries = await ctx.db.query('platformFeeLedger').withIndex('by_obligation', (q: any) => q.eq('obligationId', obligation._id)).collect()
  const paid = entries.reduce((sum: number, entry: Doc<'platformFeeLedger'>) => (
    entry.direction === 'debit' ? sum + entry.amountCentavos : sum
  ), 0)
  return Math.max(0, obligation.amountCentavos - paid)
}

async function availableBalanceForHost(ctx: { db: any }, hostUserId: Id<'users'>) {
  const entries = await ctx.db.query('platformFeeLedger').withIndex('by_host', (q: any) => q.eq('hostUserId', hostUserId)).collect()
  return entries.reduce((balance: number, entry: Doc<'platformFeeLedger'>) => (
    balance + (entry.direction === 'credit' ? entry.amountCentavos : -entry.amountCentavos)
  ), 0)
}

export function mostRecentSaturdayManilaCutoff(timestamp: number) {
  const next = nextSaturdayManilaCutoff(timestamp)
  return next - 7 * 24 * 60 * 60 * 1_000
}
