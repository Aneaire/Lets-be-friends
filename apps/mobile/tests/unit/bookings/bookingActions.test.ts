import {
  bookingDestinationForViewer,
  canAttachReviewPhoto,
  canSubmitBookingReview,
  reviewPhotoSelectionError,
  reviewPhotoValidationError,
  validateReportReason,
  validateReviewComment,
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

  it('rejects review text that exceeds the backend limit', () => {
    expect(validateReviewInput(5, 'x'.repeat(1_001))).toMatchObject({ ok: false })
    expect(validateReviewInput(5, 'x'.repeat(1_000))).toMatchObject({ ok: true })
  })

  it('validates review comments by trimming and bounding length', () => {
    expect(validateReviewComment('   ')).toMatchObject({ ok: false })
    expect(validateReviewComment('  Warm and thoughtful.  ')).toEqual({ ok: true, body: 'Warm and thoughtful.' })
    expect(validateReviewComment('x'.repeat(501))).toMatchObject({ ok: false })
    expect(validateReviewComment('x'.repeat(500))).toMatchObject({ ok: true })
  })

  it('accepts JPEG, PNG, and WebP review photos at or below 10 MB', () => {
    expect(reviewPhotoValidationError({ mimeType: 'image/jpeg', fileSize: 9_000_000 })).toBeNull()
    expect(reviewPhotoValidationError({ mimeType: 'image/png', fileSize: 10 * 1024 * 1024 })).toBeNull()
    expect(reviewPhotoValidationError({ mimeType: 'image/webp', fileSize: 2_000 })).toBeNull()
  })

  it('rejects unsupported review photo types and oversized files', () => {
    expect(reviewPhotoValidationError({ mimeType: 'image/gif', fileSize: 1_000 })).toMatch(/JPEG, PNG, or WebP/)
    expect(reviewPhotoValidationError({ mimeType: 'video/mp4', fileSize: 1_000 })).toMatch(/JPEG, PNG, or WebP/)
    expect(reviewPhotoValidationError({ mimeType: 'image/jpeg', fileSize: 11 * 1024 * 1024 })).toMatch(/10 MB or smaller/)
    expect(reviewPhotoValidationError({ mimeType: 'image/jpeg', fileSize: null })).toMatch(/could not be verified/)
    expect(canAttachReviewPhoto({ mimeType: 'image/jpeg', fileSize: 9_000_000 })).toBe(true)
    expect(canAttachReviewPhoto({ mimeType: 'image/gif', fileSize: 1_000 })).toBe(false)
  })

  it('reviews the prepared media MIME so a native file without a type is rejected', () => {
    expect(reviewPhotoValidationError({ mimeType: '', fileSize: 9_000 })).toMatch(/JPEG, PNG, or WebP/)
    expect(reviewPhotoValidationError({ mimeType: 'application/octet-stream', fileSize: 9_000 })).toMatch(/JPEG, PNG, or WebP/)
  })

  it('rejects known bad photo metadata at selection time', () => {
    expect(reviewPhotoSelectionError({ mimeType: 'image/gif', fileSize: 1_000 })).toMatch(/JPEG, PNG, or WebP/)
    expect(reviewPhotoSelectionError({ mimeType: 'video/mp4', fileSize: 1_000 })).toMatch(/JPEG, PNG, or WebP/)
    expect(reviewPhotoSelectionError({ mimeType: 'image/jpeg', fileSize: 11 * 1024 * 1024 })).toMatch(/10 MB or smaller/)
    expect(reviewPhotoSelectionError({ mimeType: 'image/jpeg', fileSize: -3 })).toMatch(/could not be verified/)
  })

  it('defers unknown photo metadata to preparation instead of rejecting at selection', () => {
    expect(reviewPhotoSelectionError({})).toBeNull()
    expect(reviewPhotoSelectionError({ mimeType: undefined, fileSize: undefined })).toBeNull()
    expect(reviewPhotoSelectionError({ mimeType: null, fileSize: null })).toBeNull()
    expect(reviewPhotoSelectionError({ mimeType: 'image/jpeg' })).toBeNull()
    expect(reviewPhotoSelectionError({ mimeType: 'image/jpeg', fileSize: 9_000 })).toBeNull()
  })
})
