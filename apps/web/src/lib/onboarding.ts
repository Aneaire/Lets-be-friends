export type OnboardingGoal = 'member' | 'companion'

export const currentTermsVersion = '2026-08-13'

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
  }
  pathname: string
}): OnboardingGateDecision {
  if (!clerkLoaded) return 'loading'
  if (!signedIn) return 'allow'
  if (convexLoading) return 'loading'
  if (!convexAuthenticated || !clerkUserId) return 'auth_error'
  if (viewer === undefined) return 'loading'
  if (viewer !== null && viewer.clerkUserId !== clerkUserId) return 'identity_mismatch'
  if (viewer === null) return 'provision'
  const onboardingComplete = Boolean(
    viewer.username
    && viewer.onboardingCompletedAt
    && isRoundedCoordinate(viewer.approximateLatitude)
    && isRoundedCoordinate(viewer.approximateLongitude)
    && viewer.approximateLocationConsentedAt
    && viewer.termsAcceptedAt
    && viewer.termsVersion === currentTermsVersion,
  )
  if (!onboardingComplete && pathname !== '/onboarding') return 'redirect_onboarding'
  return 'allow'
}

function isRoundedCoordinate(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && Math.round(value * 100) / 100 === value
}

export function onboardingDestination(goal: OnboardingGoal) {
  return goal === 'companion' ? '/become-companion' as const : '/discover' as const
}

export function goalForSkip(goal?: OnboardingGoal): OnboardingGoal {
  return goal ?? 'member'
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
