import { describe, expect, it } from 'vitest'
import {
  decryptPayoutAccountNumber,
  encryptPayoutAccountNumber,
  normalizeBatchTransfer,
  normalizeReceivingInstitutions,
  normalizeTransfer,
  normalizeWalletSourceAccount,
  parsePaymongoTransferWebhookEvent,
} from '../../convex/withdrawals'

describe('PayMongo withdrawal contracts', () => {
  it('encrypts payout account numbers with context-bound authenticated encryption', async () => {
    const previousKey = process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY
    process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
    try {
      const encrypted = await encryptPayoutAccountNumber('09171234567', 'payout:user-1:BNORPHMM:mariasantos')
      expect(encrypted.ciphertext).not.toContain('09171234567')
      await expect(decryptPayoutAccountNumber(
        encrypted.ciphertext,
        encrypted.iv,
        'payout:user-1:BNORPHMM:mariasantos',
      )).resolves.toBe('09171234567')
      await expect(decryptPayoutAccountNumber(
        encrypted.ciphertext,
        encrypted.iv,
        'payout:user-2:BNORPHMM:mariasantos',
      )).rejects.toThrow()
    } finally {
      if (previousKey === undefined) delete process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY
      else process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY = previousKey
    }
  })

  it('normalizes the documented receiving institution and Wallet source shapes', () => {
    expect(normalizeReceivingInstitutions({
      data: [
        { id: 'institution-2', attributes: { name: 'GCash', bic: 'GXCHPHM2XXX' } },
        { id: 'institution-1', attributes: { name: 'BDO Unibank', bic: 'BNORPHMM' } },
      ],
    })).toEqual([
      { name: 'BDO Unibank', bic: 'BNORPHMM' },
      { name: 'GCash', bic: 'GXCHPHM2XXX' },
    ])
    expect(normalizeWalletSourceAccount({
      data: [{ id: 'wallet-1', status: 'activated', source_account: { number: '0000000001', name: 'Lets Be Friends', bic: 'PAEYPHM2XXX' } }],
    })).toEqual({ number: '0000000001', name: 'Lets Be Friends', bic: 'PAEYPHM2XXX' })
  })

  it('normalizes batch creation and canonical retrieval without trusting destination data', () => {
    const transfer = normalizeBatchTransfer({
      data: {
        id: 'btr_123',
        transfers: [{
          id: 'tr_123',
          status: 'pending',
          amount: 50_000,
          fee: 1_000,
          currency: 'PHP',
          reference_number: 'lbf-withdrawal-1',
          provider_reference_number: null,
        }],
      },
    })
    expect(transfer).toEqual({
      id: 'tr_123',
      batchId: 'btr_123',
      status: 'pending',
      amountCentavos: 50_000,
      feeCentavos: 1_000,
      currency: 'PHP',
      referenceNumber: 'lbf-withdrawal-1',
      providerReferenceNumber: undefined,
      failureCode: undefined,
    })
    expect(normalizeTransfer({ data: { id: 'tr_123', attributes: {
      status: 'succeeded', amount: 50_000, fee: 1_000, currency: 'php', reference_number: 'lbf-withdrawal-1', provider_reference_number: 'bank-ref-1',
    } } })).toMatchObject({ status: 'succeeded', currency: 'PHP', providerReferenceNumber: 'bank-ref-1' })
  })

  it('accepts only supported outward transfer events and extracts the canonical transfer ID', () => {
    expect(parsePaymongoTransferWebhookEvent({ data: { id: 'evt_123', attributes: {
      type: 'transfer.outward.successful',
      livemode: false,
      data: { id: 'tr_123', type: 'transfer' },
    } } })).toEqual({ eventId: 'evt_123', eventType: 'transfer.outward.successful', mode: 'test', providerTransferId: 'tr_123' })
    expect(() => parsePaymongoTransferWebhookEvent({ data: { id: 'evt_bad', attributes: {
      type: 'payment.paid', livemode: false, data: { id: 'pay_123' },
    } } })).toThrow('Unsupported PayMongo transfer event type')
  })
})
