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

export const bookingStatusPresentation: Record<BookingStatus, { label: string; explanation: string }> = {
  draft: { label: 'Draft', explanation: 'This request has not been sent.' },
  verification_required: { label: 'Verification required', explanation: 'Identity approval is needed before this request can continue.' },
  pending_admin_review: { label: 'Safety review', explanation: 'This request is waiting for a safety review.' },
  request_sent: { label: 'Request sent', explanation: 'The Companion can review this request.' },
  accepted: { label: 'Accepted', explanation: 'The booking is confirmed.' },
  declined: { label: 'Declined', explanation: 'The Companion declined this request.' },
  cancelled: { label: 'Cancelled', explanation: 'This booking was cancelled.' },
  completed: { label: 'Completed', explanation: 'The session was completed.' },
  review_window: { label: 'Completed', explanation: 'The session was completed.' },
  closed: { label: 'Closed', explanation: 'This booking is closed.' },
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
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
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
