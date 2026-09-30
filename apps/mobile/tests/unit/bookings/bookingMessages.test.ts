import {
  bookingChatAvailability,
  bookingThreadSendError,
  buildTrustThreadItems,
  validateBookingMessageBody,
} from '@/data/bookingMessages'

describe('booking message input', () => {
  it('trims valid text and rejects empty messages', () => {
    expect(validateBookingMessageBody('  See you soon  ')).toEqual({ ok: true, body: 'See you soon' })
    expect(validateBookingMessageBody('   ')).toEqual({ ok: false, message: 'Write a message before sending.' })
  })

  it('enforces the 2,000 character client limit', () => {
    expect(validateBookingMessageBody('a'.repeat(2000))).toMatchObject({ ok: true })
    expect(validateBookingMessageBody('a'.repeat(2001))).toEqual({
      ok: false,
      message: 'Messages can be up to 2,000 characters.',
    })
  })
})

describe('booking chat availability', () => {
  it('opens live chat after the request is sent through the review window', () => {
    for (const status of ['request_sent', 'accepted', 'completed', 'review_window'] as const) {
      expect(bookingChatAvailability(status)).toMatchObject({ canRead: true, canSend: true })
    }
  })

  it('keeps history readable but locked for sending after decline or cancel', () => {
    for (const status of ['declined', 'cancelled', 'closed'] as const) {
      expect(bookingChatAvailability(status)).toMatchObject({ canRead: true, canSend: false })
    }
  })

  it('hides booking chat before the request exists', () => {
    expect(bookingChatAvailability('draft')).toMatchObject({ canRead: false, canSend: false })
  })

  it('explains the locked state without em dashes', () => {
    expect(bookingChatAvailability('cancelled').lockedCopy).not.toContain('—')
    expect(bookingThreadSendError('accepted')).toBeNull()
    expect(bookingThreadSendError('cancelled')).toContain('review window')
  })
})

describe('booking trust thread', () => {
  it('opens plan discussion for a fresh request', () => {
    const items = buildTrustThreadItems({ status: 'request_sent' })
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ tone: 'self', title: 'Private booking thread' })
    expect(items[1]).toMatchObject({ tone: 'social', title: 'Plan discussion open' })
  })

  it('confirms the plan after acceptance', () => {
    const items = buildTrustThreadItems({ status: 'accepted' })
    expect(items[1]).toMatchObject({ title: 'Plan confirmed' })
  })

  it('records shared reflection after both people complete', () => {
    const items = buildTrustThreadItems({ status: 'review_window', memberCompletedAt: 1, companionCompletedAt: 2 })
    expect(items[1]).toMatchObject({ title: 'Shared reflection' })
  })

  it('preserves the record after cancellation', () => {
    const items = buildTrustThreadItems({ status: 'cancelled' })
    expect(items[1].detail).toContain('safety records remain available')
  })
})
