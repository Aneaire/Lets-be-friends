import {
  bookingDetailRoute,
  calendarParticipantName,
  combineCalendarBookings,
  filterMemberBookings,
  isActiveCalendarBooking,
  splitBookingsByPerspective,
} from '@/member/combinedBookings'

function memberBooking(id: string, status: string, overrides = {}) {
  return {
    _id: id,
    requestedAt: 1_786_000_000_000,
    status,
    companionDisplayName: 'Sam Companion',
    category: 'City walk',
    mode: 'online',
    durationMinutes: 60,
    ...overrides,
  }
}

function companionBooking(id: string, status: string, overrides = {}) {
  return {
    _id: id,
    requestedAt: 1_786_000_000_000,
    status,
    memberDisplayName: 'Alex Member',
    category: 'City walk',
    mode: 'online',
    durationMinutes: 60,
    ...overrides,
  }
}

describe('unified booking calendar contracts', () => {
  it('combines member and Companion bookings with web-compatible perspectives', () => {
    const combined = combineCalendarBookings(
      [memberBooking('m1', 'accepted')],
      [companionBooking('c1', 'request_sent')],
    )
    expect(combined.map((booking) => `${booking.perspective}:${booking._id}`)).toEqual([
      'member:m1',
      'companion:c1',
    ])
    expect(combineCalendarBookings(undefined, undefined)).toEqual([])
  })

  it('matches the web active calendar set, including safety review holds', () => {
    for (const status of ['verification_required', 'pending_admin_review', 'request_sent', 'accepted']) {
      expect(isActiveCalendarBooking({ status })).toBe(true)
    }
    for (const status of ['declined', 'cancelled', 'completed', 'review_window', 'closed', 'draft']) {
      expect(isActiveCalendarBooking({ status })).toBe(false)
    }
  })

  it('names the other participant for each role with safe fallbacks', () => {
    const combined = combineCalendarBookings(
      [memberBooking('m1', 'accepted', { companionDisplayName: '  Sam  ' })],
      [companionBooking('c1', 'accepted', { memberDisplayName: '' })],
    )
    expect(calendarParticipantName(combined[0])).toBe('Sam')
    expect(calendarParticipantName(combined[1])).toBe('Member')
    expect(calendarParticipantName({ ...memberBooking('m2', 'accepted', { companionDisplayName: '' }), perspective: 'member' })).toBe('Companion')
  })

  it('routes each role to its authorized detail screen', () => {
    const combined = combineCalendarBookings(
      [memberBooking('m1', 'accepted')],
      [companionBooking('c1', 'request_sent')],
    )
    expect(bookingDetailRoute(combined[0])).toEqual({ pathname: '/booking/[id]', params: { id: 'm1' } })
    expect(bookingDetailRoute(combined[1])).toEqual({ pathname: '/companion-booking/[id]', params: { id: 'c1' } })
  })

  it('preserves member request, upcoming, and past filters', () => {
    const bookings = [
      memberBooking('draft', 'draft'),
      memberBooking('held', 'verification_required'),
      memberBooking('review', 'pending_admin_review'),
      memberBooking('sent', 'request_sent'),
      memberBooking('upcoming', 'accepted'),
      memberBooking('past', 'completed'),
    ]
    expect(filterMemberBookings(bookings, 'requests').map((booking) => booking._id)).toEqual(['draft', 'held', 'review', 'sent'])
    expect(filterMemberBookings(bookings, 'active').map((booking) => booking._id)).toEqual(['upcoming'])
    expect(filterMemberBookings(bookings, 'past').map((booking) => booking._id)).toEqual(['past'])
  })

  it('keeps Companion bookings visible in the main calendar without leaking member routes', () => {
    const combined = combineCalendarBookings(
      [memberBooking('m1', 'accepted')],
      [companionBooking('c1', 'accepted'), companionBooking('c2', 'completed')],
    )
    const split = splitBookingsByPerspective(combined)
    expect(split.member.map((booking) => booking._id)).toEqual(['m1'])
    expect(split.companion.map((booking) => booking._id)).toEqual(['c1', 'c2'])
    for (const booking of split.companion) {
      expect(bookingDetailRoute(booking).pathname).toBe('/companion-booking/[id]')
    }
  })

  it('keeps the calendar route on today with an empty combined list when the member has no bookings', () => {
    const combined = combineCalendarBookings([], [])
    expect(combined).toEqual([])
    expect(splitBookingsByPerspective(combined)).toEqual({ member: [], companion: [] })
  })
})
