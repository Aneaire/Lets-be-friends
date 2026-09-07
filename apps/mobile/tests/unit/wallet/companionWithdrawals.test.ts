import { parseWithdrawalAmount, withdrawalStatusPresentation } from '@/data/withdrawals'

describe('companion withdrawal readiness without payout-method hold', () => {
  it('accepts a valid amount immediately without a hold check', () => {
    expect(parseWithdrawalAmount('1000', 200_000)).toEqual({ ok: true, amountCentavos: 100_000 })
  })

  it('rejects amounts outside the InstaPay range without hold wording', () => {
    expect(parseWithdrawalAmount('99.99', 50_000)).toMatchObject({ ok: false })
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
