import { bookingActions, bookingStatusPresentation, parseManilaBookingInput } from '@/data/bookingViewModels'

describe('booking input and view models', () => {
  const now = Date.UTC(2026, 7, 10, 0, 0)

  it('parses Manila-local date and time without depending on device timezone', () => {
    expect(parseManilaBookingInput('2026-08-11', '10:30', '90', now)).toEqual({
      ok: true,
      requestedAt: Date.UTC(2026, 7, 11, 2, 30),
      durationMinutes: 90,
    })
  })

  it('rejects invalid calendar dates, past times, and unsupported durations', () => {
    expect(parseManilaBookingInput('2026-02-30', '10:00', '60', now)).toMatchObject({ ok: false, message: 'Enter a valid calendar date.' })
    expect(parseManilaBookingInput('2026-08-10', '07:00', '60', now)).toMatchObject({ ok: false, message: 'Choose a future date and time.' })
    expect(parseManilaBookingInput('2026-08-11', '10:00', '17', now)).toMatchObject({ ok: false, message: 'Duration must be 15 to 720 minutes in 15-minute steps.' })
  })

  it('uses shared status rules for safe member actions', () => {
    expect(bookingActions('request_sent')).toEqual({ canCancel: true, canComplete: false, completionPending: false })
    expect(bookingActions('accepted')).toEqual({ canCancel: true, canComplete: false, completionPending: false })
    expect(bookingActions('accepted', { memberCompletedAt: now })).toEqual({ canCancel: false, canComplete: false, completionPending: true })
    expect(bookingActions('accepted', { companionCompletedAt: now })).toEqual({ canCancel: false, canComplete: false, completionPending: false })
    expect(bookingActions('accepted', {
      requestedAt: now - 3_600_000,
      durationMinutes: 30,
      completionSupported: true,
      now,
    })).toEqual({ canCancel: true, canComplete: true, completionPending: false })
    expect(bookingActions('closed')).toEqual({ canCancel: false, canComplete: false, completionPending: false })
    expect(bookingStatusPresentation.review_window.label).toBe('Completed')
  })
})
