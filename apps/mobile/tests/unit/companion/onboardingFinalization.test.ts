import { defaultOnboardingCompanionForm } from '@/features/companion/onboardingCompanionApplication'
import {
  finalizeOnboarding,
  type FinalizeDeps,
} from '@/features/companion/onboardingFinalization'

function deps(overrides: Partial<FinalizeDeps> = {}): FinalizeDeps & { calls: string[] } {
  const calls: string[] = []
  return {
    viewerUsername: undefined,
    usernameReady: true,
    normalizedUsername: 'maya_friend',
    location: { latitude: 10.31, longitude: 123.89 },
    termsAccepted: true,
    privacyAccepted: true,
    alreadyAccepted: false,
    policyOnly: false,
    goal: 'companion',
    categories: ['Coffee and meals'],
    applicationForm: {
      ...defaultOnboardingCompanionForm({ bio: 'Something personal about hobbies, family, and work.', categories: [] }),
      intro: 'I join relaxed public coffee chats and thoughtful city walks with clear plans.',
      city: 'Cebu City',
    },
    hasApplication: false,
    displayName: 'Maya Friend',
    viewerBio: 'Member bio.',
    claimUsername: async () => { calls.push('claimUsername') },
    saveOnboardingLocationAndConsent: async () => { calls.push('save') },
    updateProfile: async () => { calls.push('updateProfile') },
    submitApplication: async () => { calls.push('submitApplication') },
    completeOnboarding: async () => { calls.push('completeOnboarding') },
    policyVersion: '2026-10-17',
    ...overrides,
    calls,
  }
}

describe('mobile onboarding finalization', () => {
  it('saves acceptance before Companion submission and completes last', async () => {
    const d = deps()
    const result = await finalizeOnboarding('submit-profile', d)
    expect(result).toEqual({ submittedApplication: true })
    expect(d.calls).toEqual(['claimUsername', 'save', 'updateProfile', 'submitApplication', 'completeOnboarding'])
  })

  it('rejects a failed Companion submission before completion and keeps the error observable', async () => {
    const d = deps({ submitApplication: async () => { d.calls.push('submitApplication'); throw new Error('taken') } })
    await expect(finalizeOnboarding('submit-profile', d)).rejects.toMatchObject({ code: 'application' })
    expect(d.calls).toEqual(['claimUsername', 'save', 'updateProfile', 'submitApplication'])
    expect(d.calls).not.toContain('completeOnboarding')
  })

  it('rejects an invalid Companion form before persisting anything', async () => {
    const d = deps({ applicationForm: { ...deps().applicationForm, intro: 'Too short' } })
    await expect(finalizeOnboarding('submit-profile', d)).rejects.toMatchObject({ code: 'application' })
    expect(d.calls).toEqual([])
  })

  it('never submits on the explicit later intent but still completes', async () => {
    const d = deps()
    const result = await finalizeOnboarding('later', d)
    expect(result).toEqual({ submittedApplication: false })
    expect(d.calls).toEqual(['claimUsername', 'save', 'updateProfile', 'completeOnboarding'])
    expect(d.calls).not.toContain('submitApplication')
  })

  it('requires both boxes unless the current acceptance is already remembered', async () => {
    await expect(finalizeOnboarding('later', deps({ termsAccepted: false, privacyAccepted: true }))).rejects.toMatchObject({ code: 'acceptance' })
    await expect(finalizeOnboarding('later', deps({ termsAccepted: true, privacyAccepted: true }))).resolves.toEqual({ submittedApplication: false })
    await expect(finalizeOnboarding('later', deps({ termsAccepted: false, privacyAccepted: false, alreadyAccepted: true }))).resolves.toEqual({ submittedApplication: false })
  })

  it('lets an existing Companion reaccept policy-only without categories or profile writes', async () => {
    const d = deps({ categories: [], hasApplication: true })
    const result = await finalizeOnboarding('later', d)
    expect(result).toEqual({ submittedApplication: false })
    expect(d.calls).toEqual(['claimUsername', 'save', 'completeOnboarding'])
    expect(d.calls).not.toContain('updateProfile')
    expect(d.calls).not.toContain('submitApplication')
  })

  it('treats completed accounts as policy-only even without a profile or categories', async () => {
    const d = deps({ categories: [], hasApplication: false, policyOnly: true })
    const result = await finalizeOnboarding('submit-profile', d)
    expect(result).toEqual({ submittedApplication: false })
    expect(d.calls).toEqual(['claimUsername', 'save', 'completeOnboarding'])
  })

  it('skips claiming when the username is already set', async () => {
    const d = deps({ viewerUsername: 'maya_friend' })
    await finalizeOnboarding('later', d)
    expect(d.calls).toEqual(['save', 'updateProfile', 'completeOnboarding'])
  })

  it('exposes FinalizeError codes for username, location, and categories', async () => {
    await expect(finalizeOnboarding('later', deps({ usernameReady: false }))).rejects.toMatchObject({ code: 'username' })
    await expect(finalizeOnboarding('later', deps({ location: null }))).rejects.toMatchObject({ code: 'location' })
    await expect(finalizeOnboarding('later', deps({ categories: [] }))).rejects.toMatchObject({ code: 'categories' })
  })
})
