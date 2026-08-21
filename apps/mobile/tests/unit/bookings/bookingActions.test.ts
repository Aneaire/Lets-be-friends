import {
  bookingDestinationForViewer,
  canSubmitBookingReview,
  validateReportReason,
  validateReviewInput,
} from '@/data/bookingActions'

describe('booking actions', () => {
  const booking = { bookingId: 'booking-1', memberId: 'member-1', companionUserId: 'companion-1' }

  it('routes booking cards by verified participant role', () => {
    expect(bookingDestinationForViewer('member-1', booking)).toBe('/booking/booking-1')
    expect(bookingDestinationForViewer('companion-1', booking)).toBe('/companion-booking/booking-1')
    expect(bookingDestinationForViewer('outsider', booking)).toBeNull()
    expect(bookingDestinationForViewer('member-1', { ...booking, companionUserId: 'member-1' })).toBeNull()
  })

  it('validates required report details without preserving surrounding whitespace', () => {
    expect(validateReportReason('   ')).toEqual({ ok: false, message: 'Explain why this booking needs a safety review.' })
    expect(validateReportReason('  Safety concern  ')).toEqual({ ok: true, reason: 'Safety concern' })
    expect(validateReportReason('x'.repeat(2_001))).toMatchObject({ ok: false })
  })

  it('requires an integer rating and trims optional review text', () => {
    expect(validateReviewInput(0, '')).toMatchObject({ ok: false })
    expect(validateReviewInput(4.5, '')).toMatchObject({ ok: false })
    expect(validateReviewInput(5, '  Helpful and kind.  ')).toEqual({ ok: true, rating: 5, body: 'Helpful and kind.' })
    expect(validateReviewInput(3, '   ')).toEqual({ ok: true, rating: 3, body: undefined })
  })

  it('uses shared review status rules and prevents a second review', () => {
    expect(canSubmitBookingReview('completed', false)).toBe(true)
    expect(canSubmitBookingReview('review_window', false)).toBe(true)
    expect(canSubmitBookingReview('accepted', false)).toBe(false)
    expect(canSubmitBookingReview('completed', true)).toBe(false)
  })
})
