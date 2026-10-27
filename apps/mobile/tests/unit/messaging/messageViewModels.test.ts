import {
  COMPACT_COUNTER_THRESHOLD,
  COMPOSER_MAX_HEIGHT,
  COMPOSER_MIN_HEIGHT,
  clampComposerHeight,
  conversationBookingCardView,
  MAX_MESSAGE_LENGTH,
  aggregateUnreadCount,
  conversationPreview,
  formatFileSize,
  messageCounter,
  shouldShowMessageCounter,
  validateMessageBody,
} from '@/data/messageViewModels'

describe('message view models', () => {
  it('trims valid text and rejects empty messages', () => {
    expect(validateMessageBody('  Hello  ')).toEqual({ ok: true, body: 'Hello' })
    expect(validateMessageBody('   ')).toEqual({ ok: false, message: 'Write a message before sending.' })
  })

  it('enforces the 2,000 character client limit', () => {
    expect(validateMessageBody('a'.repeat(MAX_MESSAGE_LENGTH))).toMatchObject({ ok: true })
    expect(validateMessageBody('a'.repeat(MAX_MESSAGE_LENGTH + 1))).toEqual({ ok: false, message: 'Messages can be up to 2,000 characters.' })
    expect(messageCounter('a'.repeat(MAX_MESSAGE_LENGTH + 1))).toEqual({ count: 2001, remaining: -1, overLimit: true })
  })

  it('formats file metadata without implying attachment access', () => {
    expect(formatFileSize(900)).toBe('900 B')
    expect(formatFileSize(1536)).toBe('1.5 KiB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MiB')
  })

  it('aggregates real unread counts and ignores invalid values', () => {
    expect(aggregateUnreadCount([{ unreadCount: 2 }, { unreadCount: 3 }, { unreadCount: 0 }])).toBe(5)
    expect(aggregateUnreadCount([{ unreadCount: -1 }, { unreadCount: 1.5 }, { unreadCount: 4 }])).toBe(4)
  })

  it('creates truthful inbox previews', () => {
    expect(conversationPreview('  See you soon  ', 0)).toBe('See you soon')
    expect(conversationPreview('', 1)).toBe('Shared a file')
    expect(conversationPreview(undefined, 3)).toBe('Shared 3 files')
    expect(conversationPreview(undefined, 0)).toBe('No messages yet')
  })

  it('adapts booking snapshots for each participant with the backend earnings field', () => {
    const snapshot = {
      bookingId: 'booking-1', memberId: 'member-1', memberDisplayName: 'Maya Member',
      companionDisplayName: 'Casey Companion', category: 'Coffee', mode: 'in_person' as const,
      requestedAt: 10, durationMinutes: 60, status: 'request_sent' as const,
      memberTotalCentavos: 115_000, companionEarningsCentavos: 100_000,
    }
    expect(conversationBookingCardView(snapshot, 'member-1')).toMatchObject({
      participantName: 'Casey Companion', viewerIsRequester: true,
      memberTotalCentavos: 115_000, companionEarningsCentavos: 100_000,
    })
    expect(conversationBookingCardView(snapshot, 'companion-user')).toMatchObject({
      participantName: 'Maya Member', viewerIsRequester: false,
      memberTotalCentavos: 115_000, companionEarningsCentavos: 100_000,
    })
  })

  it('shows the compact character counter only near the 2,000 limit', () => {
    expect(COMPACT_COUNTER_THRESHOLD).toBe(1_800)
    expect(shouldShowMessageCounter(0)).toBe(false)
    expect(shouldShowMessageCounter(1_799)).toBe(false)
    expect(shouldShowMessageCounter(1_800)).toBe(true)
    expect(shouldShowMessageCounter(2_001)).toBe(true)
  })

  it('bounds the compact composer between 44px and 112px', () => {
    expect(COMPOSER_MIN_HEIGHT).toBe(44)
    expect(COMPOSER_MAX_HEIGHT).toBe(112)
    expect(clampComposerHeight(20)).toBe(44)
    expect(clampComposerHeight(44)).toBe(44)
    expect(clampComposerHeight(72.4)).toBe(72)
    expect(clampComposerHeight(112)).toBe(112)
    expect(clampComposerHeight(400)).toBe(112)
    expect(clampComposerHeight(Number.NaN)).toBe(44)
  })
})
