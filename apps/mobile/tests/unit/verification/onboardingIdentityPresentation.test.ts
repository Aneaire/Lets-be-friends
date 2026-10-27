import { onboardingIdentityPresentation } from '@/features/verification/onboardingIdentityPresentation'

const baseInput: Parameters<typeof onboardingIdentityPresentation>[0] = {
  verificationStatus: 'not_started',
  verification: null,
  identityEligible: false,
}

function callInput(overrides: Partial<Parameters<typeof onboardingIdentityPresentation>[0]> = {}): Parameters<typeof onboardingIdentityPresentation>[0] {
  return { ...baseInput, ...overrides }
}

describe('onboarding identity finish presentation', () => {
  it('finishes straight into the app when the identity is approved', () => {
    const presentation = onboardingIdentityPresentation(callInput({
      verificationStatus: 'approved',
      identityEligible: true,
      verification: { adminStatus: 'approved', identityStage: 'approved' },
    }))
    expect(presentation.action).toBe('none')
    expect(presentation.approved).toBe(true)
    expect(presentation.finishActionLabel).toBe('Finish setup')
    expect(presentation.lede).toContain('identity check and safety review are approved')
  })

  it('needs no member action while a submission waits on the safety team', () => {
    const presentation = onboardingIdentityPresentation(callInput({
      verificationStatus: 'pending',
      verification: { adminStatus: 'pending', identityStage: 'ready_for_review' },
    }))
    expect(presentation.action).toBe('none')
    expect(presentation.finishActionLabel).toBe('View verification status')
    expect(presentation.lede).toContain('reviewed by the safety team before access is approved')
  })

  it('continues an incomplete check and opens the private identity flow', () => {
    for (const stage of ['extracting', 'confirmation_required']) {
      const presentation = onboardingIdentityPresentation(callInput({
        verification: { identityStage: stage },
      }))
      expect(presentation.action).toBe('continue')
      expect(presentation.finishActionLabel).toBe('Continue identity check')
      expect(presentation.lede).toContain('government ID check and current selfie capture')
    }
    const created = onboardingIdentityPresentation(callInput({
      verification: { personaStatus: 'created' },
    }))
    expect(created.finishActionLabel).toBe('Continue identity check')
  })

  it('starts a new check for a fresh account or a rejected or expired attempt', () => {
    const fresh = onboardingIdentityPresentation(callInput())
    expect(fresh.finishActionLabel).toBe('Verify identity')
    expect(fresh.lede).toContain('reviewed by the safety team before booking unlocks')

    const rejected = onboardingIdentityPresentation(callInput({
      verificationStatus: 'rejected',
      verification: { adminStatus: 'rejected' },
    }))
    expect(rejected.action).toBe('retry')
    expect(rejected.finishActionLabel).toBe('Start a new identity check')

    const expired = onboardingIdentityPresentation(callInput({
      verification: { personaStatus: 'expired' },
    }))
    expect(expired.finishActionLabel).toBe('Start a new identity check')
  })

  it('uses an identity-eligible member as approved regardless of stale status fields', () => {
    const presentation = onboardingIdentityPresentation(callInput({
      verificationStatus: 'pending',
      identityEligible: true,
    }))
    expect(presentation.approved).toBe(true)
    expect(presentation.finishActionLabel).toBe('Finish setup')
  })

  it('keeps the palette copy free of em dashes', () => {
    const inputs = [
      callInput(),
      callInput({ verificationStatus: 'approved', identityEligible: true }),
      callInput({ verificationStatus: 'pending', verification: { adminStatus: 'pending' } }),
      callInput({ verification: { personaStatus: 'processing' } }),
    ]
    for (const input of inputs) {
      const presentation = onboardingIdentityPresentation(input)
      expect(presentation.finishActionLabel).not.toContain('—')
      expect(presentation.lede).not.toContain('—')
    }
  })
})
