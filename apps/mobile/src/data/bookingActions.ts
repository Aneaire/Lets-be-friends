import { canReviewBooking, type BookingStatus } from '@lets-be-friends/shared'

export type BookingDestination = `/booking/${string}` | `/companion-booking/${string}`

export function bookingDestinationForViewer(
  viewerId: string,
  booking: { bookingId: string; memberId: string; companionUserId?: string },
): BookingDestination | null {
  if (!viewerId || !booking.bookingId) return null
  const isMember = viewerId === booking.memberId
  const isCompanion = viewerId === booking.companionUserId
  if (isMember === isCompanion) return null
  return isMember ? `/booking/${booking.bookingId}` : `/companion-booking/${booking.bookingId}`
}

export function validateReportReason(reason: string) {
  const trimmedReason = reason.trim()
  if (!trimmedReason) return { ok: false as const, message: 'Explain why this booking needs a safety review.' }
  if (trimmedReason.length > 2_000) return { ok: false as const, message: 'Report details can be up to 2,000 characters.' }
  return { ok: true as const, reason: trimmedReason }
}

export function validateReviewInput(rating: number, body: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false as const, message: 'Choose a rating from 1 to 5.' }
  }
  const trimmedBody = body.trim()
  if (trimmedBody.length > 2_000) return { ok: false as const, message: 'Review text can be up to 2,000 characters.' }
  return { ok: true as const, rating, body: trimmedBody || undefined }
}

export function canSubmitBookingReview(status: BookingStatus, viewerHasReviewed: boolean) {
  return canReviewBooking(status) && !viewerHasReviewed
}
