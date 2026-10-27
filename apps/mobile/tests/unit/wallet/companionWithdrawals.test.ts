import { parseWithdrawalAmount, withdrawalStatusPresentation } from '@/data/withdrawals'

describe('companion withdrawal readiness without payout-method hold', () => {
  it('accepts a valid amount immediately without a hold check', () => {
    expect(parseWithdrawalAmount('10', 1_000)).toEqual({ ok: true, amountCentavos: 1_000 })
    expect(parseWithdrawalAmount('50', 5_000)).toEqual({ ok: true, amountCentavos: 5_000 })
    expect(parseWithdrawalAmount('1000', 200_000)).toEqual({ ok: true, amountCentavos: 100_000 })
  })

  it('rejects 9.99, an above-balance amount, and amounts outside the InstaPay range without hold wording', () => {
    expect(parseWithdrawalAmount('9.99', 50_000)).toMatchObject({ ok: false })
    expect(parseWithdrawalAmount('10.01', 1_000)).toEqual({
      ok: false,
      message: 'Available wallet balance is lower than this withdrawal amount.',
    })
    const message = parseWithdrawalAmount('60000', 10_000_000)
    expect(message).toMatchObject({ ok: false })
    if (!message.ok) {
      expect(message.message).not.toMatch(/hold/i)
    }
  })

  it('presents withdrawal statuses without security-hold language', () => {
    const labels = (['queued', 'submitting', 'pending', 'succeeded', 'failed', 'needs_review'] as const).map(
      (status) => withdrawalStatusPresentation(status).label,
    )
    expect(labels).toEqual(['Queued', 'Submitting', 'In transfer', 'Received', 'Returned', 'Needs review'])
    for (const label of labels) {
      expect(label).not.toMatch(/hold/i)
    }
  })
})

it('uses yellow for pending transfers, green for received funds, and danger for failures', () => {
  for (const status of ['queued', 'submitting', 'pending'] as const) {
    expect(withdrawalStatusPresentation(status).tone).toBe('warning')
  }
  expect(withdrawalStatusPresentation('succeeded').tone).toBe('success')
  expect(withdrawalStatusPresentation('failed').tone).toBe('danger')
  expect(withdrawalStatusPresentation('needs_review').tone).toBe('danger')
})
