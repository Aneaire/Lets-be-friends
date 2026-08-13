import { parseWalletAmount, topUpPresentation, walletBalanceRows } from '@/data/wallet'

describe('booking wallet presentation', () => {
  it('parses server-supported PHP top-up amounts exactly to centavos', () => {
    expect(parseWalletAmount('100')).toEqual({ ok: true, amountCentavos: 10_000 })
    expect(parseWalletAmount('1,250.50')).toEqual({ ok: true, amountCentavos: 125_050 })
    expect(parseWalletAmount('99.99')).toMatchObject({ ok: false })
    expect(parseWalletAmount('100000.01')).toMatchObject({ ok: false })
    expect(parseWalletAmount('1.234')).toMatchObject({ ok: false })
    expect(parseWalletAmount('10,0.00')).toMatchObject({ ok: false })
    expect(parseWalletAmount('1,,000')).toMatchObject({ ok: false })
    expect(parseWalletAmount('12,34.56')).toMatchObject({ ok: false })
  })

  it('labels wallet buckets without treating pending money as available', () => {
    expect(walletBalanceRows({ availableCentavos: 100_00, reservedCentavos: 50_00, pendingCentavos: 25_00 }).map((row) => row.label)).toEqual([
      'Available to book',
      'Reserved for accepted bookings',
      'Pending provider confirmation',
    ])
  })

  it('does not claim credit while a top-up is awaiting or processing', () => {
    expect(topUpPresentation('awaiting_payment', Date.now() + 60_000)).toMatchObject({ active: true, payable: true, label: 'Awaiting payment' })
    expect(topUpPresentation('processing')).toMatchObject({ active: true, payable: false, label: 'Confirming payment' })
    expect(topUpPresentation('processing', 100, 101)).toMatchObject({ active: true, payable: false, label: 'Confirming payment' })
    expect(topUpPresentation('paid')).toMatchObject({ active: false, label: 'Paid' })
    expect(topUpPresentation('awaiting_payment', 100, 101)).toMatchObject({ active: false, payable: false, label: 'Expired' })
  })
})
