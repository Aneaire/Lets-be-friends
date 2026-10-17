// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Id } from '../../convex/_generated/dataModel'
import { BookingDialog, type ApprovedCompanionOption } from '../../src/features/booking/BookingDialog'

const state = vi.hoisted(() => ({
  availability: 'available' as string | undefined,
  toastError: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: state.toastError }, Toaster: () => null }))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    companions: { bookingAvailability: 'companions.bookingAvailability' },
    bookings: { availableSlots: 'bookings.availableSlots' },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => {
    if (query === 'companions.bookingAvailability') return state.availability
    if (query === 'bookings.availableSlots') return { timezone: 'Asia/Manila', scheduleConfigured: true, days: [] }
    return undefined
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
}))

const companion: ApprovedCompanionOption = {
  _id: 'companion-1',
  username: 'dana',
  displayName: 'Dana Cruz',
  city: 'Manila',
  strengths: ['Errands'],
  mode: 'both',
  profileImageUrl: 'https://example.test/dana.jpg',
}

function renderDialog(overrides: { restoreFocusTo?: HTMLElement | null } = {}) {
  const onClose = vi.fn()
  const setNotice = vi.fn()
  const createDraft = vi.fn(async () => ({
    bookingId: 'booking-123456' as Id<'bookings'>,
    memberTotalCentavos: 60_000,
    serviceSubtotalCentavos: 55_000,
    memberBookingFeeCentavos: 5_000,
    currency: 'PHP' as const,
  }))
  const view = render(
    <BookingDialog
      companions={[companion]}
      companionsLoading={false}
      fixedCompanion={companion}
      createDraft={createDraft}
      onClose={onClose}
      restoreFocusTo={overrides.restoreFocusTo ?? null}
      setNotice={setNotice}
    />,
  )
  return { ...view, onClose, setNotice, createDraft }
}

beforeEach(() => {
  state.availability = 'available'
  state.toastError.mockClear()
})

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('booking dialog modal frame', () => {
  it('locks body scroll while open and restores the previous value on unmount', () => {
    document.body.style.overflow = 'scroll'
    const { unmount } = renderDialog()

    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('renders the calendar beside the booking details with the calendar first in the DOM', () => {
    renderDialog()

    const layout = document.querySelector('.booking-dialog-layout')
    const calendarColumn = document.querySelector('.booking-dialog-calendar')
    const detailsColumn = document.querySelector('.booking-dialog-details')
    expect(layout).toBeTruthy()
    expect(calendarColumn).toBeTruthy()
    expect(detailsColumn).toBeTruthy()
    expect(screen.getByRole('region', { name: /availability calendar/i })).toBeTruthy()
    // Calendar column precedes the details column so it stacks first on mobile.
    expect(calendarColumn!.compareDocumentPosition(detailsColumn!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the Companion photo inside a bounded avatar with wrapping identity text', () => {
    renderDialog()

    const avatar = document.querySelector('.booking-companion-search-avatar')
    const image = avatar?.querySelector('img')
    const summaryText = document.querySelector('.booking-companion-summary-text')
    expect(avatar).toBeTruthy()
    expect(image?.getAttribute('src')).toBe('https://example.test/dana.jpg')
    expect(summaryText?.textContent).toContain('Dana Cruz')
    expect(summaryText?.textContent).toContain('@dana')
  })

  it('closes on Escape and returns focus to the opener', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { onClose } = renderDialog({ restoreFocusTo: opener })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.activeElement).toBe(opener))
    opener.remove()
  })

  it('closes on the close button and on an outside backdrop press, but not a press inside the dialog', () => {
    const { onClose } = renderDialog()

    fireEvent.mouseDown(screen.getByRole('dialog'))

    expect(onClose).not.toHaveBeenCalled()

    fireEvent.mouseDown(document.querySelector('.booking-dialog-backdrop')!)
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Close booking dialog' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('keeps the dialog open and the send button disabled until a future start is chosen', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: 'Book with Dana' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send booking' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
