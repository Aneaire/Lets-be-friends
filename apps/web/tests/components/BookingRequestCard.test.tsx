// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import { BookingRequestCard, type BookingRequestView } from '../../src/components/BookingRequestCard'

afterEach(cleanup)

const baseBooking: BookingRequestView = {
  bookingId: 'booking-1' as Id<'bookings'>,
  status: 'request_sent',
  category: 'Hobbies and skills',
  mode: 'online',
  requestedAt: new Date('2026-08-12T13:39:00+08:00').getTime(),
  durationMinutes: 60,
  notes: 'Bring your favorite game.',
  memberId: 'member-1' as Id<'users'>,
  memberDisplayName: 'Angelo',
  companionDisplayName: 'Michael Reeves',
  memberTotalCentavos: 57_500,
  companionEarningsCentavos: 50_000,
  settlementBlocked: false,
}

function renderCard(booking: BookingRequestView) {
  return render(
    <BookingRequestCard
      intro="Michael sent a booking request with the session details."
      booking={booking}
      viewerId={'companion-1' as Id<'users'>}
      onDecide={vi.fn()}
      onEdit={vi.fn()}
    />,
  )
}

describe('BookingRequestCard', () => {
  it('shows the full booking details while a request needs a decision', () => {
    const { container } = renderCard(baseBooking)

    expect(container.firstElementChild?.getAttribute('data-density')).toBe('full')
    expect(screen.getByText(/Michael sent a booking request/)).toBeTruthy()
    expect(screen.getByText(/Your entitlement/)).toBeTruthy()
    expect(screen.getByText(/Bring your favorite game/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accept request' })).toBeTruthy()
  })

  it('reduces an accepted booking to its essential summary', () => {
    const { container } = renderCard({ ...baseBooking, status: 'accepted' })

    expect(container.firstElementChild?.getAttribute('data-density')).toBe('compact')
    expect(screen.getByText('Accepted')).toBeTruthy()
    expect(screen.queryByText(/Michael sent a booking request/)).toBeNull()
    expect(screen.queryByText(/Your entitlement/)).toBeNull()
    expect(screen.queryByText(/Bring your favorite game/)).toBeNull()
  })
})
