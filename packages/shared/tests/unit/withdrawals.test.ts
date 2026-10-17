import { describe, expect, it } from 'vitest'
import {
  MAX_COMPANION_WITHDRAWAL_CENTAVOS,
  MIN_COMPANION_WITHDRAWAL_CENTAVOS,
  PAYMONGO_TRANSFER_FEE_CENTAVOS,
  validateCompanionWithdrawalCentavos,
} from '../../src'

describe('Companion withdrawal policy', () => {
  it('uses the InstaPay range and the documented provider fee without a payout-method hold', () => {
    expect(MIN_COMPANION_WITHDRAWAL_CENTAVOS).toBe(1_000)
    expect(MAX_COMPANION_WITHDRAWAL_CENTAVOS).toBe(5_000_000)
    expect(PAYMONGO_TRANSFER_FEE_CENTAVOS).toBe(1_000)
  })

  it('accepts the PHP 10 minimum and rejects one centavo below it', () => {
    expect(validateCompanionWithdrawalCentavos(1_000)).toBe(1_000)
    expect(() => validateCompanionWithdrawalCentavos(999)).toThrow('between ₱10 and ₱50,000')
  })

  it('accepts exact bounds and rejects malformed or out-of-range amounts', () => {
    expect(validateCompanionWithdrawalCentavos(5_000_000)).toBe(5_000_000)
    expect(() => validateCompanionWithdrawalCentavos(5_000_001)).toThrow('between ₱10 and ₱50,000')
    expect(() => validateCompanionWithdrawalCentavos(1_000.5)).toThrow('whole number of centavos')
  })
})
