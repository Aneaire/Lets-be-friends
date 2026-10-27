import { parseWalletAmount, qrImageFileName, saveQrImageMessage, topUpPresentation, walletBalanceRows, walletTopUpCreationState } from '@/data/wallet'

describe('wallet presentation', () => {
  it('parses server-supported PHP top-up amounts exactly to centavos', () => {
    expect(parseWalletAmount('100')).toEqual({ ok: true, amountCentavos: 10_000 })
    expect(parseWalletAmount('1,250.50')).toEqual({ ok: true, amountCentavos: 125_050 })
    expect(parseWalletAmount('1')).toEqual({ ok: true, amountCentavos: 100 })
    expect(parseWalletAmount('99.99')).toEqual({ ok: true, amountCentavos: 9_999 })
    expect(parseWalletAmount('0.99')).toMatchObject({ ok: false })
    expect(parseWalletAmount('100000.01')).toMatchObject({ ok: false })
    expect(parseWalletAmount('1.234')).toMatchObject({ ok: false })
    expect(parseWalletAmount('10,0.00')).toMatchObject({ ok: false })
    expect(parseWalletAmount('1,,000')).toMatchObject({ ok: false })
    expect(parseWalletAmount('12,34.56')).toMatchObject({ ok: false })
  })

  it('labels wallet buckets without treating pending money as available', () => {
    expect(walletBalanceRows({ availableCentavos: 100_00, reservedCentavos: 50_00, pendingCentavos: 25_00 }).map((row) => row.label)).toEqual([
      'Available balance',
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

  it('names a saved QR image after its top-up without unsafe path characters', () => {
    expect(qrImageFileName('topup_123')).toBe('lets-be-friends-qr-ph-topup_123.png')
    expect(qrImageFileName('../../top up')).toBe('lets-be-friends-qr-ph-------top-up.png')
    expect(qrImageFileName('')).toBe('lets-be-friends-qr-ph-top-up.png')
  })

  it('reports a saved QR without treating a denied permission as saved', () => {
    expect(saveQrImageMessage({ ok: true })).toBe('QR Ph code saved to your photos.')
    expect(saveQrImageMessage({ ok: false, reason: 'permission' })).toMatch(/Allow photo access/)
    expect(saveQrImageMessage({ ok: false, reason: 'unsupported' })).toMatch(/could not be saved/)
  })
})

describe('QR amount correction', () => {
  const base = { amount: '50', activeTopUp: { status: 'awaiting_payment' as const, amountCentavos: 5_000 }, busy: false, waiting: false, enabled: true }
  it('allows editing an active QR amount and generates a replacement for the corrected amount', () => {
    expect(walletTopUpCreationState(base)).toMatchObject({ editable: true, disabled: true })
    expect(walletTopUpCreationState({ ...base, amount: '500' })).toMatchObject({ editable: true, disabled: false, label: 'Create QR for updated amount' })
    expect(walletTopUpCreationState({ ...base, amount: '50.00' })).toMatchObject({ disabled: true })
  })
  it('locks duplicate creation while a request or payment is processing', () => {
    expect(walletTopUpCreationState({ ...base, amount: '500', busy: true })).toMatchObject({ editable: false, disabled: true })
    expect(walletTopUpCreationState({ ...base, waiting: true })).toMatchObject({ disabled: true })
    expect(walletTopUpCreationState({ ...base, activeTopUp: { status: 'processing', amountCentavos: 5_000 } })).toMatchObject({ editable: false, disabled: true })
    expect(walletTopUpCreationState({ ...base, enabled: false })).toMatchObject({ disabled: true })
  })
  it('allows the same amount again after expiry and hides the expired QR at its exact deadline', () => {
    expect(topUpPresentation('awaiting_payment', 100, 100)).toMatchObject({ active: false, payable: false })
    expect(walletTopUpCreationState({ ...base, activeTopUp: undefined })).toMatchObject({ editable: true, disabled: false })
  })
})
