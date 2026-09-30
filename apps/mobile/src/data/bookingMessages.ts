import { canBookingChat, canReadBookingMessages, type BookingStatus } from '@lets-be-friends/shared'

import type { TrustThreadItem } from '@/features/booking/TrustThread'

export const MAX_BOOKING_MESSAGE_LENGTH = 2_000

export function validateBookingMessageBody(value: string) {
  const body = value.trim()
  if (!body) return { ok: false as const, message: 'Write a message before sending.' }
  if (body.length > MAX_BOOKING_MESSAGE_LENGTH) {
    return { ok: false as const, message: `Messages can be up to ${MAX_BOOKING_MESSAGE_LENGTH.toLocaleString()} characters.` }
  }
  return { ok: true as const, body }
}

export function bookingChatAvailability(status: BookingStatus) {
  const canRead = canReadBookingMessages(status)
  const canSend = canBookingChat(status)
  return {
    canRead,
    canSend,
    emptyCopy: canRead
      ? 'No booking messages yet. Say hello when you are ready.'
      : 'Booking messages are not available for this booking state.',
    lockedCopy: 'Booking chat opens after the request is sent and stays available through the review window.',
  }
}

export function buildTrustThreadItems(input: {
  status: BookingStatus
  memberCompletedAt?: number
  companionCompletedAt?: number
}): TrustThreadItem[] {
  const jointlyCompleted = input.memberCompletedAt !== undefined && input.companionCompletedAt !== undefined
  const items: TrustThreadItem[] = [
    {
      title: 'Private booking thread',
      detail: 'Only the member and the Companion can read these messages.',
      tone: 'self',
    },
  ]
  if (input.status === 'request_sent') {
    items.push({
      title: 'Plan discussion open',
      detail: 'Use this thread to confirm schedule, format, and expectations before the session.',
      tone: 'social',
    })
  } else if (input.status === 'accepted') {
    items.push({
      title: 'Plan confirmed',
      detail: 'The Companion accepted. Keep arrival details and changes in this thread.',
      tone: 'social',
    })
  } else if (jointlyCompleted || input.status === 'review_window' || input.status === 'closed') {
    items.push({
      title: 'Shared reflection',
      detail: 'Both completion checks are recorded. Reviews open from this booking.',
      tone: 'social',
    })
  } else {
    items.push({
      title: 'Record preserved',
      detail: 'Existing messages and safety records remain available to both people.',
      tone: 'social',
    })
  }
  return items
}

export function bookingThreadSendError(status: BookingStatus) {
  if (canBookingChat(status)) return null
  return 'Booking chat opens after the request is sent and stays available through the review window.'
}
