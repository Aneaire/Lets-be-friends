export type MemberVerificationStatus = 'not_started' | 'pending' | 'approved' | 'rejected'
export type PersonaStatus = 'not_started' | 'created' | 'in_progress' | 'processing' | 'completed' | 'failed' | 'expired' | 'pending' | 'approved' | 'rejected'
export type PersonaDecision = 'unknown' | 'passed' | 'needs_review' | 'declined'
export type AdminVerificationStatus = 'not_ready' | 'pending' | 'approved' | 'rejected' | 'not_started'

export type LatestIdentityVerification = {
  personaStatus?: PersonaStatus | null
  personaDecision?: PersonaDecision | null
  adminStatus?: AdminVerificationStatus | null
} | null

export type MemberVerificationPresentation = {
  state: 'not_started' | 'action_required' | 'provider_processing' | 'admin_pending' | 'approved' | 'provider_declined' | 'admin_rejected' | 'expired'
  label: string
  tone: 'self' | 'success' | 'warning' | 'danger'
  guidance: string
  action: 'start' | 'continue' | 'retry' | 'none'
}

export function identityEntitlementStatus(status: MemberVerificationStatus, identityEligible: boolean) {
  if (identityEligible) return 'approved' as const
  return status === 'approved' ? 'not_started' as const : status
}

export function memberVerificationPresentation(
  status: MemberVerificationStatus,
  latestRequest?: LatestIdentityVerification,
): MemberVerificationPresentation {
  if (status === 'approved') {
    return {
      state: 'approved',
      label: 'Identity approved',
      tone: 'success',
      guidance: 'Persona completed your identity check and the safety team approved it. You can request bookings with Friend Hosts.',
      action: 'none',
    }
  }

  if (latestRequest?.adminStatus === 'approved') {
    return {
      state: 'expired',
      label: 'Verification renewal needed',
      tone: 'warning',
      guidance: 'Your previous identity approval is no longer current. Complete a new Persona check and safety review before booking or hosting again.',
      action: 'retry',
    }
  }

  if (latestRequest?.adminStatus === 'rejected' || status === 'rejected') {
    return {
      state: 'admin_rejected',
      label: 'Not approved',
      tone: 'danger',
      guidance: 'The safety team did not approve this identity attempt. Start a new Persona check if another attempt is available.',
      action: 'retry',
    }
  }

  if (latestRequest?.adminStatus === 'pending') {
    if (latestRequest.personaDecision === 'declined') {
      return {
        state: 'provider_declined',
        label: 'Review required',
        tone: 'danger',
        guidance: 'Persona could not verify this identity. The safety team will review the result before closing the attempt.',
        action: 'none',
      }
    }
    return {
      state: 'admin_pending',
      label: 'Safety review pending',
      tone: 'warning',
      guidance: 'Your Persona identity check is complete. Every identity is reviewed by the safety team before access is approved.',
      action: 'none',
    }
  }

  if (
    latestRequest?.personaStatus === 'processing'
    || (latestRequest?.personaStatus === 'completed' && latestRequest.adminStatus === 'not_ready')
  ) {
    return {
      state: 'provider_processing',
      label: 'Processing identity',
      tone: 'warning',
      guidance: 'Persona is processing your government ID and live selfie. Booking remains locked until Persona finishes and an admin reviews it.',
      action: 'none',
    }
  }

  if (latestRequest?.personaStatus === 'expired' || latestRequest?.personaStatus === 'failed') {
    return {
      state: 'expired',
      label: 'New attempt needed',
      tone: 'danger',
      guidance: 'This Persona attempt could not be completed. Start a new identity check to continue.',
      action: 'retry',
    }
  }

  if (latestRequest?.personaStatus === 'created' || latestRequest?.personaStatus === 'in_progress' || status === 'pending') {
    return {
      state: 'action_required',
      label: 'Identity check incomplete',
      tone: 'self',
      guidance: 'Continue the secure Persona flow to submit your government ID and live selfie for safety review.',
      action: 'continue',
    }
  }

  return {
    state: 'not_started',
    label: 'Identity not started',
    tone: 'self',
    guidance: 'Complete a secure Persona government ID and live-selfie check. The safety team reviews every result before booking access is approved.',
    action: 'start',
  }
}
