import { describe, expect, it } from 'vitest'
import {
  calendarParticipantName,
  combineCalendarBookings,
  isActiveCalendarBooking,
  type CompanionBooking,
  type MemberBooking,
} from '../../src/features/booking/combinedBookings'

const memberBooking = {
  _id: 'booking-member',
  requestedAt: 1_000,
  status: 'accepted',
  companionDisplayName: 'Companion Mika',
  category: 'Coffee and meals',
  mode: 'online',
  durationMinutes: 60,
} as unknown as MemberBooking

const companionBooking = {
  _id: 'booking-companion',
  requestedAt: 2_000,
  status: 'request_sent',
  memberDisplayName: 'Member Angelo',
  companionDisplayName: 'Viewer Companion',
  category: 'Photography walk',
  mode: 'in_person',
  durationMinutes: 90,
} as unknown as CompanionBooking

describe('combined calendar bookings', () => {
  it('tags every entry with the signed-in perspective so row rendering stays role-safe', () => {
    const combined = combineCalendarBookings([memberBooking], [companionBooking])

    expect(combined).toHaveLength(2)
    expect(combined[0]).toMatchObject({ _id: 'booking-member', perspective: 'member' })
    expect(combined[1]).toMatchObject({ _id: 'booking-companion', perspective: 'companion' })
  })

  it('resolves the Companion name for member entries and the member name for Companion entries', () => {
    const [memberEntry, companionEntry] = combineCalendarBookings([memberBooking], [companionBooking])

    expect(calendarParticipantName(memberEntry)).toBe('Companion Mika')
    expect(calendarParticipantName(companionEntry)).toBe('Member Angelo')
  })

  it('falls back to safe participant labels when a name is missing', () => {
    const blankMember = { ...memberBooking, companionDisplayName: '  ' } as unknown as MemberBooking
    const blankCompanion = { ...companionBooking, memberDisplayName: '' } as unknown as CompanionBooking

    expect(calendarParticipantName(combineCalendarBookings([blankMember], [])[0])).toBe('Companion')
    expect(calendarParticipantName(combineCalendarBookings([], [blankCompanion])[0])).toBe('Member')
  })

  it('treats member and Companion active lifecycle states as active and closed states as not active', () => {
    expect(isActiveCalendarBooking({ status: 'verification_required' })).toBe(true)
    expect(isActiveCalendarBooking({ status: 'pending_admin_review' })).toBe(true)
    expect(isActiveCalendarBooking({ status: 'request_sent' })).toBe(true)
    expect(isActiveCalendarBooking({ status: 'accepted' })).toBe(true)
    expect(isActiveCalendarBooking({ status: 'review_window' })).toBe(false)
    expect(isActiveCalendarBooking({ status: 'completed' })).toBe(false)
    expect(isActiveCalendarBooking({ status: 'declined' })).toBe(false)
    expect(isActiveCalendarBooking({ status: 'cancelled' })).toBe(false)
    expect(isActiveCalendarBooking({ status: 'closed' })).toBe(false)
  })

  it('returns an empty collection while either query is still undefined', () => {
    expect(combineCalendarBookings(undefined, undefined)).toEqual([])
    expect(combineCalendarBookings([memberBooking], undefined)).toHaveLength(1)
  })
})
