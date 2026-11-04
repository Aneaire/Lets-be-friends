// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryResult: undefined as unknown,
  mutation: vi.fn(async () => ({})),
}))

vi.mock('convex/react', () => ({
  useQuery: () => mocks.queryResult,
  useMutation: () => mocks.mutation,
}))

import { ReferralPanel } from '../../src/features/referral/ReferralPanel'

afterEach(() => {
  cleanup()
  mocks.queryResult = undefined
  mocks.mutation.mockClear()
})

function referralSummary(overrides: Record<string, unknown> = {}) {
  return {
    code: 'ABCD1234',
    referrals: [],
    rewards: [],
    totalEarnedCentavos: 0,
    totalReversedCentavos: 0,
    referredBy: null,
    ...overrides,
  }
}

describe('referral panel', () => {
  it('shows the share link and the 68% rule', () => {
    mocks.queryResult = referralSummary({
      referrals: [{
        _id: 'referral-1',
        referredDisplayName: 'Maya',
        status: 'active',
        rewardedBookings: 2,
        totalRewardedBookings: 3,
        createdAt: Date.now(),
      }],
      totalEarnedCentavos: 10_200,
    })

    render(<ReferralPanel />)

    expect(screen.getByText('Invite friends')).toBeTruthy()
    expect(screen.getAllByText(/68% of our service fee/).length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue(/ref=ABCD1234/)).toBeTruthy()
    expect(screen.getByText('Maya')).toBeTruthy()
    expect(screen.getByText('2 of 3 bookings rewarded')).toBeTruthy()
  })

  it('creates a referral link when the member has no code', async () => {
    mocks.queryResult = referralSummary({ code: null })

    render(<ReferralPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Create my referral link' }))

    await waitFor(() => expect(mocks.mutation).toHaveBeenCalledWith({}))
  })

})
