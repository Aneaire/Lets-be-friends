import { defaultOnboardingCompanionForm } from '@/features/companion/onboardingCompanionApplication'
import {
  finalizeOnboarding,
  onboardingLocationPreview,
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
    firstName: 'Maya',
    lastName: 'Friend',
    bio: 'Member bio.',
    categories: ['Coffee and meals'],
    applicationForm: {
      ...defaultOnboardingCompanionForm({ bio: 'Something personal about hobbies, family, and work.', categories: [] }),
      intro: 'I join relaxed public coffee chats and thoughtful city walks with clear plans.',
      city: 'Cebu City',
    },
    hasApplication: false,
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

  it('sends the raw fix for server jitter while exposing only a rounded preview', async () => {
    const payloads: unknown[] = []
    const location = { latitude: 10.315678, longitude: 123.891234 }
    const d = deps({
      goal: 'member', categories: [], location,
      saveOnboardingLocationAndConsent: async (payload) => { payloads.push(payload); d.calls.push('save') },
    })
    await finalizeOnboarding('complete', d)
    expect(payloads[0]).toMatchObject(location)
    expect(onboardingLocationPreview(location)).toEqual({ latitude: 10.32, longitude: 123.89 })
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

  it('has no deferral bypass for a new Companion', async () => {
    await expect(finalizeOnboarding('complete', deps())).rejects.toMatchObject({ code: 'application' })
    const legacy = deps()
    await expect(finalizeOnboarding('later' as never, legacy)).rejects.toMatchObject({ code: 'application' })
    expect(legacy.calls).toEqual([])
  })

  it('completes a member with the confirmed name, bio, and acceptance saved before completion', async () => {
    const profiles: unknown[] = []
    const d = deps({
      goal: 'member',
      categories: [],
      updateProfile: async (payload) => { profiles.push(payload); d.calls.push('updateProfile') },
    })
    const result = await finalizeOnboarding('complete', d)
    expect(result).toEqual({ submittedApplication: false })
    expect(d.calls).toEqual(['claimUsername', 'save', 'updateProfile', 'completeOnboarding'])
    expect(profiles[0]).toEqual({
      displayName: 'Maya Friend',
      firstName: 'Maya',
      lastName: 'Friend',
      bio: 'Member bio.',
    })
  })

  it('requires both boxes unless the current acceptance is already remembered', async () => {
    const missing = deps({ goal: 'member', categories: [], termsAccepted: false, privacyAccepted: false })
    await expect(finalizeOnboarding('complete', missing)).rejects.toMatchObject({ code: 'acceptance' })
    expect(missing.calls).toEqual([])
    const single = deps({ goal: 'member', categories: [], termsAccepted: false, privacyAccepted: true })
    await expect(finalizeOnboarding('complete', single)).rejects.toMatchObject({ code: 'acceptance' })
    expect(single.calls).toEqual([])
    await expect(finalizeOnboarding('complete', deps({ goal: 'member', categories: [], termsAccepted: true, privacyAccepted: true }))).resolves.toEqual({ submittedApplication: false })
    await expect(finalizeOnboarding('complete', deps({ goal: 'member', categories: [], termsAccepted: false, privacyAccepted: false, alreadyAccepted: true }))).resolves.toEqual({ submittedApplication: false })
  })

  it('saves Companion names without a member bio and keeps categories separate from the profile name save', async () => {
    const profiles: unknown[] = []
    const d = deps({
      updateProfile: async (payload) => { profiles.push(payload); d.calls.push('updateProfile') },
    })
    const result = await finalizeOnboarding('submit-profile', d)
    expect(result).toEqual({ submittedApplication: true })
    expect(d.calls).toEqual(['claimUsername', 'save', 'updateProfile', 'submitApplication', 'completeOnboarding'])
    expect(profiles[0]).toEqual({
      displayName: 'Maya Friend',
      firstName: 'Maya',
      lastName: 'Friend',
      onboardingCategories: ['Coffee and meals'],
    })
  })

  it('requires the confirmed name and a member bio before any persistence', async () => {
    const missingBio = deps({ goal: 'member', categories: [], bio: '   ' })
    await expect(finalizeOnboarding('complete', missingBio)).rejects.toMatchObject({
      code: 'profile',
      message: 'Add a short bio about the skills, talents, or everyday help you can share.',
    })
    expect(missingBio.calls).toEqual([])
    const missingLastName = deps({ goal: 'member', categories: [], lastName: '  ' })
    await expect(finalizeOnboarding('complete', missingLastName)).rejects.toMatchObject({
      code: 'profile',
      message: 'Enter your first and last name.',
    })
    expect(missingLastName.calls).toEqual([])
  })

  it('skips name validation and profile writes entirely for policy-only reacceptance', async () => {
    const d = deps({ categories: [], hasApplication: true, policyOnly: true, firstName: '', lastName: '', bio: '' })
    const result = await finalizeOnboarding('complete', d)
    expect(result).toEqual({ submittedApplication: false })
    expect(d.calls).toEqual(['claimUsername', 'save', 'completeOnboarding'])
    expect(d.calls).not.toContain('updateProfile')
  })

  it('lets an existing Companion finish the guide with names saved but no application resubmission', async () => {
    const profiles: unknown[] = []
    const d = deps({
      hasApplication: true,
      categories: [],
      updateProfile: async (payload) => { profiles.push(payload); d.calls.push('updateProfile') },
    })
    const result = await finalizeOnboarding('complete', d)
    expect(result).toEqual({ submittedApplication: false })
    expect(d.calls).toEqual(['claimUsername', 'save', 'updateProfile', 'completeOnboarding'])
    expect(d.calls).not.toContain('submitApplication')
    expect(profiles[0]).toMatchObject({ firstName: 'Maya', lastName: 'Friend' })
  })

  it('treats completed accounts as policy-only even without a profile or categories', async () => {
    const d = deps({ categories: [], hasApplication: false, policyOnly: true })
    const result = await finalizeOnboarding('complete', d)
    expect(result).toEqual({ submittedApplication: false })
    expect(d.calls).toEqual(['claimUsername', 'save', 'completeOnboarding'])
  })

  it('skips claiming when the username is already set', async () => {
    const d = deps({ goal: 'member', categories: [], viewerUsername: 'maya_friend' })
    await finalizeOnboarding('complete', d)
    expect(d.calls).toEqual(['save', 'updateProfile', 'completeOnboarding'])
  })

  it('exposes FinalizeError codes for username, location, and categories', async () => {
    await expect(finalizeOnboarding('complete', deps({ goal: 'member', categories: [], usernameReady: false }))).rejects.toMatchObject({ code: 'username' })
    await expect(finalizeOnboarding('complete', deps({ goal: 'member', categories: [], location: null }))).rejects.toMatchObject({ code: 'location' })
    await expect(finalizeOnboarding('submit-profile', deps({ categories: [] }))).rejects.toMatchObject({ code: 'categories' })
  })

  it('does not complete when acceptance persistence fails', async () => {
    const d = deps({ goal: 'member', categories: [], saveOnboardingLocationAndConsent: async () => { throw new Error('offline') } })
    await expect(finalizeOnboarding('complete', d)).rejects.toMatchObject({ code: 'persistence' })
    expect(d.calls).not.toContain('completeOnboarding')
  })
})
