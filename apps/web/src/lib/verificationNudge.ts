import type { MemberVerificationPresentation } from './memberVerification'

// Companion profiles save live, so identity verification is the only review
// step. Legacy profile statuses (pending_review, rejected, suspended) stay
// mapped without implying an active profile review queue.

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

// The account header shows the verified badge and drops the Get verified link
// only when the member has cleared both steps: the approved identity check and a
// saved Companion profile. That is exactly the point where the nudge goes quiet,
// so the badge and the Get verified link never disagree.
export function fullyVerifiedAccount(
  identity: Pick<MemberVerificationPresentation, 'state'> | null | undefined,
  companion: CompanionSetupState | null | undefined,
): boolean {
  return verificationNudge(identity, companion).highlight === false
}

export function companionSetupState(status: string | null | undefined): CompanionSetupState {
  if (status === 'approved' || status === 'pending_review' || status === 'rejected' || status === 'suspended' || status === 'draft') {
    return status
  }
  return 'none'
}
