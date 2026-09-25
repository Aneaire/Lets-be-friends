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
import { MemberWalletPanel, type MemberFinance } from '../../src/features/wallet/MemberWalletPanel'

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
  topUps: [],
}

describe('dedicated wallet page panels', () => {
  it('shows the unified wallet balance with the PayMongo QR Ph top-up option', () => {
    render(
      <MemberWalletPanel finance={memberFinance} onCreateTopUp={async () => {}} />,
    )

    expect(screen.getByRole('heading', { name: 'Wallet balance' })).toBeTruthy()
    expect(screen.getByText('Add money with PayMongo QR Ph')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create QR Ph top-up' })).toBeTruthy()
    expect(screen.getByText('No member-wallet top-up attempt yet.')).toBeTruthy()
  })

  it('keeps the amount editable and the button active to regenerate an in-progress QR', () => {
    const activeTopUp = {
      _id: 'topup-active',
      _creationTime: Date.now(),
      beneficiaryUserId: 'member-1',
      purpose: 'member_booking_balance' as const,
      amountCentavos: 100_000,
      currency: 'PHP' as const,
      mode: 'test' as const,
      status: 'awaiting_payment' as const,
      providerIntentId: 'pi_active',
      qrImageUrl: 'https://example.test/qr.png',
      expiresAt: Date.now() + 600_000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as unknown as MemberFinance['topUps'][number]
    render(
      <MemberWalletPanel
        finance={{ ...memberFinance, topUps: [activeTopUp] }}
        onCreateTopUp={async () => {}}
      />,
    )

    const amountInput = screen.getByRole('spinbutton', { name: /Top-up amount/i }) as HTMLInputElement
    const regenerateButton = screen.getByRole('button', { name: 'Regenerate QR Ph top-up' }) as HTMLButtonElement
    expect(amountInput.disabled).toBe(false)
    expect(regenerateButton.disabled).toBe(false)
  })

  it('shows the latest paid attempt instead of an older superseded QR', () => {
    const now = Date.now()
    const paidTopUp = {
      _id: 'topup-paid',
      _creationTime: now,
      beneficiaryUserId: 'member-1',
      purpose: 'member_booking_balance' as const,
      amountCentavos: 100_00,
      currency: 'PHP' as const,
      mode: 'test' as const,
      status: 'paid' as const,
      providerIntentId: 'pi_paid',
      qrImageUrl: 'https://example.test/paid.png',
      expiresAt: now - 1_000,
      paidAt: now,
      createdAt: now,
      updatedAt: now,
    } as unknown as MemberFinance['topUps'][number]
    const supersededTopUp = {
      _id: 'topup-superseded',
      _creationTime: now - 60_000,
      beneficiaryUserId: 'member-1',
      purpose: 'member_booking_balance' as const,
      amountCentavos: 1_000_00,
      currency: 'PHP' as const,
      mode: 'test' as const,
      status: 'expired' as const,
      providerIntentId: 'pi_superseded',
      qrImageUrl: 'https://example.test/superseded.png',
      expiresAt: now - 30_000,
      expiredAt: now - 30_000,
      failureCode: 'superseded',
      createdAt: now - 60_000,
      updatedAt: now - 30_000,
    } as unknown as MemberFinance['topUps'][number]
    render(
      <MemberWalletPanel
        finance={{ ...memberFinance, topUps: [paidTopUp, supersededTopUp] }}
        onCreateTopUp={async () => {}}
      />,
    )

    expect(screen.getByText('₱100.00')).toBeTruthy()
    expect(screen.getByText('paid')).toBeTruthy()
    expect(screen.queryByText('This QR expired. You can create a fresh top-up.')).toBeNull()
  })

  it('shows a loading state while the booking wallet connects', () => {
    render(
      <MemberWalletPanel finance={undefined} onCreateTopUp={async () => {}} />,
    )

    expect(screen.getByText('Loading booking wallet…')).toBeTruthy()
  })

  it('shows the wallet withdrawal section while provider settings load', () => {
    render(<CompanionWithdrawalPanel />)

    expect(screen.getByRole('heading', { name: 'Withdraw funds' })).toBeTruthy()
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

  it('replaces PayMongo institution errors with payout setup guidance', async () => {
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
      new Error('[CONVEX A(withdrawals:listReceivingInstitutions)] Server Error Uncaught PaymongoRequestError: failed to get transfers resource: resource not found at paymongoRequest (../../convex/paymongo.ts:807:27) Called by client'),
    )
    render(<CompanionWithdrawalPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Set up payout method' }))

    expect(await screen.findByText('Supported institutions could not be loaded.')).toBeTruthy()
    expect(screen.queryByText(/CONVEX/)).toBeNull()
    expect(screen.queryByText(/resource not found/i)).toBeNull()
  })

  it('uses one account number field when setting up a payout method', async () => {
    mocks.queryResult = {
      enabled: true,
      payoutMethod: null,
      activeWithdrawalId: null,
      withdrawals: [],
      minimumCentavos: 10_000,
      maximumCentavos: 5_000_000,
      availableEarningsCentavos: 50_000,
    }
    mocks.listAction.mockResolvedValueOnce({
      accountName: 'Maria Santos',
      institutions: [{ bic: 'GOTYPHM2XXX', name: 'GoTyme Bank Corporation' }],
    })
    render(<CompanionWithdrawalPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Set up payout method' }))

    expect(await screen.findByRole('textbox', { name: 'Account number' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Confirm account number' })).toBeNull()
  })

  it('treats a future-dated payout method as ready without hold wording', () => {
    mocks.queryResult = {
      enabled: true,
      payoutMethod: {
        id: 'method-1',
        provider: 'instapay',
        institutionBic: 'BNORPHMM',
        institutionName: 'BDO Unibank',
        accountName: 'Maria Santos',
        accountNumberLast4: '4321',
        availableAt: Date.now() + 86_400_000,
        ready: false,
        modeMismatch: false,
      },
      activeWithdrawalId: null,
      withdrawals: [],
      minimumCentavos: 10_000,
      maximumCentavos: 5_000_000,
      availableEarningsCentavos: 50_000,
    }
    render(<CompanionWithdrawalPanel />)

    expect(screen.getByText('Payout method ready')).toBeTruthy()
    expect(screen.queryByText(/Security hold/i)).toBeNull()
    expect(screen.queryByText(/24-hour/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Review withdrawal' })).toBeTruthy()
  })
})
