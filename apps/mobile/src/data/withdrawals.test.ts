import { parseWithdrawalAmount, withdrawalStatusPresentation } from './withdrawals'

describe('mobile withdrawal presentation', () => {
  it('accepts the PHP 10 minimum and PHP 50 at an exact balance', () => {
    expect(parseWithdrawalAmount('10', 1_000)).toEqual({ ok: true, amountCentavos: 1_000 })
    expect(parseWithdrawalAmount('50', 5_000)).toEqual({ ok: true, amountCentavos: 5_000 })
    expect(parseWithdrawalAmount('500.25', 100_000)).toEqual({ ok: true, amountCentavos: 50_025 })
  })

  it('rejects PHP 9.99 below the minimum and amounts above the available balance', () => {
    expect(parseWithdrawalAmount('9.99', 50_000)).toMatchObject({ ok: false })
    expect(parseWithdrawalAmount('10.01', 1_000)).toEqual({ ok: false, message: 'Available wallet balance is lower than this withdrawal amount.' })
    expect(parseWithdrawalAmount('1,500', 100_000)).toEqual({ ok: false, message: 'Available wallet balance is lower than this withdrawal amount.' })
  })

  it('explains pending, successful, failed, and uncertain provider states', () => {
    expect(withdrawalStatusPresentation('pending').label).toBe('In transfer')
    expect(withdrawalStatusPresentation('succeeded').label).toBe('Received')
    expect(withdrawalStatusPresentation('failed').detail).toContain('returned to your available wallet balance')
    expect(withdrawalStatusPresentation('needs_review').detail).toContain('stay reserved')
  })
})
