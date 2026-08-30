// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { BookingsView, type BookingsViewMode } from '../../src/features/booking/BookingsView'

const bookings = [
  {
    _id: 'booking-august',
    requestedAt: new Date(2026, 7, 15, 10, 0).getTime(),
    status: 'accepted',
    companion: 'Mika',
  },
  {
    _id: 'booking-september',
    requestedAt: new Date(2026, 8, 3, 14, 0).getTime(),
    status: 'request_sent',
    companion: 'Rae',
  },
]

function TestBookingsView({ bookingId }: { bookingId?: string }) {
  const [view, setView] = useState<BookingsViewMode>('calendar')
  return (
    <BookingsView
      bookings={bookings}
      bookingId={bookingId}
      view={view}
      onViewChange={setView}
      now={new Date(2026, 7, 1, 9, 0)}
      renderBooking={(booking) => <article><h3>{booking.companion}</h3><p>Full booking details</p></article>}
      cards={<section><h2>Open bookings</h2><p>Current card list</p></section>}
    />
  )
}

afterEach(cleanup)

describe('BookingsView', () => {
  it('opens on the calendar and marks every date with a booking', () => {
    render(<TestBookingsView />)

    expect(screen.getByRole('button', { name: 'Calendar' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('gridcell', { name: /August 15, 2026, 1 booking/ }).getAttribute('data-has-bookings')).toBe('true')
    expect(screen.queryByText('Current card list')).toBeNull()
  })

  it('reveals the existing booking details when a marked date is selected', () => {
    render(<TestBookingsView />)

    fireEvent.click(screen.getByRole('gridcell', { name: /August 15, 2026, 1 booking/ }))
    expect(screen.getByRole('heading', { name: 'Mika' })).toBeTruthy()
    expect(screen.getByText('Full booking details')).toBeTruthy()
  })

  it('navigates between months and can return to today', () => {
    render(<TestBookingsView />)

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy()
    expect(screen.getByRole('gridcell', { name: /September 3, 2026, 1 booking/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeTruthy()
  })

  it('switches to the current cards presentation', () => {
    render(<TestBookingsView />)

    fireEvent.click(screen.getByRole('button', { name: 'Cards' }))
    expect(screen.getByRole('heading', { name: 'Open bookings' })).toBeTruthy()
    expect(screen.getByText('Current card list')).toBeTruthy()
  })

  it('selects and shows a booking from a deep link', () => {
    const onViewChange = vi.fn()
    render(
      <BookingsView
        bookings={bookings}
        bookingId="booking-september"
        view="calendar"
        onViewChange={onViewChange}
        now={new Date(2026, 7, 1)}
        renderBooking={(booking) => <h3>{booking.companion}</h3>}
        cards={null}
      />,
    )

    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Rae' })).toBeTruthy()
    expect(onViewChange).toHaveBeenCalledWith('calendar')
  })
})
