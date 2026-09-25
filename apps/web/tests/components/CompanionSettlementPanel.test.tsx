// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CompanionSettlementPanel } from '../../src/features/booking/CompanionSettlementPanel'

const ELIGIBLE_AT = Date.UTC(2026, 7, 12, 5, 39, 0)

afterEach(() => {
  cleanup()
})

describe('CompanionSettlementPanel', () => {
  it('shows the Companion amount, pending status, exact release time, and member total', () => {
    const { container } = render(
      <CompanionSettlementPanel
        settlementState="pending"
        settlementEligibleAt={ELIGIBLE_AT}
        companionEarningsCentavos={57_500}
        memberTotalCentavos={66_125}
      />,
    )

    expect(screen.getByText('₱575.00')).toBeTruthy()
    expect(screen.getByText('Pending 24-hour review')).toBeTruthy()
    expect(screen.getByText(/Aug 12, 2026, 1:39 PM/)).toBeTruthy()
    expect(screen.getByText(/The member paid ₱661.25 total/)).toBeTruthy()
    expect(container.querySelector('[data-settlement="pending"]')).toBeTruthy()
    expect(container.querySelector('.notice-warning')).toBeTruthy()
  })

  it('marks settled funds as available with the success tone', () => {
    const { container } = render(
      <CompanionSettlementPanel settlementState="settled" companionEarningsCentavos={50_000} />,
    )

    expect(screen.getByText('Available in your wallet')).toBeTruthy()
    expect(screen.getByText(/available in your Companion wallet/)).toBeTruthy()
    expect(container.querySelector('[data-settlement="settled"]')).toBeTruthy()
    expect(container.querySelector('.notice-success')).toBeTruthy()
  })

  it('shows blocked funds as an active-report hold', () => {
    const { container } = render(
      <CompanionSettlementPanel settlementState="blocked" companionEarningsCentavos={50_000} />,
    )

    expect(screen.getByText('On hold for review')).toBeTruthy()
    expect(screen.getByText(/active report has placed these funds on hold/)).toBeTruthy()
    expect(container.querySelector('[data-settlement="blocked"]')).toBeTruthy()
    expect(container.querySelector('.notice-warning')).toBeTruthy()
    expect(container.querySelector('.notice-danger')).toBeNull()
  })

  it('explains that reserved funds wait for both completion confirmations', () => {
    render(<CompanionSettlementPanel settlementState="reserved" companionEarningsCentavos={50_000} />)

    expect(screen.getByText('Reserved until completion')).toBeTruthy()
    expect(screen.getByText(/reserved until both you and the member confirm/)).toBeTruthy()
  })

  it('shows refunded funds as returned to the member without a danger tone', () => {
    const { container } = render(
      <CompanionSettlementPanel settlementState="refunded" companionEarningsCentavos={50_000} />,
    )

    expect(screen.getByText('Returned to member')).toBeTruthy()
    expect(screen.getByText(/returned to the member booking wallet/)).toBeTruthy()
    expect(container.querySelector('[data-settlement="refunded"]')).toBeTruthy()
    expect(container.querySelector('.notice-danger')).toBeNull()
  })

  it('uses readable status text without a live announcement region', () => {
    const { container } = render(
      <CompanionSettlementPanel settlementState="settled" companionEarningsCentavos={50_000} />,
    )

    expect(screen.getByText('Payment status:')).toBeTruthy()
    expect(container.querySelector('[aria-live]')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
