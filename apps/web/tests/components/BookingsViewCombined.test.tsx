// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { BookingsView, type BookingsViewMode } from '../../src/features/booking/BookingsView'
import { companionStatusPresentation } from '../../src/features/booking/CompanionBookingRow'
import {
  calendarParticipantName,
  combineCalendarBookings,
  type CompanionBooking,
  type MemberBooking,
} from '../../src/features/booking/combinedBookings'

const combined = combineCalendarBookings(
  [{
    _id: 'booking-member',
    requestedAt: new Date(2026, 7, 15, 10, 0).getTime(),
    status: 'request_sent',
    companionDisplayName: 'Companion Mika',
    category: 'Coffee and meals',
    mode: 'in_person',
    durationMinutes: 60,
  } as unknown as MemberBooking],
  [{
    _id: 'booking-companion',
    requestedAt: new Date(2026, 7, 15, 14, 0).getTime(),
    status: 'request_sent',
    memberDisplayName: 'Member Angelo',
    companionDisplayName: 'Viewer Companion',
    category: 'Photography walk',
    mode: 'online',
    durationMinutes: 90,
  } as unknown as CompanionBooking],
)

function memberStatus(status: string) {
  if (status === 'accepted') return { label: 'Accepted', tone: 'success' as const }
  if (status === 'request_sent') return { label: 'Request sent', tone: 'social' as const }
  return { label: status, tone: 'self' as const }
}

function Harness({ bookingId }: { bookingId?: string }) {
  const [view, setView] = useState<BookingsViewMode>('calendar')
  return (
    <BookingsView
      bookings={combined}
      bookingId={bookingId}
      view={view}
      onViewChange={setView}
      now={new Date(2026, 7, 1, 9, 0)}
      participantName={calendarParticipantName}
      statusPresentation={(status, booking) =>
        booking.perspective === 'companion' ? companionStatusPresentation(status) : memberStatus(status)
      }
      renderBooking={(booking) => (
        <article>
          <h3>{calendarParticipantName(booking)}</h3>
          <p>Full booking details</p>
        </article>
      )}
      cards={<section><h2>Cards</h2></section>}
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

describe('combined member and Companion calendar', () => {
  it('feeds both perspectives into one calendar day and resolves each participant name', () => {
    render(<Harness />)

    expect(screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('gridcell', { name: /August 15, 2026, 2 bookings/ }))

    const dialog = screen.getByRole('dialog', { name: 'Saturday, August 15, 2026' })
    expect(within(dialog).getByRole('button', { name: /Companion Mika/ })).toBeTruthy()
    const memberEntry = within(dialog).getByRole('button', { name: /Companion Mika/ })
    const companionEntry = within(dialog).getByRole('button', { name: /Member Angelo/ })
    expect(within(memberEntry).getByText('Request sent')).toBeTruthy()
    expect(within(companionEntry).getByText('Needs decision')).toBeTruthy()
    expect(within(companionEntry).queryByText('Request sent')).toBeNull()
  })

  it('opens a Companion-side booking detail from the deep link using the member name', () => {
    render(<Harness bookingId="booking-companion" />)

    const detail = screen.getByRole('dialog', { name: 'Booking details' })
    expect(within(detail).getByRole('heading', { name: 'Member Angelo' })).toBeTruthy()
    expect(within(detail).getByText('Full booking details')).toBeTruthy()
  })
})
