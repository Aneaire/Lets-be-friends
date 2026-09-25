// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import { ConversationBookingPin } from '../../src/features/booking/ConversationBookingPin'
import type { BookingRequestView } from '../../src/features/booking/BookingRequestCard'

afterEach(cleanup)

function booking(overrides: Omit<Partial<BookingRequestView>, 'bookingId'> & { bookingId: string; category: string }): BookingRequestView {
  return {
    status: 'accepted',
    mode: 'online',
    requestedAt: new Date('2026-08-12T13:39:00+08:00').getTime(),
    durationMinutes: 60,
    memberId: 'member-1' as Id<'users'>,
    memberDisplayName: 'Angelo',
    companionDisplayName: 'Michael Reeves',
    settlementBlocked: false,
    ...overrides,
    bookingId: overrides.bookingId as Id<'bookings'>,
  }
}

const current = booking({ bookingId: 'booking-current', category: 'Hobbies and skills' })
const newerPrevious = booking({ bookingId: 'booking-newer', category: 'Coffee meetup', status: 'declined' })
const olderPrevious = booking({ bookingId: 'booking-older', category: 'City walk', status: 'completed' })

function renderPin(history: BookingRequestView[] = [newerPrevious, olderPrevious]) {
  const onDismiss = vi.fn()
  const onReport = vi.fn()
  const utils = render(
    <ConversationBookingPin
      booking={current}
      intro="Here are the session details."
      viewerId={'member-1' as Id<'users'>}
      history={history}
      onDecide={vi.fn()}
      onEdit={vi.fn()}
      onReport={onReport}
      onDismiss={onDismiss}
    />,
  )
  return { ...utils, onDismiss, onReport }
}

describe('ConversationBookingPin', () => {
  it('shows the current booking with dismiss, history, and report controls', () => {
    const { onReport } = renderPin()

    expect(screen.getByLabelText('Current booking')).toBeTruthy()
    expect(screen.getByText('Hobbies and skills')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide current booking' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Report booking request' }))
    expect(onReport).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss when the hide button is pressed', () => {
    const { onDismiss } = renderPin()

    fireEvent.click(screen.getByRole('button', { name: 'Hide current booking' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('opens a read-only history dialog with previous bookings newest first', () => {
    renderPin()

    fireEvent.click(screen.getByRole('button', { name: 'View previous bookings' }))

    const dialog = screen.getByRole('dialog', { name: 'Previous bookings' })
    const entries = within(dialog).getAllByRole('listitem')
    expect(entries).toHaveLength(2)
    expect(within(entries[0]).getByText('Coffee meetup')).toBeTruthy()
    expect(within(entries[1]).getByText('City walk')).toBeTruthy()
    expect(within(dialog).queryByText('Hobbies and skills')).toBeNull()

    expect(within(dialog).queryByRole('button', { name: 'Accept request' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Decline' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Edit request' })).toBeNull()
  })

  it('closes the history dialog without hiding the current booking', () => {
    const { onDismiss } = renderPin()

    fireEvent.click(screen.getByRole('button', { name: 'View previous bookings' }))
    expect(screen.getByRole('dialog', { name: 'Previous bookings' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(screen.queryByRole('dialog', { name: 'Previous bookings' })).toBeNull()
    expect(screen.getByText('Hobbies and skills')).toBeTruthy()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('shows a clear empty state when there are no previous bookings', () => {
    renderPin([])

    fireEvent.click(screen.getByRole('button', { name: 'View previous bookings' }))

    const dialog = screen.getByRole('dialog', { name: 'Previous bookings' })
    expect(within(dialog).getByText('No previous bookings in this conversation yet.')).toBeTruthy()
    expect(within(dialog).queryByRole('listitem')).toBeNull()
  })
})
