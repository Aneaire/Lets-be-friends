// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  listApproved: [] as Array<Record<string, unknown>>,
  availability: 'available' as string,
  toastError: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: state.toastError }, Toaster: () => null }))

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
    if (query === 'users.viewer') {
      return {
        _id: 'member-1',
        displayName: 'Availability Member',
        role: 'member',
        verificationStatus: 'approved',
        identityEligible: true,
        suspended: false,
      }
    }
    if (query === 'users.latestMemberVerification') return null
    if (query === 'bookings.mine' || query === 'bookings.forCompanion') return []
    if (query === 'finance.memberDashboard') return { availableCentavos: 100_000 }
    if (query === 'finance.memberBookingTransactions') return []
    if (query === 'companions.listApproved') return state.listApproved
    if (query === 'companions.bookingAvailability') return state.availability
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
  createFileRoute: () => (options: object) => ({ ...options, useSearch: () => ({ companionProfileId: 'companion-1' }) }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}))

vi.mock('../../src/features/identity/IdentityVerificationFlow', () => ({
  useIdentityVerification: () => ({ begin: vi.fn(async () => ({ mode: 'launch' })), busy: false, message: '', error: '' }),
}))

import { Route } from '../../src/routes/app'

const AppPage = (Route as unknown as { component: () => ReactNode }).component

beforeEach(() => {
  state.listApproved = []
  state.availability = 'available'
  state.toastError.mockClear()
})

afterEach(cleanup)

describe('booking dialog Companion availability', () => {
  it('shows a toast naming the missing verification when the Companion is not verified', async () => {
    state.availability = 'not_verified'

    render(<AppPage />)

    await waitFor(() => {
      expect(state.toastError).toHaveBeenCalledWith('This Companion is not verified yet, so they cannot take new bookings.')
    })
  })

  it('explains a Companion who has no listed rate instead of blaming verification', async () => {
    state.availability = 'no_listed_rate'

    render(<AppPage />)

    await waitFor(() => {
      expect(state.toastError).toHaveBeenCalledWith('This Companion has not set a listed hourly rate yet, so booking is not available.')
    })
  })

  it('stays quiet while the Companion can take bookings', async () => {
    render(<AppPage />)

    await waitFor(() => {
      expect(screen.getByText('New booking')).toBeTruthy()
    })
    expect(state.toastError).not.toHaveBeenCalled()
  })
})
