import { describe, expect, it, vi } from 'vitest'
import {
  buildWithdrawalReferenceNumber,
  decryptPayoutAccountNumber,
  encryptPayoutAccountNumber,
  isDefinitiveWithdrawalSubmissionError,
  listPaymongoReceivingInstitutions,
  normalizeBatchTransfer,
  normalizePaymongoReferenceNumber,
  normalizeReceivingInstitutions,
  normalizeTransfer,
  normalizeWalletSourceAccount,
  parsePaymongoTransferWebhookEvent,
  paymongoTransferCallbackUrl,
  resolvePaymongoWalletSourceAccount,
} from '../../convex/withdrawals'
import { PaymongoRequestError } from '../../convex/paymongo'

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
    })).toMatchObject({ number: '0000000001', name: 'Lets Be Friends', bic: 'PAEYPHM2XXX' })
  })

  it('supports the Wallet receiving-institution shape and falls back when Transfers V2 is unavailable', async () => {
    expect(normalizeReceivingInstitutions({
      data: [
        { id: 'institution-1', attributes: { name: 'BDO Unibank', provider_code: 'BNORPHMM' } },
      ],
    })).toEqual([{ name: 'BDO Unibank', bic: 'BNORPHMM' }])

    const config = {
      secretKey: 'sk_test_example',
      publicKey: 'pk_test_example',
      webhookSecret: undefined,
      mode: 'test' as const,
      apiBaseUrl: 'https://api.paymongo.com',
    }
    const request = vi.fn()
      .mockRejectedValueOnce(new PaymongoRequestError('failed to get transfers resource: resource not found', 404))
      .mockResolvedValueOnce({ data: [] })

    await expect(listPaymongoReceivingInstitutions(config, request)).resolves.toEqual({ data: [] })
    expect(request).toHaveBeenNthCalledWith(1, '/v2/transfers/receiving_institutions?provider=instapay', { method: 'GET', config })
    expect(request).toHaveBeenNthCalledWith(2, '/v1/wallets/receiving_institutions?provider=instapay', { method: 'GET', config })
  })

  it('builds withdrawal references PayMongo returns unchanged', () => {
    const reference = buildWithdrawalReferenceNumber('j97abc123Xyz')
    expect(reference).toMatch(/^[A-Za-z0-9 ]+$/)
    expect(reference).not.toContain('-')
    expect(normalizePaymongoReferenceNumber(reference)).toBe(reference.toLowerCase())
    expect(normalizePaymongoReferenceNumber('lbf-j97abc123Xyz')).toBe(normalizePaymongoReferenceNumber(reference))
  })

  it('reads Wallet retrieve shapes and available balance for pre-submission checks', () => {
    expect(normalizeWalletSourceAccount({
      data: {
        id: 'wallet-1',
        status: 'activated',
        balance: { available: 200_000, pending: 10_000 },
        account: { account_number: '0000000001', account_name: 'Lets Be Friends' },
      },
    })).toMatchObject({ number: '0000000001', name: 'Lets Be Friends', bic: 'PAEYPHM2XXX', availableCentavos: 200_000 })
    expect(normalizeWalletSourceAccount({
      data: [{ id: 'wallet-1', status: 'activated', source_account: { number: '0000000001', name: 'Lets Be Friends', bic: 'PAEYPHM2XXX' } }],
    })).toMatchObject({ number: '0000000001', bic: 'PAEYPHM2XXX' })
  })

  it('retrieves an activated Wallet detail when the list omits its source account', async () => {
    const config = {
      secretKey: 'sk_live_example',
      publicKey: 'pk_live_example',
      webhookSecret: undefined,
      mode: 'live' as const,
      apiBaseUrl: 'https://api.paymongo.com',
    }
    const request = vi.fn()
      .mockResolvedValueOnce({
        data: [{ id: 'wallet-live', status: 'activated', type: 'default', is_default: true, livemode: true }],
      })
      .mockResolvedValueOnce({
        data: {
          id: 'wallet-live',
          status: 'activated',
          balance: { available: 200_000 },
          account: { account_number: '0000000001', account_name: 'Lets Be Friends' },
        },
      })

    await expect(resolvePaymongoWalletSourceAccount(config, request)).resolves.toEqual({
      number: '0000000001',
      name: 'Lets Be Friends',
      bic: 'PAEYPHM2XXX',
      availableCentavos: 200_000,
    })
    expect(request).toHaveBeenNthCalledWith(1, '/v2/wallets', { method: 'GET', config })
    expect(request).toHaveBeenNthCalledWith(2, '/v2/wallets/wallet-live?fields=account&fields=balance', { method: 'GET', config })
  })

  it('treats a missing activated Wallet source as a definite pre-transfer failure', async () => {
    const config = {
      secretKey: 'sk_live_example',
      publicKey: 'pk_live_example',
      webhookSecret: undefined,
      mode: 'live' as const,
      apiBaseUrl: 'https://api.paymongo.com',
    }
    const request = vi.fn().mockResolvedValueOnce({
      data: [{ id: 'wallet-live', status: 'deactivated', type: 'default', livemode: true }],
    })

    const error = await resolvePaymongoWalletSourceAccount(config, request).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(Error)
    expect(isDefinitiveWithdrawalSubmissionError(error)).toBe(true)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('only accepts HTTPS transfer callback URLs and leaves them unset by default', () => {
    const previous = process.env.PAYMONGO_TRANSFER_CALLBACK_URL
    try {
      delete process.env.PAYMONGO_TRANSFER_CALLBACK_URL
      expect(paymongoTransferCallbackUrl()).toBeUndefined()
      process.env.PAYMONGO_TRANSFER_CALLBACK_URL = 'https://example.convex.site/paymongo/webhook'
      expect(paymongoTransferCallbackUrl()).toBe('https://example.convex.site/paymongo/webhook')
      process.env.PAYMONGO_TRANSFER_CALLBACK_URL = 'http://example.convex.site/paymongo/webhook'
      expect(() => paymongoTransferCallbackUrl()).toThrow('HTTPS')
    } finally {
      if (previous === undefined) delete process.env.PAYMONGO_TRANSFER_CALLBACK_URL
      else process.env.PAYMONGO_TRANSFER_CALLBACK_URL = previous
    }
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
