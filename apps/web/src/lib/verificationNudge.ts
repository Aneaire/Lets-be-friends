import type { MemberVerificationPresentation } from './memberVerification'

export type CompanionSetupState = 'none' | 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended'

export type VerificationNudge = {
  highlight: boolean
  label: string
}

export function verificationNudge(
  identity: Pick<MemberVerificationPresentation, 'state'> | null | undefined,
  companion: CompanionSetupState | null | undefined,
): VerificationNudge {
  if (!identity || identity.state !== 'approved') {
    return { highlight: true, label: 'Verify identity' }
  }
  if (!companion || companion === 'none' || companion === 'draft') {
    return { highlight: true, label: 'Unlock earnings' }
  }
  return { highlight: false, label: 'Verified' }
}

export function companionSetupState(status: string | null | undefined): CompanionSetupState {
  if (status === 'approved' || status === 'pending_review' || status === 'rejected' || status === 'suspended' || status === 'draft') {
    return status
  }
  return 'none'
}
