type ReferralPromptSource = {
  programActive: boolean
  referredBy: unknown | null
}

/**
 * The friend's code card is a first-time welcome guide invitation. It is
 * offered on every visit until the member finishes setup, never to an account
 * that already finished the guide, and never to an already referred member.
 *
 * `hidden` is the "Not now" choice for this visit only. It resets when the
 * screen mounts again, so closing and reopening the app before setup completes
 * shows the card again.
 */
export function shouldShowOnboardingReferralPrompt({
  referral,
  onboardingCompletedAt,
  hidden,
}: {
  referral: ReferralPromptSource | null | undefined
  onboardingCompletedAt?: number
  hidden: boolean
}): boolean {
  if (!referral || !referral.programActive) return false
  if (referral.referredBy) return false
  if (hidden) return false
  return !onboardingCompletedAt
}
