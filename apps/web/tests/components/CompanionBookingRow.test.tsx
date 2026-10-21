// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CompanionBooking } from '../../src/features/booking/combinedBookings'

const mocks = vi.hoisted(() => ({
  queryResult: undefined as unknown,
  toastWarning: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: mocks.toastWarning } }))

vi.mock('convex/react', () => ({
  useQuery: () => mocks.queryResult,
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, search, children, ...props }: { to: string; search?: unknown; children: ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

import { CompanionBookingRow, CompanionBookingRowView } from '../../src/features/booking/CompanionBookingRow'

afterEach(() => {
  cleanup()
  mocks.queryResult = undefined
  mocks.toastWarning.mockClear()
})

const booking = {
  _id: 'booking-1',
  memberId: 'member-1',
  memberDisplayName: 'Angelo',
  companionDisplayName: 'Viewer Companion',
  category: 'Hobbies and skills',
  mode: 'online',
  requestedAt: new Date('2026-08-12T13:39:00+08:00').getTime(),
  durationMinutes: 60,
  status: 'request_sent',
  pricingModel: 'legacy_cash',
  viewerHasReviewed: false,
} as unknown as CompanionBooking

function renderRow(overrides?: Partial<Parameters<typeof CompanionBookingRow>[0]>) {
  const handlers = {
    onAccept: vi.fn().mockResolvedValue(undefined),
    onDecline: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn().mockResolvedValue(undefined),
    onComplete: vi.fn().mockResolvedValue(undefined),
    onReview: vi.fn().mockResolvedValue(undefined),
    onReport: vi.fn().mockResolvedValue(undefined),
  }
  render(<CompanionBookingRow booking={booking} {...handlers} {...overrides} />)
  return handlers
}

describe('CompanionBookingRow', () => {
  it('renders the member name and the Companion decision actions with a unique DOM id', () => {
    const handlers = renderRow()

    expect(screen.getByRole('heading', { name: 'Angelo' })).toBeTruthy()
    expect(document.getElementById('companion-booking-booking-1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Report' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(handlers.onAccept).toHaveBeenCalledTimes(1)
  })

  it('links to the conversation with the member once one exists', () => {
    mocks.queryResult = 'conversation-1'

    renderRow()

    const link = screen.getByRole('link', { name: 'Open conversation' })
    expect(link.getAttribute('href')).toBe('/messages')
  })

  it('renders the semantic settlement panel for member-wallet bookings', () => {
    renderRow({
      booking: {
        ...booking,
        pricingModel: 'member_wallet_v2',
        companionEarningsCentavos: 50_000,
        memberTotalCentavos: 57_500,
        settlementState: 'pending',
        settlementEligibleAt: new Date('2026-08-12T13:39:00+08:00').getTime(),
      } as unknown as CompanionBooking,
    })

    expect(document.querySelector('[data-settlement="pending"]')).toBeTruthy()
    expect(screen.getByText('₱500.00')).toBeTruthy()
    expect(screen.getByText('Settlement pending')).toBeTruthy()
    expect(screen.queryByText(/Your entitlement:/)).toBeNull()
  })

  it('surfaces the readable server message when the Companion cannot complete the booking yet', async () => {
    const onComplete = vi.fn(() => Promise.reject(new Error(
      '[CONVEX M(bookings:markCompleted)] [Request ID: c5b4ed1b6a010a1f] Server Error Uncaught ConvexError: Booking cannot be completed before the scheduled session ends at handler (../../convex/bookings.ts:492:37) Called by client',
    )))
    renderRow({
      booking: { ...booking, status: 'accepted' } as unknown as CompanionBooking,
      onComplete,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Booking cannot be completed before the scheduled session ends')
    expect(alert.textContent).not.toMatch(/CONVEX|Request ID|bookings\.ts/)
    expect(screen.getByRole('button', { name: 'Confirm completion' }).hasAttribute('disabled')).toBe(false)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('tells the Companion the session is not done yet when completion is confirmed too early', () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    renderRow({
      booking: {
        ...booking,
        status: 'accepted',
        requestedAt: Date.now() + 60 * 60 * 1000,
        durationMinutes: 60,
      } as unknown as CompanionBooking,
      onComplete,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))

    expect(onComplete).not.toHaveBeenCalled()
    expect(mocks.toastWarning).toHaveBeenCalledTimes(1)
    expect(mocks.toastWarning.mock.calls[0][0]).toMatch(/^Your session is not done yet\./)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('CompanionBookingRowView', () => {
  const handlers = {
    onAccept: vi.fn().mockResolvedValue(undefined),
    onDecline: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn().mockResolvedValue(undefined),
    onComplete: vi.fn().mockResolvedValue(undefined),
    onReport: vi.fn().mockResolvedValue(undefined),
  }

  it('renders the review, evidence, and conversation slots the connected wrapper provides', () => {
    render(
      <CompanionBookingRowView
        booking={{ ...booking, status: 'review_window' } as unknown as CompanionBooking}
        {...handlers}
        reviewSlot={<button type="button">Leave review</button>}
        evidenceSlot={<p>Evidence decision</p>}
        conversationLink={<a href="/messages">Open conversation</a>}
      />,
    )

    expect(screen.getByRole('button', { name: 'Leave review' })).toBeTruthy()
    expect(screen.getByText('Evidence decision')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open conversation' })).toBeTruthy()
    expect(screen.queryByText('Review submitted')).toBeNull()
  })

  it('replaces the review slot with a link to the submitted review once the Companion has reviewed', () => {
    render(
      <CompanionBookingRowView
        booking={{ ...booking, status: 'review_window', viewerHasReviewed: true, viewerReviewId: 'review-1' } as unknown as CompanionBooking}
        {...handlers}
        reviewSlot={<button type="button">Leave review</button>}
      />,
    )

    const reviewLink = screen.getByRole('link', { name: 'View your review' })
    expect(reviewLink.getAttribute('href')).toBe('/review')
    expect(screen.queryByRole('button', { name: 'Leave review' })).toBeNull()
  })

  it('keeps the submitted review link available after the review window closes', () => {
    render(
      <CompanionBookingRowView
        booking={{ ...booking, status: 'closed', viewerHasReviewed: true, viewerReviewId: 'review-1' } as unknown as CompanionBooking}
        {...handlers}
      />,
    )

    expect(screen.getByRole('link', { name: 'View your review' }).getAttribute('href')).toBe('/review')
  })

  it('keeps the submitted note readable when the review id is unavailable', () => {
    render(
      <CompanionBookingRowView
        booking={{ ...booking, status: 'review_window', viewerHasReviewed: true } as unknown as CompanionBooking}
        {...handlers}
        reviewSlot={<button type="button">Leave review</button>}
      />,
    )

    expect(screen.getByText('Review submitted')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'View your review' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Leave review' })).toBeNull()
  })

  it('omits the review slot before the review window opens', () => {
    render(
      <CompanionBookingRowView
        booking={{ ...booking, status: 'accepted' } as unknown as CompanionBooking}
        {...handlers}
        reviewSlot={<button type="button">Leave review</button>}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Leave review' })).toBeNull()
    expect(screen.queryByText('Review submitted')).toBeNull()
  })
})
