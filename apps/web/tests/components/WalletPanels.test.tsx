// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listAction: vi.fn(),
  queryResult: undefined as unknown,
}))

vi.mock('convex/react', () => ({
  useAction: () => mocks.listAction,
  useMutation: () => vi.fn(),
  useQuery: () => mocks.queryResult,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    search,
    children,
    ...props
  }: {
    to: string
    search?: Record<string, string>
    children: ReactNode
  }) => {
    const query = search ? `?${new URLSearchParams(search).toString()}` : ''
    return <a href={`${to}${query}`} {...props}>{children}</a>
  },
}))

import { CompanionWithdrawalPanel } from '../../src/features/wallet/CompanionWithdrawalPanel'
import { MemberWalletPanel } from '../../src/features/wallet/MemberWalletPanel'

afterEach(() => {
  cleanup()
  mocks.queryResult = undefined
  mocks.listAction.mockReset()
})

const memberFinance = {
  currency: 'PHP' as const,
  availableCentavos: 24_500_00,
  reservedCentavos: 1_300_00,
  pendingCentavos: 0,
  enabled: true,
  testCreditEnabled: false,
  topUps: [],
}

describe('dedicated wallet page panels', () => {
  it('shows the booking balance with the PayMongo QR Ph top-up option', () => {
    render(
      <MemberWalletPanel finance={memberFinance} onCreateTopUp={async () => {}} onAddTestCredit={async () => {}} />,
    )

    expect(screen.getByRole('heading', { name: 'Booking balance' })).toBeTruthy()
    expect(screen.getByText('Add balance with PayMongo QR Ph')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create QR Ph top-up' })).toBeTruthy()
    expect(screen.getByText('No member-wallet top-up attempt yet.')).toBeTruthy()
  })

  it('shows a loading state while the booking wallet connects', () => {
    render(
      <MemberWalletPanel finance={undefined} onCreateTopUp={async () => {}} onAddTestCredit={async () => {}} />,
    )

    expect(screen.getByText('Loading booking wallet…')).toBeTruthy()
  })

  it('shows the earnings withdrawal section while provider settings load', () => {
    render(<CompanionWithdrawalPanel />)

    expect(screen.getByRole('heading', { name: 'Withdraw earnings' })).toBeTruthy()
    expect(screen.getByText('Loading withdrawal settings…')).toBeTruthy()
  })

  it('replaces raw server errors with verification guidance', async () => {
    mocks.queryResult = {
      enabled: true,
      payoutMethod: null,
      activeWithdrawalId: null,
      withdrawals: [],
      minimumCentavos: 10_000,
      maximumCentavos: 5_000_000,
      availableEarningsCentavos: 50_000,
    }
    mocks.listAction.mockRejectedValueOnce(
      new Error('[CONVEX A(withdrawals:listReceivingInstitutions)] [Request ID: c5b4ed1b6a010a1f] Server Error Uncaught Error: Current identity verification is required for withdrawals at assertEligibleCompanion (../../convex/withdrawals.ts:601:20) Called by client'),
    )
    render(<CompanionWithdrawalPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Set up payout method' }))

    expect(await screen.findByText(/Complete identity verification first/)).toBeTruthy()
    expect(screen.queryByText(/CONVEX/)).toBeNull()
    expect(screen.queryByText(/assertEligibleCompanion/)).toBeNull()
    const verifyLink = screen.getByRole('link', { name: 'Verify identity' })
    expect(verifyLink.getAttribute('href')).toContain('/verify-identity')
  })
})
