import { describe, expect, it } from 'vitest'
import { bookingMessagePresentation, conversationBookingThread, isActiveBookingStatus } from '../../src/lib/messageBookings'

describe('bookingMessagePresentation', () => {
  it('shows the latest update for each booking and floats only the newest booking card', () => {
    const presentation = bookingMessagePresentation([
      { booking: { bookingId: 'booking-a', status: 'request_sent' } },
      {},
      { booking: { bookingId: 'booking-b', status: 'request_sent' } },
      { booking: { bookingId: 'booking-a', status: 'accepted' } },
      {},
    ])

    expect([...presentation.lastIndexByBookingId.entries()]).toEqual([
      ['booking-a', 3],
      ['booking-b', 2],
    ])
    expect(presentation.floatingBookingIndex).toBe(3)
    expect(presentation.latestBookingStatus).toBe('accepted')
  })

  it('does not float anything in a conversation without a booking', () => {
    expect(bookingMessagePresentation([{}, {}]).floatingBookingIndex).toBe(-1)
  })

  it('stops floating an ended booking while exposing its latest status', () => {
    const presentation = bookingMessagePresentation([
      { booking: { bookingId: 'booking-a', status: 'completed' } },
    ])

    expect(presentation.floatingBookingIndex).toBe(-1)
    expect(presentation.latestBookingStatus).toBe('completed')
  })

  it('does not float a declined or cancelled booking', () => {
    expect(bookingMessagePresentation([
      { booking: { bookingId: 'booking-a', status: 'declined' } },
    ]).floatingBookingIndex).toBe(-1)
    expect(bookingMessagePresentation([
      { booking: { bookingId: 'booking-b', status: 'cancelled' } },
    ]).floatingBookingIndex).toBe(-1)
  })
})

describe('isActiveBookingStatus', () => {
  it('treats only request_sent and accepted as active', () => {
    expect(isActiveBookingStatus('request_sent')).toBe(true)
    expect(isActiveBookingStatus('accepted')).toBe(true)
    expect(isActiveBookingStatus('declined')).toBe(false)
    expect(isActiveBookingStatus('completed')).toBe(false)
    expect(isActiveBookingStatus(undefined)).toBe(false)
  })
})

describe('conversationBookingThread', () => {
  it('pins the newest active booking and lists the other distinct bookings newest first', () => {
    const { current, history } = conversationBookingThread([
      { booking: { bookingId: 'booking-a', status: 'request_sent' } },
      {},
      { booking: { bookingId: 'booking-b', status: 'request_sent' } },
      { booking: { bookingId: 'booking-a', status: 'accepted' } },
    ])

    expect(current?.booking.bookingId).toBe('booking-a')
    expect(current?.booking.status).toBe('accepted')
    expect(current?.messageIndex).toBe(3)
    expect(history.map((entry) => entry.booking.bookingId)).toEqual(['booking-b'])
  })

  it('dedupes repeated booking snapshots by keeping the newest status', () => {
    const { current, history } = conversationBookingThread([
      { booking: { bookingId: 'booking-a', status: 'request_sent' } },
      { booking: { bookingId: 'booking-a', status: 'accepted' } },
      { booking: { bookingId: 'booking-a', status: 'completed' } },
    ])

    expect(current).toBeUndefined()
    expect(history).toHaveLength(1)
    expect(history[0].booking.status).toBe('completed')
    expect(history[0].messageIndex).toBe(2)
  })

  it('orders history newest first across distinct bookings', () => {
    const { current, history } = conversationBookingThread([
      { booking: { bookingId: 'oldest', status: 'declined' } },
      { booking: { bookingId: 'middle', status: 'cancelled' } },
      { booking: { bookingId: 'newest', status: 'request_sent' } },
    ])

    expect(current?.booking.bookingId).toBe('newest')
    expect(history.map((entry) => entry.booking.bookingId)).toEqual(['middle', 'oldest'])
  })

  it('pins the newest active booking even when a newer booking has ended', () => {
    const { current, history } = conversationBookingThread([
      { booking: { bookingId: 'still-active', status: 'accepted' } },
      { booking: { bookingId: 'newer-ended', status: 'completed' } },
    ])

    expect(current?.booking.bookingId).toBe('still-active')
    expect(history.map((entry) => entry.booking.bookingId)).toEqual(['newer-ended'])
  })

  it('keeps every distinct booking in history when nothing is active', () => {
    const { current, history } = conversationBookingThread([
      { booking: { bookingId: 'booking-a', status: 'declined' } },
      { booking: { bookingId: 'booking-b', status: 'closed' } },
    ])

    expect(current).toBeUndefined()
    expect(history.map((entry) => entry.booking.bookingId)).toEqual(['booking-b', 'booking-a'])
  })

  it('ignores messages without booking data', () => {
    const { current, history } = conversationBookingThread([{}, { booking: null }])

    expect(current).toBeUndefined()
    expect(history).toEqual([])
  })
})
