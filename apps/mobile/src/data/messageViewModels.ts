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
