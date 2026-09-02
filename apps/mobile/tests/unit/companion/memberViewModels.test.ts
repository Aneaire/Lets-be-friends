import { onboardingDecision } from '@/member/onboarding'
import { isViewerForClerkUser } from '@/member/account'
import { buildSignedInProfileViewModel } from '@/member/profileViewModel'

const viewer = {
  displayName: 'Alex Rivera',
  username: 'alexrivera',
  role: 'member' as const,
  createdAt: Date.UTC(2026, 2, 1),
  onboardingCompletedAt: Date.UTC(2026, 2, 2),
  verificationStatus: 'not_started' as const,
  identityEligible: false,
}

describe('member onboarding decisions', () => {
  it('requires username, then goal, before completion', () => {
    expect(onboardingDecision({})).toBe('choose_username')
    expect(onboardingDecision({ username: 'alexrivera' })).toBe('choose_goal')
    expect(onboardingDecision({ username: 'alexrivera', onboardingCompletedAt: 1 })).toBe('choose_goal')
    expect(onboardingDecision({
      username: 'alexrivera',
      onboardingCompletedAt: 1,
      approximateLatitude: 10.31,
      approximateLongitude: 123.89,
      approximateLocationConsentedAt: 1,
      termsAcceptedAt: 1,
      termsVersion: '2026-08-13',
    })).toBe('complete')
    expect(onboardingDecision({
      username: 'alexrivera',
      onboardingCompletedAt: 1,
      approximateLatitude: 10.315699,
      approximateLongitude: 123.89,
      approximateLocationConsentedAt: 1,
      termsAcceptedAt: 1,
      termsVersion: '2026-08-13',
    })).toBe('choose_goal')
  })
})

describe('account handoff safety', () => {
  it('accepts member data only for the current Clerk account', () => {
    expect(isViewerForClerkUser({ clerkUserId: 'user-a' }, 'user-a')).toBe(true)
    expect(isViewerForClerkUser({ clerkUserId: 'user-a' }, 'user-b')).toBe(false)
    expect(isViewerForClerkUser(undefined, 'user-a')).toBe(false)
  })
})

describe('signed-in profile copy', () => {
  it('uses the default avatar until the member uploads a profile photo', () => {
    expect(buildSignedInProfileViewModel(viewer, null).imageUrl).toBeUndefined()
    expect(buildSignedInProfileViewModel({ ...viewer, profileImageUrl: '/member-photo.jpg' }, null).imageUrl)
      .toBe('/member-photo.jpg')
  })

  it('does not claim verification without active eligibility', () => {
    const result = buildSignedInProfileViewModel(viewer, null)
    expect(result.verificationApproved).toBe(false)
    expect(result.verificationLabel).toBe('Identity not verified')
    expect(result.username).toBe('@alexrivera')
  })

  it('shows pending reviews without claiming approval', () => {
    const result = buildSignedInProfileViewModel(
      { ...viewer, verificationStatus: 'pending' },
      { adminStatus: 'pending', personaStatus: 'processing' },
    )
    expect(result.verificationApproved).toBe(false)
    expect(result.verificationLabel).toBe('Identity review pending')
  })

  it('distinguishes an unavailable identity result', () => {
    const result = buildSignedInProfileViewModel(
      viewer,
      { adminStatus: 'not_ready', personaStatus: 'pending' },
    )
    expect(result.verificationApproved).toBe(false)
    expect(result.verificationLabel).toBe('Identity status unavailable')
  })

  it('shows approval only from the authoritative eligibility flag', () => {
    const result = buildSignedInProfileViewModel(
      { ...viewer, verificationStatus: 'approved', identityEligible: true },
      { adminStatus: 'approved', personaStatus: 'approved' },
    )
    expect(result.verificationApproved).toBe(true)
    expect(result.verificationLabel).toBe('Identity verified')
  })
})
