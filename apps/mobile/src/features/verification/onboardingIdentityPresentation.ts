import { verificationActionFor, type VerificationAction } from '@/member/profileSections'

/**
 * Pure model for the identity-aware final step of the mobile welcome guide,
 * mirroring the web onboarding finish step. The recorded verification status
 * decides the finishing action: an approved identity (or an attempt that no
 * longer needs member action) finishes straight into the app, while anything
 * that needs the member opens the private identity check on web.
 */
export type OnboardingIdentityPresentation = {
  action: VerificationAction
  approved: boolean
  finishActionLabel: string
  lede: string
}

export function onboardingIdentityPresentation(input: {
  verificationStatus: string
  verification: {
    adminStatus?: string | null
    personaStatus?: string | null
    identityStage?: string | null
  } | null | undefined
  identityEligible: boolean
}): OnboardingIdentityPresentation {
  const action = verificationActionFor(input.verificationStatus, input.verification, input.identityEligible)
  const approved = input.identityEligible

  if (approved || action === 'none') {
    return {
      action,
      approved,
      finishActionLabel: approved ? 'Finish setup' : 'View verification status',
      lede: approved
        ? 'Your identity check and safety review are approved. Agree to both documents below, then continue to Bookings when you are ready.'
        : `${verifyNoneGuidance(input.verification)} Agree to both documents below, then continue to your verification status, or explore after acceptance.`,
    }
  }

  return {
    action,
    approved,
    finishActionLabel:
      action === 'continue'
        ? 'Continue identity check'
        : action === 'retry'
          ? 'Start a new identity check'
          : 'Verify identity',
    lede: 'Agree to both documents below, then complete a private government ID check and current selfie capture. Every submission is reviewed by the safety team before booking unlocks.',
  }
}

// Mirrors the web presentation: processing and pending submissions need no
// member action, but the member should know where their check stands.
function verifyNoneGuidance(verification: {
  personaStatus?: string | null
  adminStatus?: string | null
} | null | undefined) {
  if (verification?.adminStatus === 'pending') {
    return 'Your identity submission is complete. Every identity is reviewed by the safety team before access is approved.'
  }
  if (verification?.personaStatus === 'processing' || verification?.personaStatus === 'completed') {
    return 'Your government ID is being processed. Booking remains locked until processing finishes and a safety reviewer approves it.'
  }
  return 'Your submission status can be followed from your verification page.'
}
