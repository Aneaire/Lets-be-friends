import { referralCodeCardValue } from '@/features/referral/ReferralCodeCard'

describe('mobile referral code card prefill', () => {
  it('normalizes a saved invitation without submitting it', () => {
    expect(referralCodeCardValue('ab-cd12')).toBe('ABCD12')
    expect(referralCodeCardValue(' f9u29d5u ')).toBe('F9U29D5U')
  })

  it('leaves the field empty without a saved invitation', () => {
    expect(referralCodeCardValue()).toBe('')
    expect(referralCodeCardValue('')).toBe('')
  })
})
