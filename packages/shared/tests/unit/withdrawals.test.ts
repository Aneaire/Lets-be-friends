import { describe, expect, it } from 'vitest'
import {
  COMPANION_WITHDRAWAL_FEE_CENTAVOS,
  MAX_COMPANION_WITHDRAWAL_CENTAVOS,
  MIN_COMPANION_WITHDRAWAL_CENTAVOS,
  PAYMONGO_TRANSFER_FEE_CENTAVOS,
  companionWithdrawalTotalDebitCentavos,
  maximumCompanionWithdrawalCentavos,
  validateCompanionWithdrawalCentavos,
  withdrawalFailureReason,
} from '../../src'

describe('Companion withdrawal policy', () => {
  it('uses the InstaPay range and the documented provider fee without a payout-method hold', () => {
    expect(MIN_COMPANION_WITHDRAWAL_CENTAVOS).toBe(10_000)
    expect(MAX_COMPANION_WITHDRAWAL_CENTAVOS).toBe(5_000_000)
    expect(PAYMONGO_TRANSFER_FEE_CENTAVOS).toBe(1_000)
  })

  it('charges the member the same amount PayMongo charges the platform', () => {
    expect(COMPANION_WITHDRAWAL_FEE_CENTAVOS).toBe(PAYMONGO_TRANSFER_FEE_CENTAVOS)
  })

  it('debits the withdrawal amount plus the fee so the recipient receives the full amount', () => {
    expect(companionWithdrawalTotalDebitCentavos(50_000)).toBe(51_000)
  })

  it('caps the request at the balance minus the fee', () => {
    expect(maximumCompanionWithdrawalCentavos(50_000)).toBe(49_000)
    expect(maximumCompanionWithdrawalCentavos(500)).toBe(0)
    expect(maximumCompanionWithdrawalCentavos(10_000_000)).toBe(5_000_000)
  })

  it('accepts the PHP 100 minimum and rejects one centavo below it', () => {
    expect(validateCompanionWithdrawalCentavos(10_000)).toBe(10_000)
    expect(() => validateCompanionWithdrawalCentavos(9_999)).toThrow('between ₱100 and ₱50,000')
  })

  it('accepts exact bounds and rejects malformed or out-of-range amounts', () => {
    expect(validateCompanionWithdrawalCentavos(5_000_000)).toBe(5_000_000)
    expect(() => validateCompanionWithdrawalCentavos(5_000_001)).toThrow('between ₱100 and ₱50,000')
    expect(() => validateCompanionWithdrawalCentavos(10_000.5)).toThrow('whole number of centavos')
  })

  it('explains a returned withdrawal without exposing the provider code', () => {
    expect(withdrawalFailureReason('insufficient_wallet_balance', 'failed')).toMatch(/payment service is temporarily unavailable/i)
    expect(withdrawalFailureReason('AM04', 'failed')).toMatch(/payment service is temporarily unavailable/i)
    expect(withdrawalFailureReason('AM04', 'failed')).toMatch(/returned to your wallet/i)
    expect(withdrawalFailureReason('AM04', 'failed')).not.toMatch(/platform|settling|balance/i)
    expect(withdrawalFailureReason('invalid_destination_account', 'failed')).toMatch(/rejected the transfer/i)
    expect(withdrawalFailureReason('resource_closed_state', 'failed')).toMatch(/cannot receive transfers/i)
    expect(withdrawalFailureReason('monthly_limit', 'failed')).toMatch(/did not complete/i)
    expect(withdrawalFailureReason(undefined, 'needs_review')).toMatch(/has not confirmed/i)
    expect(withdrawalFailureReason('unknown_provider_code', 'failed')).not.toContain('unknown_provider_code')
  })
})
