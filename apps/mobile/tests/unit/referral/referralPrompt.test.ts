import { shouldShowOnboardingReferralPrompt } from '@/features/referral/referralPrompt'

const activeReferral = {
  programActive: true,
  referredBy: null,
}

describe('welcome guide referral prompt', () => {
  it('offers the card on every visit while setup is unfinished', () => {
    expect(shouldShowOnboardingReferralPrompt({ referral: activeReferral, hidden: false })).toBe(true)
  })

  it('brings the card back after an app restart before setup is finished', () => {
    // "Not now" only hides the card for the current visit.
    expect(shouldShowOnboardingReferralPrompt({ referral: activeReferral, hidden: true })).toBe(false)
    expect(shouldShowOnboardingReferralPrompt({ referral: activeReferral, hidden: false })).toBe(true)
  })

  it('never offers the card to an account that already finished the guide', () => {
    expect(shouldShowOnboardingReferralPrompt({
      referral: activeReferral,
      onboardingCompletedAt: 1,
      hidden: false,
    })).toBe(false)
  })

  it('is never offered to a referred member or while the program is paused', () => {
    expect(shouldShowOnboardingReferralPrompt({
      referral: { ...activeReferral, referredBy: { code: 'ABCD1234' } },
      hidden: false,
    })).toBe(false)
    expect(shouldShowOnboardingReferralPrompt({
      referral: { ...activeReferral, programActive: false },
      hidden: false,
    })).toBe(false)
    expect(shouldShowOnboardingReferralPrompt({ referral: null, hidden: false })).toBe(false)
  })
})
