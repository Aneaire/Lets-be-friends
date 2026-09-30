import {
  actualCompressionPercent,
  attachmentSelectionError,
  canSubmitConversationMessage,
  chatAttachmentKind,
  describeChatAttachment,
  MAX_CHAT_ATTACHMENTS,
  needsCompressionBeforeSend,
  normalizeAttachmentFileName,
  targetCompressionPercent,
  validateChatAttachment,
} from '@/data/chatAttachments'

describe('chat attachment kinds', () => {
  it('classifies images, videos, and documents', () => {
    expect(chatAttachmentKind('image/jpeg')).toBe('image')
    expect(chatAttachmentKind('video/mp4')).toBe('video')
    expect(chatAttachmentKind('application/pdf')).toBe('file')
  })

  it('raises the target reduction as files grow', () => {
    expect(targetCompressionPercent(1024)).toBe(0)
    expect(targetCompressionPercent(4 * 1024 * 1024)).toBe(18)
    expect(targetCompressionPercent(60 * 1024 * 1024)).toBe(60)
  })

  it('measures the real reduction between original and upload', () => {
    expect(actualCompressionPercent(1000, 800)).toBe(20)
    expect(actualCompressionPercent(1000, 1000)).toBe(0)
    expect(actualCompressionPercent(0, 0)).toBe(0)
  })
})

describe('chat attachment validation', () => {
  it('accepts a small photo with a file name', () => {
    expect(validateChatAttachment({ mimeType: 'image/jpeg', fileSize: 500_000, fileName: 'park.jpg' })).toBeNull()
  })

  it('rejects unsupported document types', () => {
    expect(validateChatAttachment({ mimeType: 'application/zip', fileSize: 1000, fileName: 'archive.zip' }))
      .toBe('Choose an image, video, PDF, text, Word, Excel, or PowerPoint file.')
  })

  it('rejects documents over 20 MB', () => {
    expect(validateChatAttachment({ mimeType: 'application/pdf', fileSize: 21 * 1024 * 1024, fileName: 'notes.pdf' }))
      .toBe('Documents must be 20 MB or smaller.')
  })

  it('rejects oversized source images and videos', () => {
    expect(validateChatAttachment({ mimeType: 'image/jpeg', fileSize: 81 * 1024 * 1024, fileName: 'photo.jpg' }))
      .toBe('Images must be 80 MB or smaller before compression.')
    expect(validateChatAttachment({ mimeType: 'video/mp4', fileSize: 251 * 1024 * 1024, fileName: 'clip.mp4' }))
      .toBe('Videos must be 250 MB or smaller before compression.')
  })

  it('rejects large animated GIFs that cannot be compressed', () => {
    expect(validateChatAttachment({ mimeType: 'image/gif', fileSize: 4 * 1024 * 1024, fileName: 'fun.gif' }))
      .toBe('Animated GIFs over 3 MB cannot be compressed. Choose a smaller GIF or a video.')
  })

  it('requires a verifiable size and a file name', () => {
    expect(validateChatAttachment({ mimeType: 'image/jpeg', fileSize: null, fileName: 'photo.jpg' }))
      .toBe('The selected file could not be verified. Please choose it again.')
    expect(validateChatAttachment({ mimeType: 'image/jpeg', fileSize: 1000, fileName: '   ' }))
      .toBe('File name is required.')
  })
})

describe('mobile compression gate', () => {
  it('holds large photos and videos for a smaller copy', () => {
    expect(needsCompressionBeforeSend('image', 4 * 1024 * 1024)).toBe(true)
    expect(needsCompressionBeforeSend('video', 3 * 1024 * 1024)).toBe(true)
    expect(needsCompressionBeforeSend('image', 1024)).toBe(false)
    expect(needsCompressionBeforeSend('file', 10 * 1024 * 1024)).toBe(false)
  })

  it('describes compressed and original uploads truthfully', () => {
    expect(describeChatAttachment({ fileSize: 800, originalSize: 1000, compressionPercent: 20 }))
      .toBe('20% smaller after compression')
    expect(describeChatAttachment({ fileSize: 1000, originalSize: 1000, compressionPercent: 0 }))
      .toBe('Original quality, no compression applied')
  })

  it('normalizes file names to the backend limit', () => {
    expect(normalizeAttachmentFileName('  notes.pdf  ')).toBe('notes.pdf')
    expect(normalizeAttachmentFileName('   ')).toBe('attachment')
    expect(normalizeAttachmentFileName(`a`.repeat(200))).toHaveLength(160)
  })
})

describe('conversation submit readiness', () => {
  it('sends text alone or attachments alone', () => {
    const base = { readyAttachmentCount: 0, preparing: false, hasErrors: false, sending: false }
    expect(canSubmitConversationMessage({ ...base, body: 'Hello' })).toBe(true)
    expect(canSubmitConversationMessage({ ...base, body: '   ', readyAttachmentCount: 1 })).toBe(true)
    expect(canSubmitConversationMessage({ ...base, body: '   ' })).toBe(false)
  })

  it('blocks sending while busy or when a file failed', () => {
    const base = { body: 'Hello', readyAttachmentCount: 0, preparing: false, hasErrors: false, sending: false }
    expect(canSubmitConversationMessage({ ...base, preparing: true })).toBe(false)
    expect(canSubmitConversationMessage({ ...base, hasErrors: true })).toBe(false)
    expect(canSubmitConversationMessage({ ...base, sending: true })).toBe(false)
  })

  it('enforces the four file cap with clear copy', () => {
    expect(attachmentSelectionError({ currentCount: MAX_CHAT_ATTACHMENTS, selectedCount: 1 }))
      .toBe('Messages can include up to 4 files. Remove one before adding another.')
    expect(attachmentSelectionError({ currentCount: 3, selectedCount: 2 }))
      .toBe('Only the first 1 file was added. Messages can include up to 4 files.')
    expect(attachmentSelectionError({ currentCount: 1, selectedCount: 2 })).toBeNull()
  })
})
