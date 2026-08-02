import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

async function insertParticipants(t: ReturnType<typeof convexTest>) {
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
    const hostUserId = await ctx.db.insert('users', {
      clerkUserId: 'finance-host', displayName: 'Finance Host', role: 'friend_host', ...identity,
    })
    const memberId = await ctx.db.insert('users', {
      clerkUserId: 'finance-member', displayName: 'Finance Member', role: 'member', ...identity,
    })
    const hostProfileId = await ctx.db.insert('hostProfiles', {
      userId: hostUserId,
      displayName: 'Finance Host',
      intro: 'A safe Friend Host profile used to verify booking commission accounting.',
      city: 'Test City',
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: 50_000,
      status: 'approved',
      rating: 5,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    return { now, hostUserId, memberId, hostProfileId }
  })
}

async function insertAcceptedBooking(
  t: ReturnType<typeof convexTest>,
  ids: Awaited<ReturnType<typeof insertParticipants>>,
) {
  return await t.run(async (ctx) => ctx.db.insert('bookings', {
    memberId: ids.memberId,
    hostProfileId: ids.hostProfileId,
    category: 'Coffee or meal companion',
    mode: 'in_person',
    requestedAt: ids.now + 3_600_000,
    durationMinutes: 60,
    status: 'accepted',
    grossPriceCentavos: 50_000,
    currency: 'PHP',
    commissionBps: 1_000,
    commissionCentavos: 5_000,
    createdAt: ids.now,
    updatedAt: ids.now,
  }))
}

describe('weekly Friend Host commission accounting', () => {
  it('requires dual completion and accrues one immutable obligation', async () => {
    const t = createTest()
    const ids = await insertParticipants(t)
    const bookingId = await insertAcceptedBooking(t, ids)

    await expect(t.withIdentity({ subject: 'finance-member' }).mutation(api.bookings.markCompleted, { bookingId }))
      .resolves.toMatchObject({ status: 'accepted', awaitingOtherConfirmation: true })
    expect(await t.run(async (ctx) => ctx.db.query('commissionObligations').collect())).toHaveLength(0)

    await expect(t.withIdentity({ subject: 'finance-host' }).mutation(api.bookings.markCompleted, { bookingId }))
      .resolves.toMatchObject({ status: 'review_window', awaitingOtherConfirmation: false })
    const obligations = await t.run(async (ctx) => ctx.db.query('commissionObligations').collect())
    expect(obligations).toHaveLength(1)
    expect(obligations[0]).toMatchObject({ bookingId, hostUserId: ids.hostUserId, amountCentavos: 5_000, commissionBps: 1_000 })
    await expect(t.withIdentity({ subject: 'finance-host' }).mutation(api.bookings.markCompleted, { bookingId }))
      .rejects.toThrow('Only accepted bookings can be completed')
    expect(await t.run(async (ctx) => ctx.db.query('commissionObligations').collect())).toHaveLength(1)
  })

  it('collects available credit partially and carries the remainder past due', async () => {
    const t = createTest()
    const ids = await insertParticipants(t)
    const dueAt = Date.now() - 1
    await t.run(async (ctx) => {
      const bookingA = await ctx.db.insert('bookings', {
        memberId: ids.memberId, hostProfileId: ids.hostProfileId, category: 'Coffee or meal companion', mode: 'in_person',
        requestedAt: dueAt - 86_400_000, durationMinutes: 60, status: 'review_window', createdAt: dueAt - 86_400_000, updatedAt: dueAt - 86_400_000,
      })
      const bookingB = await ctx.db.insert('bookings', {
        memberId: ids.memberId, hostProfileId: ids.hostProfileId, category: 'Coffee or meal companion', mode: 'in_person',
        requestedAt: dueAt - 86_400_000, durationMinutes: 60, status: 'review_window', createdAt: dueAt - 86_400_000, updatedAt: dueAt - 86_400_000,
      })
      await ctx.db.insert('commissionObligations', {
        bookingId: bookingA, hostUserId: ids.hostUserId, hostProfileId: ids.hostProfileId,
        amountCentavos: 10_000, currency: 'PHP', commissionBps: 1_000, dueAt, accruedAt: dueAt - 1,
      })
      await ctx.db.insert('commissionObligations', {
        bookingId: bookingB, hostUserId: ids.hostUserId, hostProfileId: ids.hostProfileId,
        amountCentavos: 10_000, currency: 'PHP', commissionBps: 1_000, dueAt, accruedAt: dueAt - 1,
      })
      await ctx.db.insert('platformFeeLedger', {
        hostUserId: ids.hostUserId, direction: 'credit', amountCentavos: 15_000, currency: 'PHP', kind: 'top_up_credit',
        idempotencyKey: 'test-credit', createdAt: dueAt - 1,
      })
    })

    await t.mutation(internal.finance.collectWeekly, { now: dueAt })
    const finance = await t.withIdentity({ subject: 'finance-host' }).query(api.finance.dashboard, {})
    expect(finance).toMatchObject({ availableBalanceCentavos: 0, pastDueCentavos: 5_000, canAcceptBookings: false })
    const debits = await t.run(async (ctx) => ctx.db.query('platformFeeLedger').withIndex('by_host', (q) => q.eq('hostUserId', ids.hostUserId)).collect())
    expect(debits.filter((entry) => entry.direction === 'debit').reduce((sum, entry) => sum + entry.amountCentavos, 0)).toBe(15_000)
  })

  it('blocks acceptance while past due', async () => {
    const t = createTest()
    const ids = await insertParticipants(t)
    const bookingId = await t.run(async (ctx) => {
      const booking = await ctx.db.insert('bookings', {
        memberId: ids.memberId, hostProfileId: ids.hostProfileId, category: 'Coffee or meal companion', mode: 'in_person',
        requestedAt: ids.now + 3_600_000, durationMinutes: 60, status: 'request_sent', createdAt: ids.now, updatedAt: ids.now,
      })
      const completedBooking = await ctx.db.insert('bookings', {
        memberId: ids.memberId, hostProfileId: ids.hostProfileId, category: 'Coffee or meal companion', mode: 'in_person',
        requestedAt: ids.now - 86_400_000, durationMinutes: 60, status: 'review_window', createdAt: ids.now - 86_400_000, updatedAt: ids.now,
      })
      await ctx.db.insert('commissionObligations', {
        bookingId: completedBooking, hostUserId: ids.hostUserId, hostProfileId: ids.hostProfileId,
        amountCentavos: 5_000, currency: 'PHP', commissionBps: 1_000, dueAt: ids.now - 1, accruedAt: ids.now - 2,
      })
      return booking
    })
    await expect(t.withIdentity({ subject: 'finance-host' }).mutation(api.bookings.hostDecision, {
      bookingId, decision: 'accepted',
    })).rejects.toThrow('Past-due platform commission')
  })

  it('credits a paid top-up once and automatically settles overdue obligations FIFO', async () => {
    const t = createTest()
    const ids = await insertParticipants(t)
    const { topUpId } = await t.run(async (ctx) => {
      const bookingId = await ctx.db.insert('bookings', {
        memberId: ids.memberId, hostProfileId: ids.hostProfileId, category: 'Coffee or meal companion', mode: 'in_person',
        requestedAt: ids.now - 86_400_000, durationMinutes: 60, status: 'review_window', createdAt: ids.now - 86_400_000, updatedAt: ids.now,
      })
      await ctx.db.insert('commissionObligations', {
        bookingId, hostUserId: ids.hostUserId, hostProfileId: ids.hostProfileId,
        amountCentavos: 7_000, currency: 'PHP', commissionBps: 1_000, dueAt: ids.now - 1, accruedAt: ids.now - 2,
      })
      const topUpId = await ctx.db.insert('paymongoTopUps', {
        hostUserId: ids.hostUserId, amountCentavos: 10_000, currency: 'PHP', mode: 'test', status: 'processing',
        providerIntentId: 'pi_paid', createdAt: ids.now, updatedAt: ids.now,
      })
      return { topUpId }
    })
    const intent = {
      id: 'pi_paid', amountCentavos: 10_000, currency: 'PHP', status: 'succeeded', mode: 'test' as const, methodTypes: ['qrph'],
    }
    await t.mutation(internal.paymongo.applyReconciliation, { topUpId, intent })
    await t.mutation(internal.paymongo.applyReconciliation, { topUpId, intent })

    const finance = await t.withIdentity({ subject: 'finance-host' }).query(api.finance.dashboard, {})
    expect(finance).toMatchObject({ availableBalanceCentavos: 3_000, pastDueCentavos: 0, canAcceptBookings: true })
    const ledger = await t.run(async (ctx) => ctx.db.query('platformFeeLedger').collect())
    expect(ledger.filter((entry) => entry.kind === 'top_up_credit')).toHaveLength(1)
    expect(ledger.filter((entry) => entry.kind === 'commission_collection')).toHaveLength(1)
  })
})
