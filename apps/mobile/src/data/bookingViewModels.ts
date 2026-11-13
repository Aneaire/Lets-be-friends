import {
  canCancelBooking,
  canCompleteBooking,
  formatPhp,
  type BookingStatus,
} from '@lets-be-friends/shared'

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1_000

export type BookingInputResult =
  | { ok: true; requestedAt: number; durationMinutes: number }
  | { ok: false; message: string }

export function parseManilaBookingInput(
  dateInput: string,
  timeInput: string,
  durationInput: string,
  now = Date.now(),
): BookingInputResult {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim())
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeInput.trim())
  if (!dateMatch || !timeMatch) {
    return { ok: false, message: 'Enter the date as YYYY-MM-DD and the time as HH:MM.' }
  }

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  const durationMinutes = Number(durationInput.trim())
  if (hour > 23 || minute > 59) return { ok: false, message: 'Enter a valid Manila time.' }
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 720 || durationMinutes % 15 !== 0) {
    return { ok: false, message: 'Duration must be 15 to 720 minutes in 15-minute steps.' }
  }

  const requestedAt = Date.UTC(year, month - 1, day, hour, minute) - MANILA_OFFSET_MS
  const roundTrip = new Date(requestedAt + MANILA_OFFSET_MS)
  if (
    roundTrip.getUTCFullYear() !== year
    || roundTrip.getUTCMonth() !== month - 1
    || roundTrip.getUTCDate() !== day
    || roundTrip.getUTCHours() !== hour
    || roundTrip.getUTCMinutes() !== minute
  ) return { ok: false, message: 'Enter a valid calendar date.' }
  if (requestedAt <= now) return { ok: false, message: 'Choose a future date and time.' }
  return { ok: true, requestedAt, durationMinutes }
}

export type BookingStatusTone = 'neutral' | 'self' | 'social' | 'success' | 'warning' | 'danger'

export const bookingStatusPresentation: Record<BookingStatus, { label: string; explanation: string; tone: BookingStatusTone }> = {
  draft: { label: 'Draft', explanation: 'This request has not been sent.', tone: 'neutral' },
  verification_required: { label: 'Verification required', explanation: 'Identity approval is needed before this request can continue.', tone: 'warning' },
  pending_admin_review: { label: 'Safety review', explanation: 'This request is waiting for a safety review.', tone: 'warning' },
  request_sent: { label: 'Request sent', explanation: 'The Companion can review this request.', tone: 'social' },
  accepted: { label: 'Accepted', explanation: 'The booking is confirmed.', tone: 'success' },
  declined: { label: 'Declined', explanation: 'The Companion declined this request.', tone: 'danger' },
  cancelled: { label: 'Cancelled', explanation: 'This booking was cancelled.', tone: 'danger' },
  completed: { label: 'Completed', explanation: 'The session was completed.', tone: 'success' },
  review_window: { label: 'Review window open', explanation: 'Both people confirmed. The review window is open.', tone: 'social' },
  closed: { label: 'Closed', explanation: 'This booking is closed.', tone: 'neutral' },
}

export function bookingActions(
  status: BookingStatus,
  {
    memberCompletedAt,
    companionCompletedAt,
    requestedAt,
    durationMinutes,
    completionSupported = false,
    now = Date.now(),
  }: {
    memberCompletedAt?: number
    companionCompletedAt?: number
    requestedAt?: number
    durationMinutes?: number
    completionSupported?: boolean
    now?: number
  } = {},
) {
  const completionStarted = memberCompletedAt !== undefined || companionCompletedAt !== undefined
  const sessionEnded = requestedAt !== undefined
    && durationMinutes !== undefined
    && requestedAt + durationMinutes * 60_000 <= now
  return {
    canCancel: canCancelBooking(status) && !completionStarted,
    canComplete: completionSupported && canCompleteBooking(status) && !completionStarted && sessionEnded,
    completionPending: canCompleteBooking(status) && memberCompletedAt !== undefined,
  }
}

export function formatBookingSchedule(timestamp: number) {
  const formatted = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
  return `${formatted} PHT`
}

export function formatDuration(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }
  return `${minutes} minutes`
}

export function formatBookingTotal(centavos: number | undefined) {
  return centavos === undefined ? undefined : formatPhp(centavos)
}
