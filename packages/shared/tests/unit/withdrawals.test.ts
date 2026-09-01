import { describe, expect, it } from 'vitest'
import {
  COMPANION_PAYOUT_METHOD_HOLD_MS,
  MAX_COMPANION_WITHDRAWAL_CENTAVOS,
  MIN_COMPANION_WITHDRAWAL_CENTAVOS,
  PAYMONGO_TRANSFER_FEE_CENTAVOS,
  validateCompanionWithdrawalCentavos,
} from '../../src'

describe('Companion withdrawal policy', () => {
  it('uses the InstaPay range, a 24-hour payout-method hold, and the documented provider fee', () => {
    expect(MIN_COMPANION_WITHDRAWAL_CENTAVOS).toBe(10_000)
    expect(MAX_COMPANION_WITHDRAWAL_CENTAVOS).toBe(5_000_000)
    expect(COMPANION_PAYOUT_METHOD_HOLD_MS).toBe(86_400_000)
    expect(PAYMONGO_TRANSFER_FEE_CENTAVOS).toBe(1_000)
  })

  it('accepts exact bounds and rejects malformed or out-of-range amounts', () => {
    expect(validateCompanionWithdrawalCentavos(10_000)).toBe(10_000)
    expect(validateCompanionWithdrawalCentavos(5_000_000)).toBe(5_000_000)
    expect(() => validateCompanionWithdrawalCentavos(9_999)).toThrow('between ₱100 and ₱50,000')
    expect(() => validateCompanionWithdrawalCentavos(5_000_001)).toThrow('between ₱100 and ₱50,000')
    expect(() => validateCompanionWithdrawalCentavos(10_000.5)).toThrow('whole number of centavos')
  })
})
