import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
const TOTAL = 57_500
const SUBTOTAL = 50_000
const FEE = 7_500
let previousFlag: string | undefined

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

beforeEach(() => {
  previousFlag = process.env.MEMBER_WALLET_V2_ENABLED
  process.env.MEMBER_WALLET_V2_ENABLED = 'true'
})

afterEach(() => {
  if (previousFlag === undefined) delete process.env.MEMBER_WALLET_V2_ENABLED
  else process.env.MEMBER_WALLET_V2_ENABLED = previousFlag
})

async function seed(t: ReturnType<typeof convexTest>, availableCentavos = TOTAL) {
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
    const memberId = await ctx.db.insert('users', {
      clerkUserId: 'wallet-member', displayName: 'Wallet Member', role: 'member', ...identity,
    })
    const companionUserId = await ctx.db.insert('users', {
      clerkUserId: 'wallet-companion', displayName: 'Wallet Companion', role: 'companion', ...identity,
    })
    const outsiderId = await ctx.db.insert('users', {
      clerkUserId: 'wallet-outsider', displayName: 'Wallet Outsider', role: 'member', ...identity,
    })
    const reviewerId = await ctx.db.insert('users', {
      clerkUserId: 'wallet-reviewer', displayName: 'Wallet Reviewer', role: 'reviewer', ...identity,
    })
    const adminId = await ctx.db.insert('users', {
      clerkUserId: 'wallet-admin', displayName: 'Wallet Admin', role: 'admin', ...identity,
    })
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Wallet Companion',
      intro: 'A verified companion for member-wallet tests.',
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
    const memberAccountId = await ctx.db.insert('walletAccounts', {
      deterministicKey: `member:${memberId}:booking`,
      accountType: 'member_booking',
      ownerUserId: memberId,
      currency: 'PHP',
      availableCentavos,
      reservedCentavos: 0,
      pendingCentavos: 0,
      createdAt: now,
      updatedAt: now,
    })
    return { now, memberId, companionUserId, outsiderId, reviewerId, adminId, companionProfileId, memberAccountId }
  })
}

async function createBooking(t: ReturnType<typeof convexTest>, companionProfileId: any) {
  return await t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookings.createDraft, {
    companionProfileId,
    category: 'Coffee or meal companion',
    mode: 'in_person',
    requestedAt: Date.now() + 86_400_000,
    durationMinutes: 60,
  })
}

async function endBookingSchedule(t: ReturnType<typeof convexTest>, bookingId: any) {
  await t.run(async (ctx) => {
    const booking = await ctx.db.get(bookingId)
    if (!booking) throw new Error('Booking not found')
    await ctx.db.patch(bookingId, {
      requestedAt: Date.now() - booking.durationMinutes * 60_000 - 1_000,
      updatedAt: Date.now(),
    })
  })
}

async function acceptAndComplete(t: ReturnType<typeof convexTest>, bookingId: any) {
  await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.companionDecision, { bookingId, decision: 'accepted' })
  await endBookingSchedule(t, bookingId)
  await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookingEvidence.skip, { bookingId, warningAcknowledged: true })
  await t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookingEvidence.skip, { bookingId, warningAcknowledged: true })
  await t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookings.markCompleted, { bookingId })
  await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.markCompleted, { bookingId })
}

describe('member-wallet booking ledger', () => {
  it('requires exact available balance, reserves on acceptance, and releases cancellation idempotently', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createBooking(t, ids.companionProfileId)
    expect(created).toMatchObject({
      serviceSubtotalCentavos: SUBTOTAL,
      memberBookingFeeCentavos: FEE,
      memberTotalCentavos: TOTAL,
      companionEarningsCentavos: SUBTOTAL,
    })

    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.companionDecision, { bookingId: created.bookingId, decision: 'accepted' })
    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.companionDecision, { bookingId: created.bookingId, decision: 'accepted' })
    let state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      account: await ctx.db.get(ids.memberAccountId),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.booking?.settlementState).toBe('reserved')
    expect(state.account).toMatchObject({ availableCentavos: 0, reservedCentavos: TOTAL })
    expect(state.transactions.filter((row) => row.kind === 'booking_reserve')).toHaveLength(1)

    await t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookings.cancel, { bookingId: created.bookingId })
    await t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookings.cancel, { bookingId: created.bookingId })
    state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      account: await ctx.db.get(ids.memberAccountId),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.booking?.settlementState).toBe('refunded')
    expect(state.account).toMatchObject({ availableCentavos: TOTAL, reservedCentavos: 0 })
    expect(state.transactions.filter((row) => row.kind === 'booking_release')).toHaveLength(1)
  })

  it('rejects insufficient send balance and atomically leaves request_sent unchanged if acceptance recheck fails', async () => {
    const insufficient = createTest()
    const lowIds = await seed(insufficient, TOTAL - 1)
    await expect(createBooking(insufficient, lowIds.companionProfileId)).rejects.toThrow('Insufficient booking balance')
    expect(await insufficient.run(async (ctx) => ctx.db.query('bookings').collect())).toHaveLength(0)

    const t = createTest()
    const ids = await seed(t)
    const created = await createBooking(t, ids.companionProfileId)
    await t.run(async (ctx) => ctx.db.patch(ids.memberAccountId, { availableCentavos: TOTAL - 1, updatedAt: Date.now() }))
    await expect(t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.companionDecision, {
      bookingId: created.bookingId,
      decision: 'accepted',
    })).rejects.toThrow('Wallet balance')
    const state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.booking?.status).toBe('request_sent')
    expect(state.booking?.settlementState).toBe('unreserved')
    expect(state.transactions).toHaveLength(0)
  })

  it('rejects completion before the scheduled end without changing the booking, then allows evidence-gated dual completion', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createBooking(t, ids.companionProfileId)
    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.companionDecision, {
      bookingId: created.bookingId,
      decision: 'accepted',
    })
    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookingEvidence.skip, {
      bookingId: created.bookingId,
      warningAcknowledged: true,
    })
    await t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookingEvidence.skip, {
      bookingId: created.bookingId,
      warningAcknowledged: true,
    })

    const before = await t.run(async (ctx) => ctx.db.get(created.bookingId))
    await expect(t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookings.markCompleted, {
      bookingId: created.bookingId,
    })).rejects.toThrow('Booking cannot be completed before the scheduled session ends')
    const afterRejection = await t.run(async (ctx) => ctx.db.get(created.bookingId))
    expect(afterRejection).toEqual(before)
    expect(afterRejection?.status).toBe('accepted')
    expect(afterRejection?.memberCompletedAt).toBeUndefined()
    expect(afterRejection?.companionCompletedAt).toBeUndefined()

    await endBookingSchedule(t, created.bookingId)
    await expect(t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookings.markCompleted, {
      bookingId: created.bookingId,
    })).resolves.toMatchObject({ status: 'accepted', awaitingOtherConfirmation: true })
    await expect(t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.markCompleted, {
      bookingId: created.bookingId,
    })).resolves.toMatchObject({ status: 'review_window', awaitingOtherConfirmation: false })
    expect(await t.run(async (ctx) => ctx.db.get(created.bookingId))).toMatchObject({
      status: 'review_window',
      memberCompletedAt: expect.any(Number),
      companionCompletedAt: expect.any(Number),
      jointlyCompletedAt: expect.any(Number),
    })
  })

  it('keeps funds reserved after first completion, then allocates once and settles exactly 24 hours after mutual completion', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createBooking(t, ids.companionProfileId)
    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.companionDecision, { bookingId: created.bookingId, decision: 'accepted' })
    await endBookingSchedule(t, created.bookingId)
    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookingEvidence.skip, { bookingId: created.bookingId, warningAcknowledged: true })
    await t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookingEvidence.skip, { bookingId: created.bookingId, warningAcknowledged: true })
    await expect(t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookings.markCompleted, { bookingId: created.bookingId }))
      .resolves.toMatchObject({ status: 'accepted', awaitingOtherConfirmation: true })

    const firstCompletion = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      account: await ctx.db.get(ids.memberAccountId),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(firstCompletion.booking).toMatchObject({ status: 'accepted', settlementState: 'reserved' })
    expect(firstCompletion.account).toMatchObject({ availableCentavos: 0, reservedCentavos: TOTAL })
    expect(firstCompletion.transactions.filter((row) => row.kind === 'booking_complete')).toHaveLength(0)

    await expect(t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.markCompleted, { bookingId: created.bookingId }))
      .resolves.toMatchObject({ status: 'review_window', awaitingOtherConfirmation: false })
    await expect(t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.markCompleted, { bookingId: created.bookingId }))
      .resolves.toMatchObject({ status: 'review_window', idempotent: true })

    let state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      accounts: await ctx.db.query('walletAccounts').collect(),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.booking?.settlementEligibleAt! - state.booking?.jointlyCompletedAt!).toBe(86_400_000)
    expect(state.booking?.settlementState).toBe('pending')
    expect(state.transactions.filter((row) => row.kind === 'booking_complete')).toHaveLength(1)
    expect(state.accounts.find((row) => row.accountType === 'companion_earnings')).toMatchObject({ pendingCentavos: SUBTOTAL, availableCentavos: 0 })
    expect(state.accounts.find((row) => row.accountType === 'platform_revenue')).toMatchObject({ pendingCentavos: FEE, availableCentavos: 0 })

    await t.mutation(internal.finance.settleBooking, { bookingId: created.bookingId, now: state.booking!.settlementEligibleAt! - 1 })
    await t.mutation(internal.finance.settleBooking, { bookingId: created.bookingId, now: state.booking!.settlementEligibleAt })
    await t.mutation(internal.finance.settleBooking, { bookingId: created.bookingId, now: state.booking!.settlementEligibleAt })
    state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      accounts: await ctx.db.query('walletAccounts').collect(),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.booking?.settlementState).toBe('settled')
    expect(state.transactions.filter((row) => row.kind === 'booking_settle')).toHaveLength(1)
    expect(state.accounts.find((row) => row.accountType === 'companion_earnings')).toMatchObject({ pendingCentavos: 0, availableCentavos: SUBTOTAL })
    expect(state.accounts.find((row) => row.accountType === 'platform_revenue')).toMatchObject({ pendingCentavos: 0, availableCentavos: FEE })
  })

  it('enforces evidence roles and acknowledgement, and rejects cancellation after completion starts', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createBooking(t, ids.companionProfileId)
    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.companionDecision, { bookingId: created.bookingId, decision: 'accepted' })
    await endBookingSchedule(t, created.bookingId)

    await expect(t.withIdentity({ subject: 'wallet-outsider' }).query(api.bookingEvidence.status, { bookingId: created.bookingId }))
      .rejects.toThrow('Not your booking')
    await expect(t.withIdentity({ subject: 'wallet-companion' }).query(api.bookingEvidence.status, { bookingId: created.bookingId }))
      .resolves.toMatchObject({ role: 'companion_start', requiredBeforeCompletion: true })
    await expect(t.withIdentity({ subject: 'wallet-member' }).query(api.bookingEvidence.status, { bookingId: created.bookingId }))
      .resolves.toMatchObject({ role: 'member_end', requiredBeforeCompletion: true })
    await expect(t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookingEvidence.skip, {
      bookingId: created.bookingId,
      warningAcknowledged: false,
    })).rejects.toThrow('acknowledge the evidence warning')
    await expect(t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.markCompleted, { bookingId: created.bookingId }))
      .rejects.toThrow('Choose start evidence')

    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookingEvidence.skip, {
      bookingId: created.bookingId,
      warningAcknowledged: true,
    })
    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.markCompleted, { bookingId: created.bookingId })
    await expect(t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookings.markCompleted, { bookingId: created.bookingId }))
      .rejects.toThrow('Choose end evidence')
    await expect(t.withIdentity({ subject: 'wallet-member' }).mutation(api.bookings.cancel, { bookingId: created.bookingId }))
      .rejects.toThrow('report/dispute flow')

    const state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      account: await ctx.db.get(ids.memberAccountId),
      decisions: await ctx.db.query('bookingEvidenceDecisions').collect(),
    }))
    expect(state.booking).toMatchObject({ status: 'accepted', settlementState: 'reserved' })
    expect(state.account).toMatchObject({ availableCentavos: 0, reservedCentavos: TOTAL })
    expect(state.decisions).toHaveLength(1)
    expect(state.decisions[0]).toMatchObject({ userId: ids.companionUserId, role: 'companion_start', decision: 'skipped' })
  })

  it('allows a report without evidence and preserves its hold when the companion later accepts', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createBooking(t, ids.companionProfileId)
    await t.withIdentity({ subject: 'wallet-member' }).mutation(api.reports.create, {
      targetType: 'booking',
      targetId: String(created.bookingId),
      reason: 'Safety concern before evidence or acceptance',
    })
    expect(await t.run(async (ctx) => ctx.db.query('bookingEvidenceDecisions').collect())).toHaveLength(0)

    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.companionDecision, {
      bookingId: created.bookingId,
      decision: 'accepted',
    })
    const state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      account: await ctx.db.get(ids.memberAccountId),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.booking).toMatchObject({ status: 'accepted', settlementState: 'blocked' })
    expect(state.booking?.settlementBlockedAt).toBeTypeOf('number')
    expect(state.account).toMatchObject({ availableCentavos: 0, reservedCentavos: TOTAL })
    expect(state.transactions.filter((row) => row.kind === 'booking_reserve')).toHaveLength(1)
  })

  it('credits provider-confirmed member top-ups once while retaining legacy purpose behavior', async () => {
    const t = createTest()
    const ids = await seed(t)
    const { memberTopUpId, legacyTopUpId } = await t.run(async (ctx) => {
      const now = Date.now()
      const memberTopUpId = await ctx.db.insert('paymongoTopUps', {
        beneficiaryUserId: ids.memberId,
        purpose: 'member_booking_balance',
        amountCentavos: 20_000,
        currency: 'PHP',
        mode: 'test',
        status: 'processing',
        providerIntentId: 'pi_member_wallet',
        createdAt: now,
        updatedAt: now,
      })
      const legacyTopUpId = await ctx.db.insert('paymongoTopUps', {
        companionUserId: ids.companionUserId,
        beneficiaryUserId: ids.companionUserId,
        amountCentavos: 10_000,
        currency: 'PHP',
        mode: 'test',
        status: 'processing',
        providerIntentId: 'pi_legacy_companion_fee',
        createdAt: now,
        updatedAt: now,
      })
      return { memberTopUpId, legacyTopUpId }
    })
    const memberIntent = {
      id: 'pi_member_wallet',
      amountCentavos: 20_000,
      currency: 'PHP',
      status: 'succeeded',
      mode: 'test' as const,
      methodTypes: ['qrph'],
    }
    const legacyIntent = {
      id: 'pi_legacy_companion_fee',
      amountCentavos: 10_000,
      currency: 'PHP',
      status: 'succeeded',
      mode: 'test' as const,
      methodTypes: ['qrph'],
    }
    await t.mutation(internal.paymongo.applyReconciliation, { topUpId: memberTopUpId, intent: memberIntent })
    await t.mutation(internal.paymongo.applyReconciliation, { topUpId: memberTopUpId, intent: memberIntent })
    await t.mutation(internal.paymongo.applyReconciliation, { topUpId: legacyTopUpId, intent: legacyIntent })
    await t.mutation(internal.paymongo.applyReconciliation, { topUpId: legacyTopUpId, intent: legacyIntent })

    const state = await t.run(async (ctx) => ({
      memberAccount: await ctx.db.get(ids.memberAccountId),
      transactions: await ctx.db.query('walletTransactions').collect(),
      legacyLedger: await ctx.db.query('platformFeeLedger').collect(),
    }))
    expect(state.memberAccount).toMatchObject({ availableCentavos: TOTAL + 20_000 })
    expect(state.transactions.filter((row) => row.kind === 'paymongo_member_credit')).toHaveLength(1)
    expect(state.legacyLedger.filter((row) => row.kind === 'top_up_credit')).toHaveLength(1)
  })

  it('rejects a member-purpose top-up without its bound beneficiary', async () => {
    const t = createTest()
    await seed(t)
    const topUpId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('paymongoTopUps', {
        purpose: 'member_booking_balance',
        amountCentavos: 20_000,
        currency: 'PHP',
        mode: 'test',
        status: 'processing',
        providerIntentId: 'pi_missing_beneficiary',
        createdAt: now,
        updatedAt: now,
      })
    })
    await expect(t.mutation(internal.paymongo.applyReconciliation, {
      topUpId,
      intent: {
        id: 'pi_missing_beneficiary',
        amountCentavos: 20_000,
        currency: 'PHP',
        status: 'succeeded',
        mode: 'test',
        methodTypes: ['qrph'],
      },
    })).rejects.toThrow('not a member booking-balance top-up')
    expect(await t.run(async (ctx) => ctx.db.query('walletTransactions').collect())).toHaveLength(0)
  })

  it('makes a pre-completion admin refund terminal and rejects completion or a conflicting release', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createBooking(t, ids.companionProfileId)
    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.companionDecision, {
      bookingId: created.bookingId,
      decision: 'accepted',
    })
    await t.withIdentity({ subject: 'wallet-member' }).mutation(api.reports.create, {
      targetType: 'booking', targetId: String(created.bookingId), reason: 'Pre-completion safety concern',
    })
    await t.withIdentity({ subject: 'wallet-admin' }).mutation(api.admin.resolveBlockedBookingFunds, {
      bookingId: created.bookingId, resolution: 'return_to_member', note: 'Return reserved funds before completion.',
    })
    const first = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      account: await ctx.db.get(ids.memberAccountId),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    expect(first.booking).toMatchObject({
      status: 'cancelled',
      settlementState: 'refunded',
      settlementResolution: 'returned_to_member',
      cancellationReason: 'Cancelled by a full admin after a booking report; reserved funds were returned to the member.',
    })
    expect(first.booking?.cancelledAt).toBeTypeOf('number')
    expect(first.account).toMatchObject({ availableCentavos: TOTAL, reservedCentavos: 0 })

    await expect(t.withIdentity({ subject: 'wallet-companion' }).mutation(api.bookings.markCompleted, {
      bookingId: created.bookingId,
    })).rejects.toThrow('Refunded bookings cannot be completed')
    await t.withIdentity({ subject: 'wallet-admin' }).mutation(api.admin.resolveBlockedBookingFunds, {
      bookingId: created.bookingId, resolution: 'return_to_member', note: 'Matching retry.',
    })
    await expect(t.withIdentity({ subject: 'wallet-admin' }).mutation(api.admin.resolveBlockedBookingFunds, {
      bookingId: created.bookingId, resolution: 'release_to_companion', note: 'Conflicting release attempt.',
    })).rejects.toThrow('conflicting outcome')
    const after = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      transactions: await ctx.db.query('walletTransactions').collect(),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    expect(after.booking?.settlementResolvedAt).toBe(first.booking?.settlementResolvedAt)
    expect(after.audits).toHaveLength(first.audits.length)
    expect(after.transactions.filter((row) => row.kind === 'booking_admin_refund')).toHaveLength(1)
    expect(after.transactions.filter((row) => row.kind === 'booking_admin_release')).toHaveLength(0)
  })

  it('blocks unsettled funds on participant reports, rejects outsiders, and lets only a full admin refund once', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createBooking(t, ids.companionProfileId)
    await acceptAndComplete(t, created.bookingId)

    await expect(t.withIdentity({ subject: 'wallet-outsider' }).mutation(api.reports.create, {
      targetType: 'booking', targetId: String(created.bookingId), reason: 'Outsider report',
    })).rejects.toThrow('Only a booking participant')
    const reportId = await t.withIdentity({ subject: 'wallet-member' }).mutation(api.reports.create, {
      targetType: 'booking', targetId: String(created.bookingId), reason: 'Safety concern without evidence',
    })
    const blocked = await t.run(async (ctx) => ctx.db.get(created.bookingId))
    expect(blocked?.settlementState).toBe('blocked')
    await t.mutation(internal.finance.settleBooking, { bookingId: created.bookingId, now: blocked!.settlementEligibleAt! })
    expect((await t.run(async (ctx) => ctx.db.get(created.bookingId)))?.settlementState).toBe('blocked')

    await expect(t.withIdentity({ subject: 'wallet-reviewer' }).mutation(api.admin.resolveBlockedBookingFunds, {
      bookingId: created.bookingId, resolution: 'return_to_member', note: 'Reviewer attempt',
    })).rejects.toThrow('Full admin role required')
    await expect(t.withIdentity({ subject: 'wallet-admin' }).mutation(api.admin.resolveBlockedBookingFunds, {
      bookingId: created.bookingId, resolution: 'return_to_member', note: '',
    })).rejects.toThrow('requires an internal note')
    await t.withIdentity({ subject: 'wallet-admin' }).mutation(api.admin.resolveBlockedBookingFunds, {
      bookingId: created.bookingId, resolution: 'return_to_member', note: 'Return funds after safety review.',
    })
    const firstResolution = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    await t.withIdentity({ subject: 'wallet-admin' }).mutation(api.admin.resolveBlockedBookingFunds, {
      bookingId: created.bookingId, resolution: 'return_to_member', note: 'Idempotent retry.',
    })
    await expect(t.withIdentity({ subject: 'wallet-admin' }).mutation(api.admin.resolveBlockedBookingFunds, {
      bookingId: created.bookingId, resolution: 'release_to_companion', note: 'Conflicting retry.',
    })).rejects.toThrow('conflicting outcome')
    const state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      report: await ctx.db.get(reportId),
      accounts: await ctx.db.query('walletAccounts').collect(),
      transactions: await ctx.db.query('walletTransactions').collect(),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    expect(state.booking).toMatchObject({ settlementState: 'refunded', settlementResolution: 'returned_to_member' })
    expect(state.booking?.settlementResolvedAt).toBe(firstResolution.booking?.settlementResolvedAt)
    expect(state.audits).toHaveLength(firstResolution.audits.length)
    expect(state.report?.settlementHoldReleasedAt).toBeTypeOf('number')
    expect(state.accounts.find((row) => row.accountType === 'member_booking')).toMatchObject({ availableCentavos: TOTAL, reservedCentavos: 0 })
    expect(state.accounts.find((row) => row.accountType === 'companion_earnings')?.pendingCentavos).toBe(0)
    expect(state.transactions.filter((row) => row.kind === 'booking_admin_refund')).toHaveLength(1)
  })

  it('lets a full admin release blocked pending funds to companion and platform once', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createBooking(t, ids.companionProfileId)
    await acceptAndComplete(t, created.bookingId)
    await t.withIdentity({ subject: 'wallet-companion' }).mutation(api.reports.create, {
      targetType: 'booking', targetId: String(created.bookingId), reason: 'Companion safety concern',
    })
    await t.withIdentity({ subject: 'wallet-admin' }).mutation(api.admin.resolveBlockedBookingFunds, {
      bookingId: created.bookingId, resolution: 'release_to_companion', note: 'Release after full-admin review.',
    })
    const firstResolution = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    await t.withIdentity({ subject: 'wallet-admin' }).mutation(api.admin.resolveBlockedBookingFunds, {
      bookingId: created.bookingId, resolution: 'release_to_companion', note: 'Idempotent retry.',
    })
    await expect(t.withIdentity({ subject: 'wallet-admin' }).mutation(api.admin.resolveBlockedBookingFunds, {
      bookingId: created.bookingId, resolution: 'return_to_member', note: 'Conflicting retry.',
    })).rejects.toThrow('conflicting outcome')
    const state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(created.bookingId),
      accounts: await ctx.db.query('walletAccounts').collect(),
      transactions: await ctx.db.query('walletTransactions').collect(),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    expect(state.booking).toMatchObject({ settlementState: 'settled', settlementResolution: 'released' })
    expect(state.booking?.settlementResolvedAt).toBe(firstResolution.booking?.settlementResolvedAt)
    expect(state.audits).toHaveLength(firstResolution.audits.length)
    expect(state.accounts.find((row) => row.accountType === 'companion_earnings')).toMatchObject({ pendingCentavos: 0, availableCentavos: SUBTOTAL })
    expect(state.accounts.find((row) => row.accountType === 'platform_revenue')).toMatchObject({ pendingCentavos: 0, availableCentavos: FEE })
    expect(state.transactions.filter((row) => row.kind === 'booking_admin_release')).toHaveLength(1)
  })
})
