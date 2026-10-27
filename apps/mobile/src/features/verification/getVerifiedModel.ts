import { companionStatusLabel } from '@/member/profileSections'
import { canOpenCompanionProfile, identityActionLabel, mobileIdentityPresentation, type LatestIdentityVerification, type CompanionGateVerification } from './identityPresentation'

export function getVerifiedModel(input: {
  identityEligible: boolean
  verificationStatus: string
  verification: (NonNullable<LatestIdentityVerification> & NonNullable<CompanionGateVerification>) | null | undefined
  applicationStatus?: string | null
}) {
  const identity = mobileIdentityPresentation(input.verificationStatus, input.verification, input.identityEligible)
  const companionDone = input.applicationStatus === 'approved'
  return {
    identity,
    identityActionLabel: identityActionLabel(identity.action),
    companionUnlocked: canOpenCompanionProfile(input.identityEligible, input.verification),
    companionDone,
    companionLabel: companionStatusLabel(!input.applicationStatus || input.applicationStatus === 'draft' ? 'not started' : input.applicationStatus),
    companionActionLabel: !input.applicationStatus || input.applicationStatus === 'draft' ? 'Create Companion profile' : 'Edit Companion profile',
    completedSteps: Number(input.identityEligible) + Number(companionDone),
  }
}
