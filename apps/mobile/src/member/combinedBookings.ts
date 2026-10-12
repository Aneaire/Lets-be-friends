export type CombinedBookingPerspective = 'member' | 'companion'

export type MemberBookingRecord = {
  _id: string
  requestedAt: number
  status: string
  companionDisplayName?: string
  [key: string]: unknown
}

export type CompanionBookingRecord = {
  _id: string
  requestedAt: number
  status: string
  memberDisplayName?: string
  [key: string]: unknown
}

export type CombinedCalendarBooking =
  | (MemberBookingRecord & { perspective: 'member' })
  | (CompanionBookingRecord & { perspective: 'companion' })

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
  memberBookings: MemberBookingRecord[] | undefined,
  companionBookings: CompanionBookingRecord[] | undefined,
): CombinedCalendarBooking[] {
  const memberEntries: CombinedCalendarBooking[] = (memberBookings ?? []).map((booking) => ({
    ...booking,
    perspective: 'member' as const,
  }))
  const companionEntries: CombinedCalendarBooking[] = (companionBookings ?? []).map((booking) => ({
    ...booking,
    perspective: 'companion' as const,
  }))
  return [...memberEntries, ...companionEntries]
}

export function calendarParticipantName(booking: CombinedCalendarBooking): string {
  if (booking.perspective === 'companion') {
    const name = (booking.memberDisplayName ?? '').trim()
    return name || 'Member'
  }
  const name = (booking.companionDisplayName ?? '').trim()
  return name || 'Companion'
}

export function bookingDetailRoute(booking: CombinedCalendarBooking): {
  pathname: '/booking/[id]' | '/companion-booking/[id]'
  params: { id: string }
} {
  if (booking.perspective === 'companion') {
    return { pathname: '/companion-booking/[id]', params: { id: String(booking._id) } }
  }
  return { pathname: '/booking/[id]', params: { id: String(booking._id) } }
}

export type MemberBookingFilter = 'active' | 'requests' | 'past'

const MEMBER_REQUEST_STATUSES = new Set(['draft', 'verification_required', 'pending_admin_review', 'request_sent'])
const MEMBER_PAST_STATUSES = new Set(['declined', 'cancelled', 'completed', 'review_window', 'closed'])

export function filterMemberBookings(bookings: MemberBookingRecord[], filter: MemberBookingFilter) {
  if (filter === 'requests') return bookings.filter((booking) => MEMBER_REQUEST_STATUSES.has(booking.status))
  if (filter === 'past') return bookings.filter((booking) => MEMBER_PAST_STATUSES.has(booking.status))
  return bookings.filter((booking) => booking.status === 'accepted')
}

export function splitBookingsByPerspective(bookings: CombinedCalendarBooking[]) {
  return {
    member: bookings.filter((booking) => booking.perspective === 'member'),
    companion: bookings.filter((booking) => booking.perspective === 'companion'),
  }
}
