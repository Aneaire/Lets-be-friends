// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  viewer: {
    _id: 'member-1',
    displayName: 'Empty Member',
    role: 'member',
    verificationStatus: 'approved',
    identityEligible: true,
    suspended: false,
  } as Record<string, unknown> | null,
  memberBookings: [] as Array<Record<string, unknown>> | undefined,
  companionBookings: [] as Array<Record<string, unknown>> | undefined,
  transactions: [] as Array<Record<string, unknown>> | undefined,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: { viewer: 'users.viewer', latestMemberVerification: 'users.latestMemberVerification' },
    bookings: { mine: 'bookings.mine', forCompanion: 'bookings.forCompanion', createDraft: 'bookings.createDraft', cancel: 'bookings.cancel', markCompleted: 'bookings.markCompleted', companionDecision: 'bookings.companionDecision', editRequest: 'bookings.editRequest', availableSlots: 'bookings.availableSlots' },
    finance: { memberDashboard: 'finance.memberDashboard', memberBookingTransactions: 'finance.memberBookingTransactions' },
    companions: { listApproved: 'companions.listApproved', getPublic: 'companions.getPublic', bookingAvailability: 'companions.bookingAvailability' },
    reviews: { submit: 'reviews.submit' },
    reports: { create: 'reports.create' },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => {
    if (query === 'users.viewer') return state.viewer
    if (query === 'users.latestMemberVerification') return null
    if (query === 'bookings.mine') return state.memberBookings
    if (query === 'bookings.forCompanion') return state.companionBookings
    if (query === 'finance.memberDashboard') return { availableCentavos: 100_000 }
    if (query === 'finance.memberBookingTransactions') return state.transactions
    if (query === 'companions.listApproved') return []
    if (query === 'companions.bookingAvailability') return 'available'
    if (query === 'bookings.availableSlots') return { timezone: 'Asia/Manila', scheduleConfigured: true, days: [] }
    if (query === 'companions.getPublic') return undefined
    return undefined
  },
  useMutation: () => vi.fn(async () => undefined),
}))

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ isSignedIn: true, userId: 'user-1' }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({ ...options, useSearch: () => ({}) }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}))

vi.mock('../../src/features/identity/IdentityVerificationFlow', () => ({
  useIdentityVerification: () => ({ begin: vi.fn(async () => ({ mode: 'launch' })), busy: false, message: '', error: '' }),
}))

import { Route } from '../../src/routes/app'

const AppPage = (Route as unknown as { component: () => ReactNode }).component

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function longDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

beforeEach(() => {
  state.viewer = {
    _id: 'member-1',
    displayName: 'Empty Member',
    role: 'member',
    verificationStatus: 'approved',
    identityEligible: true,
    suspended: false,
  }
  state.memberBookings = []
  state.companionBookings = []
  state.transactions = []
})

afterEach(cleanup)

describe('member /app calendar for a loaded account without bookings', () => {
  it('renders the current month grid instead of replacing the calendar with the empty state', () => {
    render(<AppPage />)

    const now = new Date()
    expect(screen.getByRole('heading', { name: 'Your bookings' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: monthLabel(now) })).toBeTruthy()
    expect(screen.getByRole('grid', { name: monthLabel(now) })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('No bookings yet.')).toBeNull()
  })

  it('navigates months and returns to today without any bookings', () => {
    render(<AppPage />)

    const now = new Date()
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('heading', { name: monthLabel(new Date(now.getFullYear(), now.getMonth() + 1, 1)) })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('heading', { name: monthLabel(now) })).toBeTruthy()
  })

  it('opens an empty date and explains there are no bookings on that day', () => {
    render(<AppPage />)

    const now = new Date()
    const emptyDate = new Date(now.getFullYear(), now.getMonth(), 15)
    fireEvent.click(screen.getByRole('gridcell', { name: longDate(emptyDate) }))

    const dialog = screen.getByRole('dialog', { name: longDate(emptyDate) })
    expect(within(dialog).getByText('No bookings on this day.')).toBeTruthy()
  })

  it('shows the empty state in Cards and opens the New booking dialog from Find a Companion', () => {
    render(<AppPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Cards' }))

    expect(screen.getByText('No bookings yet.')).toBeTruthy()
    expect(screen.queryByRole('grid')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Find a Companion' }))

    expect(screen.getByText('New booking')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Book a time' })).toBeTruthy()
  })

  it('shows the latest booking transactions at the bottom with a View more text link', () => {
    state.transactions = [{
      _id: 'transaction-1',
      kind: 'booking_complete',
      amountCentavos: 57_500,
      createdAt: Date.UTC(2026, 9, 20, 13, 30),
      bookingId: 'booking-1',
      category: 'Coffee and conversation',
      companionDisplayName: 'Dana Cruz',
    }]

    render(<AppPage />)

    expect(screen.getByRole('heading', { name: 'Recent transactions' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View more' }).getAttribute('href')).toBe('/transactions')
    expect(screen.getByRole('link', { name: /Booking completed/ }).getAttribute('href')).toBe('/app')
  })

  it('keeps the skeleton with no live grid while the member bookings query is incomplete', () => {
    state.memberBookings = undefined

    const { container } = render(<AppPage />)

    expect(container.querySelector('.app-page-skeleton')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Loading your bookings.')
    expect(screen.queryByRole('grid')).toBeNull()
    expect(screen.queryByText('No bookings yet.')).toBeNull()
  })

  it('keeps the skeleton with no live grid while the Companion bookings query is incomplete', () => {
    state.companionBookings = undefined

    const { container } = render(<AppPage />)

    expect(container.querySelector('.app-page-skeleton')).toBeTruthy()
    expect(screen.queryByRole('grid')).toBeNull()
    expect(screen.queryByText('No bookings yet.')).toBeNull()
  })
})
