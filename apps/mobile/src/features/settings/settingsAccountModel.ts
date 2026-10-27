import { verificationActionFor, type VerificationAction } from '@/member/profileSections'

/**
 * Pure model behind the Settings verification row and gated sections.
 * Settings links to consolidated status. Only verify, continue, and retry
 * actions need an identity handoff; current approval needs no new check.
 */
export function settingsAccountModel(input: {
  verificationStatus: string
  verification: { adminStatus?: string | null; personaStatus?: string | null; identityStage?: string | null } | null | undefined
  identityEligible: boolean
  applicationStatus?: string | null
}): {
  verificationAction: VerificationAction
  showVerificationFlow: boolean
  showWithdrawals: boolean
  showCompanionSections: boolean
} {
  const verificationAction = verificationActionFor(input.verificationStatus, input.verification, input.identityEligible)
  return {
    verificationAction,
    showVerificationFlow: verificationAction !== 'none',
    showWithdrawals: input.identityEligible,
    showCompanionSections: input.applicationStatus === 'approved',
  }
}
