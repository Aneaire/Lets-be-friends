export type OnboardingGoal = 'member' | 'friend_host'

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
  viewer: undefined | null | { clerkUserId: string; username?: string; onboardingCompletedAt?: number }
  pathname: string
}): OnboardingGateDecision {
  if (!clerkLoaded) return 'loading'
  if (!signedIn) return 'allow'
  if (convexLoading) return 'loading'
  if (!convexAuthenticated || !clerkUserId) return 'auth_error'
  if (viewer === undefined) return 'loading'
  if (viewer !== null && viewer.clerkUserId !== clerkUserId) return 'identity_mismatch'
  if (viewer === null) return 'provision'
  if ((!viewer.username || !viewer.onboardingCompletedAt) && pathname !== '/onboarding') return 'redirect_onboarding'
  return 'allow'
}

export function onboardingDestination(goal: OnboardingGoal) {
  return goal === 'friend_host' ? '/become-host' as const : '/discover' as const
}

export function goalForSkip(goal?: OnboardingGoal): OnboardingGoal {
  return goal ?? 'member'
}
