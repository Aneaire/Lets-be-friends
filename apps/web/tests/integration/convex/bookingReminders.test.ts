import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const MINUTE_MS = 60 * 1_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

async function seedAcceptedBooking(
  t: ReturnType<typeof convexTest>,
  input: { requestedAt: number; acceptedAt?: number; status?: 'accepted' | 'cancelled' },
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const user = (clerkUserId: string, role: 'member' | 'companion', displayName = clerkUserId) => ({
      clerkUserId,
      displayName,
      role,
      verificationStatus: 'not_started' as const,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
    const memberClerkUserId = `reminder-member-${Math.random()}`
    const companionClerkUserId = `reminder-companion-${Math.random()}`
    const memberId = await ctx.db.insert('users', user(memberClerkUserId, 'member'))
    const companionUserId = await ctx.db.insert('users', user(companionClerkUserId, 'companion', 'Reminder Companion'))
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Reminder Companion',
      intro: 'A Companion used to verify booking reminders.',
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
      requestedAt: input.requestedAt,
      durationMinutes: 60,
      status: input.status ?? 'accepted',
      acceptedAt: input.acceptedAt,
      createdAt: now - 2 * DAY_MS,
      updatedAt: now,
    })
    return { bookingId, memberId, companionUserId, memberClerkUserId, companionClerkUserId }
  })
}

describe('booking reminders', () => {
  it('sends the 1 day reminder to both participants exactly once', async () => {
    const t = convexTest(schema, convexModules)
    const now = Date.now()
    const booking = await seedAcceptedBooking(t, {
      requestedAt: now + DAY_MS - MINUTE_MS,
      acceptedAt: now - 2 * HOUR_MS,
    })

    await t.mutation(internal.bookings.sendDueBookingReminders, {})

    const reminders = await t.run(async (ctx) => (
      (await ctx.db.query('notifications').collect()).filter((row) => row.kind === 'booking_reminder')
    ))
    expect(reminders).toHaveLength(2)
    expect(reminders.map((row) => String(row.recipientUserId)).sort()).toEqual([
      String(booking.memberId),
      String(booking.companionUserId),
    ].sort())
    for (const reminder of reminders) {
      expect(reminder).toMatchObject({
        kind: 'booking_reminder',
        priority: 'standard',
        reminderWindow: '1_day',
        bookingId: booking.bookingId,
        dedupeKey: `booking:${booking.bookingId}:reminder:1_day`,
      })
    }

    await t.mutation(internal.bookings.sendDueBookingReminders, {})
    const afterRepeat = await t.run(async (ctx) => (
      (await ctx.db.query('notifications').collect()).filter((row) => row.kind === 'booking_reminder')
    ))
    expect(afterRepeat).toHaveLength(2)

    const memberPage = await t.withIdentity({ subject: booking.memberClerkUserId }).query(api.notifications.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    })
    expect(memberPage.page[0]).toMatchObject({
      kind: 'booking_reminder',
      title: 'Session in 1 day',
      body: 'Your Good company session with Reminder Companion starts in 1 day.',
      destination: { type: 'booking', audience: 'member', bookingId: String(booking.bookingId) },
      targetAvailable: true,
    })
  })

  it('sends the 1 hour reminder as attention and skips bookings accepted after the window began', async () => {
    const t = convexTest(schema, convexModules)
    const now = Date.now()
    const due = await seedAcceptedBooking(t, {
      requestedAt: now + HOUR_MS - MINUTE_MS,
      acceptedAt: now - 2 * HOUR_MS,
    })
    await seedAcceptedBooking(t, {
      requestedAt: now + HOUR_MS - MINUTE_MS,
      acceptedAt: now - 30_000,
    })

    await t.mutation(internal.bookings.sendDueBookingReminders, {})

    const reminders = await t.run(async (ctx) => (
      (await ctx.db.query('notifications').collect()).filter((row) => row.kind === 'booking_reminder')
    ))
    expect(reminders).toHaveLength(2)
    expect(reminders.every((row) => row.reminderWindow === '1_hour')).toBe(true)
    expect(reminders.every((row) => row.priority === 'attention')).toBe(true)
    expect(reminders.every((row) => row.bookingId === due.bookingId)).toBe(true)
  })

  it('does not remind for cancelled bookings or bookings outside the window', async () => {
    const t = convexTest(schema, convexModules)
    const now = Date.now()
    await seedAcceptedBooking(t, {
      requestedAt: now + DAY_MS - MINUTE_MS,
      acceptedAt: now - 2 * HOUR_MS,
      status: 'cancelled',
    })
    await seedAcceptedBooking(t, {
      requestedAt: now + 2 * DAY_MS,
      acceptedAt: now - 2 * HOUR_MS,
    })

    await t.mutation(internal.bookings.sendDueBookingReminders, {})

    const reminders = await t.run(async (ctx) => (
      (await ctx.db.query('notifications').collect()).filter((row) => row.kind === 'booking_reminder')
    ))
    expect(reminders).toHaveLength(0)
  })
})
