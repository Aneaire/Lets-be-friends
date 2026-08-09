import { describe, expect, it } from 'vitest'
import { bookingMessagePresentation } from './messageBookings'

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
