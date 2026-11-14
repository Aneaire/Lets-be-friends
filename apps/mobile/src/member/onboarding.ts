import { currentPolicyVersion, hasCurrentUnifiedAcceptance, isPublicLegalPath } from '@lets-be-friends/shared'

export type OnboardingDecision = 'choose_username' | 'choose_goal' | 'complete'

const currentTermsVersion = currentPolicyVersion
export { currentTermsVersion }

// The AccountRouteCoordinator must never pull a member away from these
// public legal routes, including incomplete onboarding users reading them.
export function isExemptOnboardingPath(pathname: string): boolean {
  return isPublicLegalPath(pathname)
}

// Completed legacy accounts that only need reacceptance start directly on
// the final review step when their saved name and rounded location are
// valid. New users always start at the first step.
export function initialOnboardingStep(viewer: {
  username?: string
  onboardingCompletedAt?: number
  approximateLatitude?: number
  approximateLongitude?: number
  approximateLocationConsentedAt?: number
  termsAcceptedAt?: number
  termsVersion?: string
  privacyPolicyAcceptedAt?: number
  privacyPolicyVersion?: string
  identityConsentAcceptedAt?: number
  identityConsentVersion?: string
}): number {
  if (
    viewer.onboardingCompletedAt
    && viewer.username
    && isRoundedCoordinate(viewer.approximateLatitude)
    && isRoundedCoordinate(viewer.approximateLongitude)
    && !hasCurrentUnifiedAcceptance(viewer)
  ) return 5
  return 0
}

// A member who finished the welcome guide stays onboarded even without a saved
// rounded area. The area is required to finish setup, not to remain a member,
// and re-checking it here sent legacy accounts back through the whole guide.
// Current policy acceptance is still enforced.
export function onboardingDecision(viewer: {
  username?: string
  onboardingCompletedAt?: number
  approximateLatitude?: number
  approximateLongitude?: number
  approximateLocationConsentedAt?: number
  termsAcceptedAt?: number
  termsVersion?: string
  privacyPolicyAcceptedAt?: number
  privacyPolicyVersion?: string
  identityConsentAcceptedAt?: number
  identityConsentVersion?: string
}): OnboardingDecision {
  if (!viewer.username) return 'choose_username'
  if (!viewer.onboardingCompletedAt || !hasCurrentUnifiedAcceptance(viewer)) return 'choose_goal'
  return 'complete'
}

function isRoundedCoordinate(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && Math.round(value * 100) / 100 === value
}
