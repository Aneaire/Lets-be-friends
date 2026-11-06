import { parseWithdrawalAmount, withdrawalStatusPresentation } from '@/data/withdrawals'

describe('companion withdrawal readiness without payout-method hold', () => {
  it('accepts a valid amount that also covers the transfer fee', () => {
    expect(parseWithdrawalAmount('100', 11_000)).toMatchObject({ ok: true, amountCentavos: 10_000 })
    expect(parseWithdrawalAmount('500', 51_000)).toMatchObject({ ok: true, amountCentavos: 50_000 })
    expect(parseWithdrawalAmount('1000', 101_000)).toMatchObject({ ok: true, amountCentavos: 100_000 })
  })

  it('rejects 99.99, a balance short of the fee, and amounts outside the InstaPay range without hold wording', () => {
    expect(parseWithdrawalAmount('99.99', 50_000)).toMatchObject({ ok: false })
    expect(parseWithdrawalAmount('100', 10_999)).toEqual({
      ok: false,
      message: 'Available wallet balance does not cover this amount plus the transfer fee.',
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
