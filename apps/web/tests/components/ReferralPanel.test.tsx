// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryResult: undefined as unknown,
  pageResult: { results: [] as Array<Record<string, unknown>>, status: 'Exhausted', loadMore: vi.fn() },
  mutation: vi.fn(async () => ({})),
}))

vi.mock('convex/react', () => ({
  useQuery: () => mocks.queryResult,
  useMutation: () => mocks.mutation,
  usePaginatedQuery: () => mocks.pageResult,
}))

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ userId: 'user-test' }),
}))

import { ReferralPanel } from '../../src/features/referral/ReferralPanel'

afterEach(() => {
  cleanup()
  mocks.queryResult = undefined
  mocks.pageResult = { results: [], status: 'Exhausted', loadMore: vi.fn() }
  mocks.mutation.mockClear()
  window.localStorage.removeItem('lets-be-friends-referral-code')
})

function referralSummary(overrides: Record<string, unknown> = {}) {
  return {
    code: 'ABCD1234',
    programActive: true,
    launchBonusActive: false,
    launchBonusCentavos: 5_000,
    launchBonusClaims: 0,
    launchBonusMaxClaims: 100,
    launchBonusAvailable: false,
    totalReferrals: 0,
    totalRewardedBookings: 0,
    totalEarnedCentavos: 0,
    totalPendingCentavos: 0,
    referralCreditAvailableCentavos: 0,
    totalReversedCentavos: 0,
    referralDebtCentavos: 0,
    canAddReferralCode: false,
    referredBy: null,
    ...overrides,
  }
}

describe('referral panel', () => {
  it('shows the share link and the 5% lifetime rule', () => {
    mocks.queryResult = referralSummary({
      totalReferrals: 1,
      totalRewardedBookings: 2,
      totalEarnedCentavos: 10_200,
      referralCreditAvailableCentavos: 4_200,
    })
    mocks.pageResult = {
      results: [{
        _id: 'referral-1',
        bookingId: 'booking-1',
        kind: 'lifetime',
        referredDisplayName: 'Maya',
        status: 'credited',
        rewardedBookings: 2,
        amountCentavos: 525,
        reviewRequired: false,
        createdAt: Date.now(),
        releasedAt: Date.now(),
      }],
      status: 'Exhausted',
      loadMore: vi.fn(),
    }

    render(<ReferralPanel />)

    expect(screen.getByText('Invite friends')).toBeTruthy()
    expect(screen.getAllByText(/5% of the booking subtotal/).length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue(/ref=ABCD1234/)).toBeTruthy()
    expect(screen.getAllByText('Maya').length).toBeGreaterThan(0)
    expect(screen.getByText('2 bookings rewarded')).toBeTruthy()
    // Available credit is the wallet sub-balance, not lifetime earned.
    expect(screen.getByText('₱42.00')).toBeTruthy()
    expect(screen.queryByText('₱102.00')).toBeNull()
  })

  it('creates a referral link when the member has no code', async () => {
    mocks.queryResult = referralSummary({ code: null })

    render(<ReferralPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Create my referral link' }))

    await waitFor(() => expect(mocks.mutation).toHaveBeenCalledWith(expect.objectContaining({ deviceId: expect.any(String) })))
  })

  it('shows a saved invitation without printing it as the member code', () => {
    window.localStorage.setItem('lets-be-friends-referral-code', 'ABCD12')
    mocks.queryResult = referralSummary({ code: null, canAddReferralCode: true })

    render(<ReferralPanel />)
    expect(screen.getByText(/Invitation ABCD12 will be added when you finish setup/)).toBeTruthy()
    expect(screen.queryByText(/Your code:/)).toBeNull()
  })

  it('removes the saved invitation when the member removes the code', async () => {
    window.localStorage.setItem('lets-be-friends-referral-code', 'ABCD12')
    mocks.queryResult = referralSummary({ code: null, canAddReferralCode: true, promptDismissedAt: null })

    render(<ReferralPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove this code' }))

    await waitFor(() => expect(window.localStorage.getItem('lets-be-friends-referral-code')).toBeNull())
    expect(screen.queryByText(/Invitation ABCD12/)).toBeNull()
  })

  it('hides the card when the member chooses not now', async () => {
    mocks.queryResult = referralSummary({ code: null, canAddReferralCode: true, promptDismissedAt: null })

    render(<ReferralPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    await waitFor(() => expect(mocks.mutation).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText(/Have a friend's code\?/)).toBeNull())
  })

  it('shows a check confirmation on the button after copying the link', async () => {
    mocks.queryResult = referralSummary()
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    render(<ReferralPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy())
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?ref=ABCD1234'))
    expect(screen.getByText('Referral link copied.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copied' }).querySelector('.referral-copy-check')).toBeTruthy()
  })

})
