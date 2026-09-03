import { canReviewBooking, type BookingStatus } from '@lets-be-friends/shared'

export type BookingDestination = `/booking/${string}` | `/companion-booking/${string}`

const MAX_REVIEW_BODY_LENGTH = 1_000
const MAX_REVIEW_COMMENT_LENGTH = 500
const MAX_REVIEW_PHOTO_BYTES = 10 * 1024 * 1024
const REVIEW_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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
  if (trimmedBody.length > MAX_REVIEW_BODY_LENGTH) return { ok: false as const, message: `Review text can be up to ${MAX_REVIEW_BODY_LENGTH} characters.` }
  return { ok: true as const, rating, body: trimmedBody || undefined }
}

export function canSubmitBookingReview(status: BookingStatus, viewerHasReviewed: boolean) {
  return canReviewBooking(status) && !viewerHasReviewed
}

export function validateReviewComment(body: string) {
  const trimmedBody = body.trim()
  if (!trimmedBody) return { ok: false as const, message: 'Write a comment before posting.' }
  if (trimmedBody.length > MAX_REVIEW_COMMENT_LENGTH) return { ok: false as const, message: `Review comments can be up to ${MAX_REVIEW_COMMENT_LENGTH} characters.` }
  return { ok: true as const, body: trimmedBody }
}

export function reviewPhotoValidationError(candidate: { mimeType?: string | null; fileSize?: number | null }) {
  if (!candidate.mimeType || !REVIEW_PHOTO_TYPES.has(candidate.mimeType)) {
    return 'Review photos must be JPEG, PNG, or WebP.'
  }
  if (typeof candidate.fileSize !== 'number' || !Number.isFinite(candidate.fileSize) || candidate.fileSize < 0) {
    return 'The selected review photo could not be verified.'
  }
  if (candidate.fileSize > MAX_REVIEW_PHOTO_BYTES) return 'Review photos must be 10 MB or smaller.'
  return null
}

export function reviewPhotoSelectionError(candidate: { mimeType?: string | null; fileSize?: number | null }) {
  if (candidate.mimeType && !REVIEW_PHOTO_TYPES.has(candidate.mimeType)) {
    return 'Review photos must be JPEG, PNG, or WebP.'
  }
  if (typeof candidate.fileSize === 'number' && Number.isFinite(candidate.fileSize)) {
    if (candidate.fileSize < 0) return 'The selected review photo could not be verified.'
    if (candidate.fileSize > MAX_REVIEW_PHOTO_BYTES) return 'Review photos must be 10 MB or smaller.'
  }
  return null
}

export function canAttachReviewPhoto(candidate: { mimeType?: string | null; fileSize?: number | null }) {
  return reviewPhotoValidationError(candidate) === null
}
