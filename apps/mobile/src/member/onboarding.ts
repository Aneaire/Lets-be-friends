export type OnboardingDecision = 'choose_username' | 'choose_goal' | 'complete'

const currentTermsVersion = '2026-08-13'

export function onboardingDecision(viewer: {
  username?: string
  onboardingCompletedAt?: number
  approximateLatitude?: number
  approximateLongitude?: number
  approximateLocationConsentedAt?: number
  termsAcceptedAt?: number
  termsVersion?: string
}): OnboardingDecision {
  if (!viewer.username) return 'choose_username'
  if (
    !viewer.onboardingCompletedAt
    || !isRoundedCoordinate(viewer.approximateLatitude)
    || !isRoundedCoordinate(viewer.approximateLongitude)
    || !viewer.approximateLocationConsentedAt
    || !viewer.termsAcceptedAt
    || viewer.termsVersion !== currentTermsVersion
  ) return 'choose_goal'
  return 'complete'
}

function isRoundedCoordinate(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && Math.round(value * 100) / 100 === value
}
