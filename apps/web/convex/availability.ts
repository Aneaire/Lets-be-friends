import { ConvexError } from 'convex/values'
import {
  availableStartsForManilaDate,
  intervalsOverlap,
  manilaDatesInMonth,
  manilaInstant,
  sessionFitsWeeklyAvailability,
  type BusyInterval,
} from '@lets-be-friends/shared'
import type { Doc, Id } from './_generated/dataModel'
import { readStoredWeeklyAvailability } from './availabilityRules'

// Small, shared database helpers for Companion availability. They keep the
// seniority rules (which accepted bookings count, how stored schedules are read)
// in one place so createDraft, editRequest, companionDecision, and the
// availableSlots query cannot drift apart.

/**
 * All accepted bookings that involve the Companion owner. The owner's accepted
 * sessions count whether they acted as the Companion (any of their profiles) or
 * as the member of another Companion's session, matching the product rule that a
 * Companion cannot be double-booked in either role.
 */
export async function collectAcceptedCompanionBookings(
  ctx: { db: any },
  ownerUserId: Id<'users'>,
): Promise<Doc<'bookings'>[]> {
  const profiles = await ctx.db
    .query('companionProfiles')
    .withIndex('by_user', (q: any) => q.eq('userId', ownerUserId))
    .collect()
  const profileIds = profiles.map((profile: Doc<'companionProfiles'>) => profile._id)
  const [perProfile, asMember] = await Promise.all([
    Promise.all(profileIds.map((profileId: Id<'companionProfiles'>) =>
      ctx.db.query('bookings')
        .withIndex('by_companion', (q: any) => q.eq('companionProfileId', profileId))
        .collect(),
    )),
    ctx.db.query('bookings')
      .withIndex('by_member', (q: any) => q.eq('memberId', ownerUserId))
      .collect(),
  ])

  const seen = new Set<string>()
  const accepted: Doc<'bookings'>[] = []
  for (const booking of [...perProfile.flat(), ...asMember] as Doc<'bookings'>[]) {
    const key = String(booking._id)
    if (seen.has(key)) continue
    seen.add(key)
    if (booking.status === 'accepted') accepted.push(booking)
  }
  return accepted
}

/** The absolute busy interval for an accepted booking, or null when unusable. */
export function bookingBusyInterval(booking: Doc<'bookings'>): BusyInterval | null {
  if (!Number.isFinite(booking.requestedAt)) return null
  if (!Number.isSafeInteger(booking.durationMinutes) || booking.durationMinutes <= 0) return null
  const end = booking.requestedAt + booking.durationMinutes * 60_000
  if (!Number.isFinite(end)) return null
  return { start: booking.requestedAt, end }
}

/**
 * Validates a session schedule and returns its end instant. Malformed legacy
 * values (non-finite, non-integer, or non-positive duration) fail closed so a
 * mutation that reaches acceptance never writes funds against an invalid
 * schedule.
 */
export function assertValidSessionSchedule(requestedAt: number, durationMinutes: number): number {
  if (!Number.isFinite(requestedAt) || !Number.isSafeInteger(requestedAt)) {
    throw new ConvexError('Booking schedule is invalid')
  }
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes <= 0) {
    throw new ConvexError('Booking schedule is invalid')
  }
  const endMs = requestedAt + durationMinutes * 60_000
  if (!Number.isSafeInteger(endMs)) {
    throw new ConvexError('Booking schedule is invalid')
  }
  return endMs
}

/**
 * Rejects a requested session that overlaps any accepted booking for the
 * Companion owner. Busy intervals are absolute instants, so overlaps across
 * midnight, month, or profile boundaries are caught. The booking being edited or
 * accepted is excluded so retries stay idempotent. A malformed schedule throws
 * rather than returning silently, because a mutation can reach this check.
 */
export async function assertNoAcceptedBookingConflict(
  ctx: { db: any },
  ownerUserId: Id<'users'>,
  startMs: number,
  durationMinutes: number,
  excludeBookingId?: Id<'bookings'>,
) {
  const endMs = assertValidSessionSchedule(startMs, durationMinutes)
  const accepted = await collectAcceptedCompanionBookings(ctx, ownerUserId)
  for (const booking of accepted) {
    if (excludeBookingId !== undefined && booking._id === excludeBookingId) continue
    const interval = bookingBusyInterval(booking)
    if (!interval) continue
    if (intervalsOverlap(startMs, endMs, interval.start, interval.end)) {
      throw new ConvexError('This Companion already has an accepted session at that time. Choose another time.')
    }
  }
}

/**
 * Rejects a requested session that does not fit the Companion's configured
 * weekly schedule. A missing schedule keeps legacy request compatibility; a
 * configured schedule, including an empty one, must contain the session. The
 * requested instant must always be a valid, aligned schedule; only the window
 * fit is skipped when no schedule has been shared.
 */
export function assertScheduleAllowsRequest(
  companion: Pick<Doc<'companionProfiles'>, 'weeklyAvailability'>,
  requestedAt: number,
  durationMinutes: number,
) {
  assertValidSessionSchedule(requestedAt, durationMinutes)
  const { configured, windows } = readStoredWeeklyAvailability(companion.weeklyAvailability)
  if (!configured) return
  if (windows.length === 0) {
    throw new ConvexError('This Companion has not shared availability for booking requests right now.')
  }
  if (!sessionFitsWeeklyAvailability({ windows, requestedAt, durationMinutes })) {
    throw new ConvexError('That time is outside the Companion shared availability. Choose a time within their weekly schedule.')
  }
}

export type CompanionAvailabilityMonth = {
  scheduleConfigured: boolean
  days: Array<{ date: string; startsAt: number[] }>
}

/**
 * Builds the per-date availability for a Manila calendar month. Each `startsAt`
 * value is an absolute UTC millisecond timestamp so the frontend never repeats
 * timezone math. Accepted bookings are only loaded as intervals; no booking,
 * member, or profile metadata is returned to the caller.
 */
export async function buildCompanionAvailabilityMonth(
  ctx: { db: any },
  companion: Pick<Doc<'companionProfiles'>, 'userId' | 'weeklyAvailability'>,
  year: number,
  month: number,
  durationMinutes: number,
  now: number,
): Promise<CompanionAvailabilityMonth> {
  const dates = manilaDatesInMonth(year, month)
  const { configured, windows } = readStoredWeeklyAvailability(companion.weeklyAvailability)
  if (windows.length === 0) {
    return { scheduleConfigured: configured, days: dates.map((date) => ({ date, startsAt: [] })) }
  }
  const accepted = await collectAcceptedCompanionBookings(ctx, companion.userId)
  const busy = accepted
    .map((booking) => bookingBusyInterval(booking))
    .filter((interval): interval is BusyInterval => interval !== null)
  const days = dates.map((date) => ({
    date,
    startsAt: availableStartsForManilaDate({ date, windows, durationMinutes, now, busy })
      .map((minute) => manilaInstant(date, minute))
      .filter((instant): instant is number => Number.isFinite(instant)),
  }))
  return { scheduleConfigured: configured, days }
}
