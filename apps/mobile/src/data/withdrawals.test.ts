import { parseWithdrawalAmount, withdrawalStatusPresentation } from './withdrawals'

describe('mobile withdrawal presentation', () => {
  it('parses valid PHP amounts and enforces available earnings', () => {
    expect(parseWithdrawalAmount('500.25', 100_000)).toEqual({ ok: true, amountCentavos: 50_025 })
    expect(parseWithdrawalAmount('50', 100_000)).toMatchObject({ ok: false })
    expect(parseWithdrawalAmount('1,500', 100_000)).toEqual({ ok: false, message: 'Available earnings are lower than this withdrawal amount.' })
  })

  it('explains pending, successful, failed, and uncertain provider states', () => {
    expect(withdrawalStatusPresentation('pending').label).toBe('In transfer')
    expect(withdrawalStatusPresentation('succeeded').label).toBe('Received')
    expect(withdrawalStatusPresentation('failed').detail).toContain('returned to available earnings')
    expect(withdrawalStatusPresentation('needs_review').detail).toContain('stay reserved')
  })
})
