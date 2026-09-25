import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'

export type MemberBooking = NonNullable<FunctionReturnType<typeof api.bookings.mine>>[number]
export type CompanionBooking = NonNullable<FunctionReturnType<typeof api.bookings.forCompanion>>[number]

export type BookingPerspective = 'member' | 'companion'

export type MemberPerspectiveBooking = MemberBooking & { perspective: 'member' }
export type CompanionPerspectiveBooking = CompanionBooking & { perspective: 'companion' }

export type CombinedCalendarBooking = MemberPerspectiveBooking | CompanionPerspectiveBooking

const ACTIVE_BOOKING_STATUSES = new Set([
  'verification_required',
  'pending_admin_review',
  'request_sent',
  'accepted',
])

export function isActiveCalendarBooking(booking: Pick<CombinedCalendarBooking, 'status'>): boolean {
  return ACTIVE_BOOKING_STATUSES.has(booking.status)
}

export function combineCalendarBookings(
  memberBookings: MemberBooking[] | undefined,
  companionBookings: CompanionBooking[] | undefined,
): CombinedCalendarBooking[] {
  const memberEntries: MemberPerspectiveBooking[] = (memberBookings ?? []).map((booking) => ({
    ...booking,
    perspective: 'member',
  }))
  const companionEntries: CompanionPerspectiveBooking[] = (companionBookings ?? []).map((booking) => ({
    ...booking,
    perspective: 'companion',
  }))
  return [...memberEntries, ...companionEntries]
}

export function calendarParticipantName(booking: CombinedCalendarBooking): string {
  if (booking.perspective === 'companion') {
    return booking.memberDisplayName?.trim() || 'Member'
  }
  return booking.companionDisplayName?.trim() || 'Companion'
}
