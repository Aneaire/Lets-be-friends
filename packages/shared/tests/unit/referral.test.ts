import { describe, expect, it } from 'vitest'
import {
  calculateReferralRewardCentavos,
  normalizeReferralCode,
  referralCodeValidationError,
  referralShareUrl,
} from '@lets-be-friends/shared'

describe('referral rules', () => {
  it('pays 68% of the platform service fee in whole centavos', () => {
    expect(calculateReferralRewardCentavos(10_500)).toBe(7_140)
    expect(calculateReferralRewardCentavos(7_500)).toBe(5_100)
    expect(calculateReferralRewardCentavos(0)).toBe(0)
  })

  it('rejects unsafe fee amounts', () => {
    expect(() => calculateReferralRewardCentavos(-1)).toThrow('nonnegative')
    expect(() => calculateReferralRewardCentavos(10.5)).toThrow('whole number')
    expect(() => calculateReferralRewardCentavos(Number.MAX_SAFE_INTEGER)).toThrow('outside supported bounds')
  })

  it('normalizes a shared code and validates its length', () => {
    expect(normalizeReferralCode(' ab-cd 12 ')).toBe('ABCD12')
    expect(referralCodeValidationError('AB12')).toContain('at least 6')
    expect(referralCodeValidationError('ABCDEFGHIJKLM')).toContain('at most 12')
    expect(referralCodeValidationError('ABCD12')).toBeNull()
  })

  it('builds a share link with the normalized code', () => {
    expect(referralShareUrl('https://letsbefriends.ph/', 'ab-cd12')).toBe('https://letsbefriends.ph/?ref=ABCD12')
  })
})
