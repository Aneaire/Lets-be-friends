// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { BookingsView, type BookingsViewMode, type CalendarBooking } from '../../src/features/booking/BookingsView'

type TestBooking = CalendarBooking & {
  companionDisplayName: string
  memberDisplayName?: string
  category: string
  mode: string
  durationMinutes: number
}

const bookings: TestBooking[] = [
  {
    _id: 'booking-mika',
    requestedAt: new Date(2026, 7, 15, 10, 0).getTime(),
    status: 'accepted',
    companionDisplayName: 'Mika',
    category: 'Coffee and meals',
    mode: 'in_person',
    durationMinutes: 60,
  },
  {
    _id: 'booking-rae',
    requestedAt: new Date(2026, 7, 15, 14, 0).getTime(),
    status: 'request_sent',
    companionDisplayName: 'Rae',
    category: 'Photography walk',
    mode: 'online',
    durationMinutes: 90,
  },
  {
    _id: 'booking-jun',
    requestedAt: new Date(2026, 8, 3, 9, 30).getTime(),
    status: 'accepted',
    companionDisplayName: 'Jun',
    category: 'Good company',
    mode: 'both',
    durationMinutes: 120,
  },
]

function Harness({
  bookingId,
  items = bookings,
  participantName,
}: {
  bookingId?: string
  items?: TestBooking[]
  participantName?: (booking: TestBooking) => string
}) {
  const [view, setView] = useState<BookingsViewMode>('calendar')
  return (
    <BookingsView
      bookings={items}
      bookingId={bookingId}
      view={view}
      onViewChange={setView}
      now={new Date(2026, 7, 1, 9, 0)}
      participantName={participantName}
      renderBooking={(booking) => <article><h3>{booking.companionDisplayName}</h3><p>Full booking details</p></article>}
      cards={<section><h2>Open bookings</h2><p>Current card list</p></section>}
    />
  )
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.style.overflow = ''
})

describe('BookingsView', () => {
  it('opens on a calendar-only state without any dialog', () => {
    render(<Harness />)

    expect(screen.getByRole('button', { name: 'Calendar' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ })).toBeTruthy()
    expect(screen.queryByText('Current card list')).toBeNull()
  })

  it('lists every booking on a date with name, time, status, and session summary', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ }))

    const dialog = screen.getByRole('dialog', { name: 'Saturday, August 15, 2026' })
    const mika = within(dialog).getByRole('button', { name: /Mika/ })
    expect(within(mika).getByText('Accepted')).toBeTruthy()
    expect(within(mika).getByText(/10:00/)).toBeTruthy()
    expect(within(mika).getByText(/Coffee and meals · In-person · 1 hr/)).toBeTruthy()

    const rae = within(dialog).getByRole('button', { name: /Rae/ })
    expect(within(rae).getByText('Request sent')).toBeTruthy()
    expect(within(rae).getByText(/2:00/)).toBeTruthy()
    expect(within(rae).getByText(/Photography walk · Online · 1 hr 30 min/)).toBeTruthy()
  })

  it('names day summaries with a caller-provided participant resolver', () => {
    const memberBookings = bookings.map((booking) => ({
      ...booking,
      memberDisplayName: `Member of ${booking.companionDisplayName}`,
    }))
    render(<Harness items={memberBookings} participantName={(booking) => booking.memberDisplayName ?? 'Member'} />)

    fireEvent.click(screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ }))

    const dialog = screen.getByRole('dialog', { name: 'Saturday, August 15, 2026' })
    expect(within(dialog).getByRole('button', { name: /Member of Mika/ })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: /Member of Rae/ })).toBeTruthy()
    expect(within(dialog).queryByText('Mika')).toBeNull()
    expect(within(dialog).queryByText('Rae')).toBeNull()
  })

  it('opens a separate detail dialog and returns to the day list with Back', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Mika/ }))

    const detail = screen.getByRole('dialog', { name: 'Booking details' })
    expect(within(detail).getByRole('heading', { name: 'Mika' })).toBeTruthy()
    expect(within(detail).getByText('Full booking details')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Rae/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByRole('dialog', { name: 'Saturday, August 15, 2026' })).toBeTruthy()
    const mikaSummary = screen.getByRole('button', { name: /Mika/ })
    expect(screen.getByRole('button', { name: /Rae/ })).toBeTruthy()
    expect(document.activeElement).toBe(mikaSummary)
  })

  it('closes the dialog on Escape', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Mika/ }))
    expect(screen.getByRole('dialog', { name: 'Booking details' })).toBeTruthy()

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Booking details' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows an empty state for a date without bookings', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('gridcell', { name: /August 19, 2026$/ }))

    const dialog = screen.getByRole('dialog', { name: 'Wednesday, August 19, 2026' })
    expect(within(dialog).getByText('No bookings on this day.')).toBeTruthy()
  })

  it('navigates between months and can return to today', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy()
    expect(screen.getByRole('gridcell', { name: /September 3, 2026, 1 booking/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeTruthy()
  })

  it('switches to the cards presentation', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Cards' }))
    expect(screen.getByRole('heading', { name: 'Open bookings' })).toBeTruthy()
    expect(screen.getByText('Current card list')).toBeTruthy()
    expect(screen.queryByRole('grid')).toBeNull()
  })

  it('opens the linked booking detail from a deep link', () => {
    render(<Harness bookingId="booking-jun" />)

    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy()
    const detail = screen.getByRole('dialog', { name: 'Booking details' })
    expect(within(detail).getByRole('heading', { name: 'Jun' })).toBeTruthy()
    expect(within(detail).getByText('Full booking details')).toBeTruthy()
  })

  it('does not reopen a dismissed deep link when bookings refresh reactively', () => {
    const { rerender } = render(<Harness bookingId="booking-jun" />)

    expect(screen.getByRole('dialog', { name: 'Booking details' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    rerender(<Harness bookingId="booking-jun" items={[...bookings]} />)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Jun' })).toBeNull()
  })

  it('returns to the day list when the open booking is removed reactively', () => {
    const { rerender } = render(<Harness />)

    fireEvent.click(screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Mika/ }))
    expect(screen.getByRole('dialog', { name: 'Booking details' })).toBeTruthy()

    rerender(<Harness items={bookings.filter((booking) => booking._id !== 'booking-mika')} />)

    const dialog = screen.getByRole('dialog', { name: 'Saturday, August 15, 2026' })
    expect(within(dialog).getByRole('button', { name: /Rae/ })).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: /Mika/ })).toBeNull()
  })

  it('restores focus to the clicked date when the day dialog is closed directly', () => {
    render(<Harness />)

    const dateCell = screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ })
    dateCell.focus()
    fireEvent.click(dateCell)

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Saturday, August 15, 2026' }), { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ }))
  })

  it('moves focus into the detail dialog when a focused summary is clicked, then restores it on close', () => {
    render(<Harness />)

    const dateCell = screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ })
    dateCell.focus()
    expect(document.activeElement).toBe(dateCell)
    fireEvent.click(dateCell)

    const mikaSummary = within(screen.getByRole('dialog', { name: 'Saturday, August 15, 2026' }))
      .getByRole('button', { name: /Mika/ })
    mikaSummary.focus()
    expect(document.activeElement).toBe(mikaSummary)
    fireEvent.click(mikaSummary)

    const detail = screen.getByRole('dialog', { name: 'Booking details' })
    expect(detail.contains(document.activeElement)).toBe(true)

    fireEvent.keyDown(detail, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ }))
  })

  it('restores focus to an outside-month date after detail is closed and the grid changes', () => {
    render(<Harness />)

    const outsideCell = screen.getByRole('gridcell', { name: /September 3, 2026, 1 booking/ })
    outsideCell.focus()
    fireEvent.click(outsideCell)

    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeTruthy()
    const dayDialog = screen.getByRole('dialog', { name: 'Thursday, September 3, 2026' })
    const junSummary = within(dayDialog).getByRole('button', { name: /Jun/ })
    junSummary.focus()
    fireEvent.click(junSummary)

    expect(screen.getByRole('dialog', { name: 'Booking details' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(document.activeElement).toBe(within(screen.getByRole('dialog')).getByRole('button', { name: /Jun/ }))

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('gridcell', { name: /September 3, 2026, 1 booking/ }))
  })

  it('keeps focus inside the day dialog when the open detail booking is removed reactively', () => {
    const { rerender } = render(<Harness />)

    fireEvent.click(screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ }))
    const mikaSummary = within(screen.getByRole('dialog')).getByRole('button', { name: /Mika/ })
    mikaSummary.focus()
    fireEvent.click(mikaSummary)
    expect(screen.getByRole('dialog', { name: 'Booking details' })).toBeTruthy()

    rerender(<Harness items={bookings.filter((booking) => booking._id !== 'booking-mika')} />)

    const dayDialog = screen.getByRole('dialog', { name: 'Saturday, August 15, 2026' })
    expect(dayDialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(within(dayDialog).getByRole('button', { name: /Rae/ }))
  })
})
