import { describe, expect, it } from 'vitest'
import {
  calculateReferralRewardCentavos,
  normalizeReferralCode,
  referralCodeValidationError,
  referralRewardBpsFor,
  referralRewardLabel,
  referralShareUrl,
} from '@lets-be-friends/shared'

describe('referral rules', () => {
  it('pays 5% of the reward basis in whole centavos', () => {
    expect(calculateReferralRewardCentavos(10_500)).toBe(525)
    expect(calculateReferralRewardCentavos(70_000)).toBe(3_500)
    expect(calculateReferralRewardCentavos(0)).toBe(0)
  })

  it('supports a per-referral reward rate', () => {
    expect(calculateReferralRewardCentavos(10_500, 6_800)).toBe(7_140)
    expect(calculateReferralRewardCentavos(7_500, 500)).toBe(375)
  })

  it('keeps the legacy first-three rate, then moves to lifetime 5%', () => {
    expect(referralRewardBpsFor({ rewardedBookings: 0 })).toBe(6_800)
    expect(referralRewardBpsFor({ rewardedBookings: 2 })).toBe(6_800)
    expect(referralRewardBpsFor({ rewardedBookings: 3 })).toBe(500)
    expect(referralRewardBpsFor({ rewardedBookings: 4 })).toBe(500)
    expect(referralRewardBpsFor({ rewardedBookings: 1, termsVersion: 'lifetime_5_v1' })).toBe(500)
    expect(referralRewardBpsFor({ rewardedBookings: 1, termsVersion: 'legacy_68_3' })).toBe(6_800)
    expect(referralRewardBpsFor({ rewardedBookings: 1, rewardBps: 500 })).toBe(500)
  })

  it('rejects unsafe fee amounts', () => {
    expect(() => calculateReferralRewardCentavos(-1)).toThrow('nonnegative')
    expect(() => calculateReferralRewardCentavos(10.5)).toThrow('whole number')
    expect(() => calculateReferralRewardCentavos(Number.MAX_SAFE_INTEGER)).toThrow('outside supported bounds')
    expect(() => calculateReferralRewardCentavos(10_000, 10_001)).toThrow('invalid')
  })

  it('labels legacy and current rewards without calling a legacy reward 5%', () => {
    expect(referralRewardLabel('lifetime', 500)).toBe('5% lifetime credit')
    expect(referralRewardLabel('lifetime', 6_800)).toBe('Legacy rate: 68% of the platform fee, first 3 bookings')
    expect(referralRewardLabel('launch_bonus', 500)).toBe('Launch bonus')
    expect(referralRewardLabel('lifetime', 6_800, 'short')).toBe('Legacy 68% of fee')
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
