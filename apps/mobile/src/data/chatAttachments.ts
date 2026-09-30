export const MAX_CHAT_ATTACHMENTS = 4
export const CHAT_COMPRESSION_THRESHOLD_BYTES = 3 * 1024 * 1024
export const MAX_CHAT_IMAGE_BYTES_BEFORE_COMPRESSION = 80 * 1024 * 1024
export const MAX_CHAT_VIDEO_BYTES_BEFORE_COMPRESSION = 250 * 1024 * 1024
export const MAX_CHAT_FILE_BYTES = 20 * 1024 * 1024

export type ChatAttachmentKind = 'image' | 'video' | 'file'

const allowedDocumentTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
])

export function chatAttachmentKind(mimeType: string): ChatAttachmentKind {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  return 'file'
}

export function targetCompressionPercent(size: number) {
  if (size < CHAT_COMPRESSION_THRESHOLD_BYTES) return 0
  const mib = size / 1024 / 1024
  if (mib < 8) return 18
  if (mib < 20) return 32
  if (mib < 50) return 48
  if (mib < 100) return 60
  return 70
}

export function actualCompressionPercent(originalSize: number, compressedSize: number) {
  if (originalSize <= 0 || compressedSize >= originalSize) return 0
  return Math.max(0, Math.min(99, Math.round((1 - compressedSize / originalSize) * 100)))
}

export function normalizeAttachmentFileName(name: string) {
  const trimmed = name.trim().slice(0, 160)
  return trimmed || 'attachment'
}

export type ChatAttachmentCandidate = {
  mimeType?: string | null
  fileSize?: number | null
  fileName?: string | null
}

/**
 * Mirrors the web chat attachment client validation so members see the same
 * limits before upload. Large phone photos and videos still need compression
 * before sending, which the conversation screen explains.
 */
export function validateChatAttachment(candidate: ChatAttachmentCandidate): string | null {
  const mimeType = candidate.mimeType ?? ''
  const kind = chatAttachmentKind(mimeType)
  if (kind === 'file' && !allowedDocumentTypes.has(mimeType)) {
    return 'Choose an image, video, PDF, text, Word, Excel, or PowerPoint file.'
  }
  const fileSize = candidate.fileSize
  if (typeof fileSize !== 'number' || !Number.isFinite(fileSize) || fileSize < 0) {
    return 'The selected file could not be verified. Please choose it again.'
  }
  if (kind === 'file' && fileSize > MAX_CHAT_FILE_BYTES) {
    return 'Documents must be 20 MB or smaller.'
  }
  if (kind === 'image' && fileSize > MAX_CHAT_IMAGE_BYTES_BEFORE_COMPRESSION) {
    return 'Images must be 80 MB or smaller before compression.'
  }
  if (kind === 'video' && fileSize > MAX_CHAT_VIDEO_BYTES_BEFORE_COMPRESSION) {
    return 'Videos must be 250 MB or smaller before compression.'
  }
  if (kind === 'image' && mimeType === 'image/gif' && fileSize >= CHAT_COMPRESSION_THRESHOLD_BYTES) {
    return 'Animated GIFs over 3 MB cannot be compressed. Choose a smaller GIF or a video.'
  }
  if (!candidate.fileName?.trim()) {
    return 'File name is required.'
  }
  return null
}

/**
 * Mobile devices do not re-encode large media in this client yet, so large
 * images and videos are held client side until a compressed copy is available.
 */
export function needsCompressionBeforeSend(kind: ChatAttachmentKind, fileSize: number) {
  return (kind === 'image' || kind === 'video') && fileSize >= CHAT_COMPRESSION_THRESHOLD_BYTES
}

export function describeChatAttachment(input: { fileSize: number; originalSize: number; compressionPercent: number }) {
  if (input.compressionPercent > 0) {
    return `${input.compressionPercent}% smaller after compression`
  }
  return 'Original quality, no compression applied'
}

export function canSubmitConversationMessage(input: {
  body: string
  readyAttachmentCount: number
  preparing: boolean
  hasErrors: boolean
  sending: boolean
}) {
  if (input.sending || input.preparing || input.hasErrors) return false
  if (input.body.trim()) return true
  return input.readyAttachmentCount > 0
}

export function attachmentSelectionError(input: { currentCount: number; selectedCount: number }) {
  const available = MAX_CHAT_ATTACHMENTS - input.currentCount
  if (available <= 0) return 'Messages can include up to 4 files. Remove one before adding another.'
  if (input.selectedCount > available) {
    return `Only the first ${available} file${available === 1 ? ' was' : 's were'} added. Messages can include up to 4 files.`
  }
  return null
}
