import { currentPolicyVersion, hasCurrentUnifiedAcceptance, isPublicLegalPath } from '@lets-be-friends/shared'

export type OnboardingGoal = 'member' | 'companion'

export const currentTermsVersion = currentPolicyVersion

export type OnboardingGateDecision =
  | 'loading'
  | 'allow'
  | 'provision'
  | 'redirect_onboarding'
  | 'auth_error'
  | 'identity_mismatch'

export function onboardingGateDecision({
  clerkLoaded,
  signedIn,
  clerkUserId,
  convexLoading,
  convexAuthenticated,
  viewer,
  pathname,
}: {
  clerkLoaded: boolean
  signedIn: boolean
  clerkUserId: string | null | undefined
  convexLoading: boolean
  convexAuthenticated: boolean
  viewer: undefined | null | {
    clerkUserId: string
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
  }
  pathname: string
}): OnboardingGateDecision {
  // The dedicated legal pages stay readable to everyone, including
  // signed-out visitors, unaccepted accounts, and loading states.
  if (isPublicLegalPath(pathname)) return 'allow'
  if (!clerkLoaded) return 'loading'
  if (!signedIn) return 'allow'
  if (convexLoading) return 'loading'
  if (!convexAuthenticated || !clerkUserId) return 'auth_error'
  if (viewer === undefined) return 'loading'
  if (viewer !== null && viewer.clerkUserId !== clerkUserId) return 'identity_mismatch'
  if (viewer === null) return 'provision'
  // A member who finished the welcome guide stays onboarded even without a
  // saved rounded area. The area is required to finish setup, not to remain a
  // member, and re-checking it here sent legacy accounts back through the
  // whole guide. Current policy acceptance is still enforced.
  const onboardingComplete = Boolean(
    viewer.username
    && viewer.onboardingCompletedAt
    && hasCurrentUnifiedAcceptance(viewer),
  )
  if (!onboardingComplete && pathname !== '/onboarding') return 'redirect_onboarding'
  return 'allow'
}

function isRoundedCoordinate(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && Math.round(value * 100) / 100 === value
}

export { isRoundedCoordinate }

export function onboardingDestination(goal: OnboardingGoal) {
  return goal === 'companion' ? '/companion' as const : '/nearby' as const
}

export function deviceLocationErrorMessage(code: number) {
  if (code === 1) {
    return 'Location permission is blocked. Allow location in your browser site settings, reload, then try again.'
  }
  if (code === 2) {
    return 'Your browser could not determine your location. Try again or use another browser.'
  }
  if (code === 3) {
    return 'Finding your location timed out. Try again.'
  }
  return 'Device location could not be read. Try again.'
}
