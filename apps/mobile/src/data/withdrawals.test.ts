import { parseWithdrawalAmount, withdrawalStatusPresentation } from './withdrawals'

describe('mobile withdrawal presentation', () => {
  it('accepts the PHP 100 minimum and charges the transfer fee on top', () => {
    expect(parseWithdrawalAmount('100', 11_000)).toEqual({ ok: true, amountCentavos: 10_000, feeCentavos: 1_000, totalDebitCentavos: 11_000 })
    expect(parseWithdrawalAmount('500.25', 100_000)).toMatchObject({ ok: true, amountCentavos: 50_025, totalDebitCentavos: 51_025 })
  })

  it('rejects PHP 99.99 below the minimum and balances that do not also cover the fee', () => {
    expect(parseWithdrawalAmount('99.99', 50_000)).toMatchObject({ ok: false })
    expect(parseWithdrawalAmount('100', 10_999)).toEqual({ ok: false, message: 'Available wallet balance does not cover this amount plus the transfer fee.' })
    expect(parseWithdrawalAmount('1,500', 100_000)).toEqual({ ok: false, message: 'Available wallet balance does not cover this amount plus the transfer fee.' })
  })

  it('explains pending, successful, failed, and uncertain provider states', () => {
    expect(withdrawalStatusPresentation('pending').label).toBe('In transfer')
    expect(withdrawalStatusPresentation('succeeded').label).toBe('Received')
    expect(withdrawalStatusPresentation('failed').detail).toContain('returned to your available wallet balance')
    expect(withdrawalStatusPresentation('needs_review').detail).toContain('stay reserved')
  })
})
