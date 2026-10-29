export const MAX_MESSAGE_LENGTH = 2_000

export function validateMessageBody(value: string) {
  const body = value.trim()
  if (!body) return { ok: false as const, message: 'Write a message before sending.' }
  if (body.length > MAX_MESSAGE_LENGTH) {
    return { ok: false as const, message: `Messages can be up to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.` }
  }
  return { ok: true as const, body }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}

export function aggregateUnreadCount(conversations: ReadonlyArray<{ unreadCount: number }>) {
  return conversations.reduce((total, conversation) => {
    const count = Number.isSafeInteger(conversation.unreadCount) && conversation.unreadCount > 0 ? conversation.unreadCount : 0
    return Math.min(Number.MAX_SAFE_INTEGER, total + count)
  }, 0)
}

export function messageCounter(value: string) {
  return {
    count: value.length,
    remaining: MAX_MESSAGE_LENGTH - value.length,
    overLimit: value.length > MAX_MESSAGE_LENGTH,
  }
}

export const COMPACT_COUNTER_THRESHOLD = 1_800

export function shouldShowMessageCounter(count: number) {
  return count >= COMPACT_COUNTER_THRESHOLD
}

export const COMPOSER_MIN_HEIGHT = 44
export const COMPOSER_MAX_HEIGHT = 112

export function clampComposerHeight(measured: number) {
  if (!Number.isFinite(measured)) return COMPOSER_MIN_HEIGHT
  return Math.min(COMPOSER_MAX_HEIGHT, Math.max(COMPOSER_MIN_HEIGHT, Math.round(measured)))
}

export const LATEST_MESSAGE_FOLLOW_THRESHOLD = 96

/**
 * Keeps the newest message in view while the composer grows or the keyboard
 * opens, but leaves the list alone when the member has scrolled up to read.
 */
export function isMessageListAtLatest(input: { offsetY: number; contentHeight: number; viewportHeight: number }) {
  if (!Number.isFinite(input.contentHeight) || input.viewportHeight <= 0) return true
  const distanceFromEnd = input.contentHeight - input.viewportHeight - input.offsetY
  return distanceFromEnd <= LATEST_MESSAGE_FOLLOW_THRESHOLD
}

/**
 * Counts messages appended after the message the member last saw. Older pages
 * that load above it move its index without adding to the count. A missing
 * previous message means history was removed, not appended.
 */
export function countMessagesAfter<T extends { _id: string }>(messages: ReadonlyArray<T>, previousLatestId: string) {
  if (!previousLatestId) return 0
  const previousIndex = messages.findIndex((message) => String(message._id) === previousLatestId)
  if (previousIndex === -1) return 0
  return Math.max(0, messages.length - previousIndex - 1)
}

export function formatMessageTimestamp(timestamp: number, now = Date.now()) {
  const date = new Date(timestamp)
  const today = new Date(now)
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export function conversationPreview(body: string | undefined, attachmentCount: number) {
  if (body?.trim()) return body.trim()
  if (attachmentCount > 0) return attachmentCount === 1 ? 'Shared a file' : `Shared ${attachmentCount} files`
  return 'No messages yet'
}

export function conversationBookingCardView(booking: {
  bookingId: unknown
  memberId: unknown
  memberDisplayName: string
  companionDisplayName: string
  category: string
  mode: 'online' | 'in_person'
  requestedAt: number
  durationMinutes: number
  status: BookingStatus
  memberTotalCentavos?: number
  companionEarningsCentavos?: number
}, viewerId: string) {
  const viewerIsRequester = String(booking.memberId) === viewerId
  return {
    id: String(booking.bookingId),
    participantName: viewerIsRequester ? booking.companionDisplayName : booking.memberDisplayName,
    participantPreposition: 'with' as const,
    category: booking.category,
    mode: booking.mode,
    requestedAt: booking.requestedAt,
    durationMinutes: booking.durationMinutes,
    status: booking.status,
    memberTotalCentavos: booking.memberTotalCentavos,
    companionEarningsCentavos: booking.companionEarningsCentavos,
    viewerIsRequester,
  }
}
import type { BookingStatus } from '@lets-be-friends/shared'
