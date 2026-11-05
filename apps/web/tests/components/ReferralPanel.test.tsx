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

import { ReferralPanel } from '../../src/features/referral/ReferralPanel'

afterEach(() => {
  cleanup()
  mocks.queryResult = undefined
  mocks.pageResult = { results: [], status: 'Exhausted', loadMore: vi.fn() }
  mocks.mutation.mockClear()
})

function referralSummary(overrides: Record<string, unknown> = {}) {
  return {
    code: 'ABCD1234',
    rewards: [],
    totalReferrals: 0,
    totalRewardedBookings: 0,
    totalEarnedCentavos: 0,
    totalReversedCentavos: 0,
    referredBy: null,
    ...overrides,
  }
}

describe('referral panel', () => {
  it('shows the share link and the 68% rule', () => {
    mocks.queryResult = referralSummary({
      totalReferrals: 1,
      totalRewardedBookings: 2,
      totalEarnedCentavos: 10_200,
    })
    mocks.pageResult = {
      results: [{
        _id: 'referral-1',
        referredDisplayName: 'Maya',
        status: 'active',
        rewardedBookings: 2,
        totalRewardedBookings: 3,
        createdAt: Date.now(),
      }],
      status: 'Exhausted',
      loadMore: vi.fn(),
    }

    render(<ReferralPanel />)

    expect(screen.getByText('Invite friends')).toBeTruthy()
    expect(screen.getAllByText(/68% of our 15% service fee/).length).toBeGreaterThan(0)
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
