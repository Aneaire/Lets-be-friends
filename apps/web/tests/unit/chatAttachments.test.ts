import { describe, expect, it } from 'vitest'
import {
  CHAT_COMPRESSION_THRESHOLD_BYTES,
  actualCompressionPercent,
  chatAttachmentKind,
  formatFileSize,
  targetCompressionPercent,
} from '../../src/lib/chatAttachments'

const mib = 1024 * 1024

describe('chat attachment compression policy', () => {
  it('never compresses media below 3 MiB and scales reduction with file size', () => {
    expect(targetCompressionPercent(CHAT_COMPRESSION_THRESHOLD_BYTES - 1)).toBe(0)
    expect(targetCompressionPercent(3 * mib)).toBe(18)
    expect(targetCompressionPercent(8 * mib)).toBe(32)
    expect(targetCompressionPercent(20 * mib)).toBe(48)
    expect(targetCompressionPercent(50 * mib)).toBe(60)
    expect(targetCompressionPercent(100 * mib)).toBe(70)
  })

  it('reports actual savings rather than the target', () => {
    expect(actualCompressionPercent(10 * mib, 6 * mib)).toBe(40)
    expect(actualCompressionPercent(10 * mib, 10 * mib)).toBe(0)
    expect(actualCompressionPercent(10 * mib, 12 * mib)).toBe(0)
  })

  it('classifies attachments and formats compact sizes', () => {
    expect(chatAttachmentKind('image/webp')).toBe('image')
    expect(chatAttachmentKind('video/webm')).toBe('video')
    expect(chatAttachmentKind('application/pdf')).toBe('file')
    expect(formatFileSize(2.5 * mib)).toBe('2.5 MB')
    expect(formatFileSize(12 * mib)).toBe('12 MB')
  })
})
