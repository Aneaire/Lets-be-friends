import {
  availabilityFitNotice,
  availabilityGate,
  bookingRequestGate,
  canShiftManilaMonth,
  formatMinutes,
  normalizeCompanionAvailability,
  summarizeWeeklyAvailability,
} from '@/data/companionAvailability'

describe('companion availability presentation', () => {
  it('treats a missing schedule as legacy-compatible with no notice', () => {
    expect(normalizeCompanionAvailability(undefined)).toBeNull()
    expect(summarizeWeeklyAvailability([])).toBe('No weekly availability shared yet.')
    expect(availabilityGate({ availability: undefined, requestedAt: Date.now(), durationMinutes: 60 })).toEqual({ blocked: false, notice: null })
    expect(availabilityFitNotice({ availability: undefined, requestedAt: Date.now(), durationMinutes: 60 })).toBeNull()
  })

  it('rejects malformed stored schedules as configured-with-no-availability', () => {
    expect(normalizeCompanionAvailability([{ weekday: 9, startMinutes: 0, endMinutes: 60 }])).toEqual([])
  })

  it('blocks submit for a configured-but-empty schedule', () => {
    const gate = availabilityGate({ availability: [], requestedAt: Date.UTC(2026, 9, 26, 2, 0, 0), durationMinutes: 60 })
    expect(gate.blocked).toBe(true)
    expect(gate.notice).toContain('no available times')
  })

  it('summarizes a weekly schedule in Manila clock time', () => {
    expect(
      summarizeWeeklyAvailability([
        { weekday: 1, startMinutes: 540, endMinutes: 720 },
        { weekday: 1, startMinutes: 780, endMinutes: 1020 },
        { weekday: 6, startMinutes: 600, endMinutes: 660 },
      ]),
    ).toBe('Mon 9:00 AM to 12:00 PM, 1:00 PM to 5:00 PM; Sat 10:00 AM to 11:00 AM')
  })

  it('renders midnight as 12 AM, never as 12 PM', () => {
    expect(formatMinutes(0)).toBe('12:00 AM')
    expect(formatMinutes(720)).toBe('12:00 PM')
    expect(formatMinutes(1440)).toBe('12:00 AM')
  })

  it('fits starts inside the shared schedule and blocks the rest', () => {
    const windows = [{ weekday: 1, startMinutes: 540, endMinutes: 720 }]
    // Monday 2026-10-26 10:00 Manila time fits inside the window.
    expect(availabilityGate({ availability: windows, requestedAt: Date.UTC(2026, 9, 26, 2, 0, 0), durationMinutes: 60 })).toEqual({ blocked: false, notice: null })
    // Monday 2026-10-26 15:00 Manila time sits outside the window.
    const outside = availabilityGate({ availability: windows, requestedAt: Date.UTC(2026, 9, 26, 7, 0, 0), durationMinutes: 60 })
    expect(outside.blocked).toBe(true)
    expect(outside.notice).toContain('outside the shared weekly availability')
  })

  it('treats loading, server ineligibility, and stale slot results as hard submit gates', () => {
    const windows = [{ weekday: 1, startMinutes: 540, endMinutes: 720 }]
    const requestedAt = Date.UTC(2026, 9, 26, 2, 0, 0)
    expect(bookingRequestGate({ scheduleConfigured: true, availability: windows, bookingAvailability: undefined, slotsLoading: true, selectedSlotValid: false, requestedAt: null, durationMinutes: 60 }).notice).toContain('Checking')
    expect(bookingRequestGate({ scheduleConfigured: true, availability: windows, bookingAvailability: 'not_verified', slotsLoading: false, selectedSlotValid: true, requestedAt, durationMinutes: 60 }).notice).toContain('not verified')
    expect(bookingRequestGate({ scheduleConfigured: true, availability: windows, bookingAvailability: 'available', slotsLoading: true, selectedSlotValid: true, requestedAt, durationMinutes: 60 }).notice).toContain('still loading')
    expect(bookingRequestGate({ scheduleConfigured: true, availability: windows, bookingAvailability: 'available', slotsLoading: false, selectedSlotValid: false, requestedAt, durationMinutes: 60 }).notice).toContain('currently available')
    expect(bookingRequestGate({ scheduleConfigured: true, availability: windows, bookingAvailability: 'available', slotsLoading: false, selectedSlotValid: true, requestedAt, durationMinutes: 60 })).toEqual({ blocked: false, notice: null })
  })

  it('bounds slot month navigation to the current month through December 2100', () => {
    const now = Date.UTC(2026, 9, 22, 0, 0, 0)
    expect(canShiftManilaMonth({ year: 2026, monthIndex: 9 }, -1, now)).toBe(false)
    expect(canShiftManilaMonth({ year: 2026, monthIndex: 9 }, 1, now)).toBe(true)
    expect(canShiftManilaMonth({ year: 2100, monthIndex: 11 }, 1, now)).toBe(false)
  })
})
