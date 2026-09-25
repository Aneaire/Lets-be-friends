import geospatialTest from '@convex-dev/geospatial/test'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

function createTest() {
  const t = convexTest(schema, convexModules)
  geospatialTest.register(t)
  return t
}

async function seedBooking(t: ReturnType<typeof convexTest>, status: 'request_sent' | 'review_window' = 'request_sent') {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const user = (clerkUserId: string, role: 'member' | 'companion' = 'member') => ({
      clerkUserId,
      displayName: clerkUserId,
      role,
      verificationStatus: 'not_started' as const,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
    const memberId = await ctx.db.insert('users', user('booking-member'))
    const companionUserId = await ctx.db.insert('users', user('booking-companion', 'companion'))
    await ctx.db.insert('users', user('booking-outsider'))
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Booking Companion',
      intro: 'A Companion used to verify booking behavior.',
      city: 'Test City',
      strengths: ['Good listener'],
      categories: ['Good company'],
      boundaries: ['Public places only'],
      mode: 'both',
      status: 'approved',
      rating: 5,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    const bookingId = await ctx.db.insert('bookings', {
      memberId,
      companionProfileId,
      category: 'Good company',
      mode: 'online',
      requestedAt: now + 86_400_000,
      durationMinutes: 60,
      status,
      createdAt: now,
      updatedAt: now,
    })
    return { bookingId, memberId, companionProfileId }
  })
}

describe('booking lifecycle boundaries', () => {
  it('allows a participant to cancel and records all expected side effects once', async () => {
    const t = createTest()
    const { bookingId } = await seedBooking(t)

    await expect(t.withIdentity({ subject: 'booking-member' }).mutation(api.bookings.cancel, {
      bookingId,
      reason: '  Plans changed  ',
    })).resolves.toEqual({ status: 'cancelled', idempotent: false })

    const state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      audits: await ctx.db.query('auditLogs').collect(),
      messages: await ctx.db.query('directMessages').collect(),
      notifications: await ctx.db.query('notifications').collect(),
    }))
    expect(state.booking).toMatchObject({ status: 'cancelled', cancellationReason: 'Plans changed' })
    expect(state.audits.filter((audit) => audit.action === 'booking.cancelled')).toHaveLength(1)
    expect(state.messages).toHaveLength(1)
    expect(state.notifications).toHaveLength(1)
  })

  it('rejects outsiders and non-cancellable states without partial writes', async () => {
    const outsiderTest = createTest()
    const first = await seedBooking(outsiderTest)

    await expect(outsiderTest.withIdentity({ subject: 'booking-outsider' }).mutation(api.bookings.cancel, {
      bookingId: first.bookingId,
    })).rejects.toThrow('Not your booking')

    const invalidStateTest = createTest()
    const second = await seedBooking(invalidStateTest, 'review_window')
    await expect(invalidStateTest.withIdentity({ subject: 'booking-member' }).mutation(api.bookings.cancel, {
      bookingId: second.bookingId,
    })).rejects.toThrow('can no longer be cancelled')

    const firstState = await outsiderTest.run(async (ctx) => ({
      booking: await ctx.db.get(first.bookingId),
      audits: await ctx.db.query('auditLogs').collect(),
      messages: await ctx.db.query('directMessages').collect(),
      notifications: await ctx.db.query('notifications').collect(),
    }))
    const secondState = await invalidStateTest.run(async (ctx) => ({
      second: await ctx.db.get(second.bookingId),
      audits: await ctx.db.query('auditLogs').collect(),
      messages: await ctx.db.query('directMessages').collect(),
      notifications: await ctx.db.query('notifications').collect(),
    }))
    expect(firstState.booking?.status).toBe('request_sent')
    expect(secondState.second?.status).toBe('review_window')
    for (const state of [firstState, secondState]) {
      expect(state.audits).toHaveLength(0)
      expect(state.messages).toHaveLength(0)
      expect(state.notifications).toHaveLength(0)
    }
  })
})

describe('Companion booking queries', () => {
  it('returns the member booking to the booked Companion with calendar-ready names', async () => {
    const t = createTest()
    const { bookingId } = await seedBooking(t)

    const companionBookings = await t.withIdentity({ subject: 'booking-companion' }).query(api.bookings.forCompanion, {})

    expect(companionBookings).toHaveLength(1)
    expect(companionBookings[0]).toMatchObject({
      _id: bookingId,
      status: 'request_sent',
      memberDisplayName: 'booking-member',
      companionDisplayName: 'booking-companion',
      category: 'Good company',
      mode: 'online',
    })
    expect(companionBookings[0].requestedAt).toBeGreaterThan(Date.now())
  })

  it('includes historical bookings in the Companion calendar data', async () => {
    const t = createTest()
    const { memberId, companionProfileId } = await seedBooking(t)
    const historicalId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('bookings', {
        memberId,
        companionProfileId,
        category: 'Good company',
        mode: 'online',
        requestedAt: now - 86_400_000,
        durationMinutes: 60,
        status: 'completed',
        createdAt: now - 172_800_000,
        updatedAt: now - 86_400_000,
      })
    })

    const companionBookings = await t.withIdentity({ subject: 'booking-companion' }).query(api.bookings.forCompanion, {})
    const statuses = companionBookings.map((booking) => booking.status)

    expect(statuses).toHaveLength(2)
    expect(statuses).toEqual(expect.arrayContaining(['completed', 'request_sent']))
    expect(companionBookings.every((booking) => booking.memberDisplayName === 'booking-member')).toBe(true)
    expect(companionBookings.map((booking) => booking._id)).toContain(historicalId)
  })

  it('does not expose a Companion booking to members or unrelated Companions', async () => {
    const t = createTest()
    await seedBooking(t)

    const asMember = await t.withIdentity({ subject: 'booking-member' }).query(api.bookings.forCompanion, {})
    const asOutsider = await t.withIdentity({ subject: 'booking-outsider' }).query(api.bookings.forCompanion, {})

    expect(asMember).toEqual([])
    expect(asOutsider).toEqual([])
  })

  it('includes a booking tied to a second Companion profile owned by the same user', async () => {
    const t = createTest()
    const { bookingId, memberId, companionProfileId } = await seedBooking(t)
    const { firstCreatedAt, secondProfileBookingId } = await t.run(async (ctx) => {
      const now = Date.now()
      const firstProfile = await ctx.db.get(companionProfileId)
      const firstBooking = await ctx.db.get(bookingId)
      const secondProfileId = await ctx.db.insert('companionProfiles', {
        userId: firstProfile!.userId,
        displayName: 'Second Companion Profile',
        intro: 'A second approved profile owned by the same Companion.',
        city: 'Second City',
        strengths: ['Good listener'],
        categories: ['Good company'],
        boundaries: ['Public places only'],
        mode: 'both',
        status: 'approved',
        rating: 5,
        reviewCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      const secondProfileBookingId = await ctx.db.insert('bookings', {
        memberId,
        companionProfileId: secondProfileId,
        category: 'Good company',
        mode: 'online',
        requestedAt: now + 172_800_000,
        durationMinutes: 60,
        status: 'request_sent',
        createdAt: firstBooking!.createdAt + 1,
        updatedAt: firstBooking!.createdAt + 1,
      })
      return { firstCreatedAt: firstBooking!.createdAt, secondProfileBookingId }
    })

    const companionBookings = await t.withIdentity({ subject: 'booking-companion' }).query(api.bookings.forCompanion, {})

    expect(companionBookings).toHaveLength(2)
    expect(companionBookings.map((booking) => booking._id)).toContain(secondProfileBookingId)
    expect(companionBookings.map((booking) => booking._id)).toContain(bookingId)
    expect(companionBookings.find((booking) => booking._id === secondProfileBookingId)).toMatchObject({
      memberDisplayName: 'booking-member',
      companionDisplayName: 'booking-companion',
      companionCity: 'Second City',
    })
    expect(companionBookings.find((booking) => booking._id === bookingId)).toMatchObject({
      companionCity: 'Test City',
    })
    expect(companionBookings[0]._id).toBe(secondProfileBookingId)
    expect(companionBookings[0].createdAt).toBeGreaterThan(firstCreatedAt)
  })
})
