export type OnboardingDecision = 'choose_username' | 'choose_goal' | 'complete'

export function onboardingDecision(viewer: { username?: string; onboardingCompletedAt?: number }): OnboardingDecision {
  if (!viewer.username) return 'choose_username'
  if (!viewer.onboardingCompletedAt) return 'choose_goal'
  return 'complete'
}
