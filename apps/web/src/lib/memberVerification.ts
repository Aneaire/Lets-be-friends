export type MemberVerificationStatus = 'not_started' | 'pending' | 'approved' | 'rejected'
export type PersonaStatus = 'not_started' | 'created' | 'in_progress' | 'processing' | 'completed' | 'failed' | 'expired' | 'pending' | 'approved' | 'rejected'
export type PersonaDecision = 'unknown' | 'passed' | 'needs_review' | 'declined'
export type AdminVerificationStatus = 'not_ready' | 'pending' | 'approved' | 'rejected' | 'not_started'

export type LatestIdentityVerification = {
  personaStatus?: PersonaStatus | null
  personaDecision?: PersonaDecision | null
  adminStatus?: AdminVerificationStatus | null
  verificationSource?: 'persona' | 'in_app' | 'legacy_manual' | null
  identityStage?: 'draft' | 'extracting' | 'confirmation_required' | 'ready_for_review' | 'failed' | 'approved' | 'rejected' | 'purged' | null
} | null

export type MemberVerificationPresentation = {
  state: 'not_started' | 'action_required' | 'provider_processing' | 'admin_pending' | 'approved' | 'provider_declined' | 'admin_rejected' | 'expired'
  label: string
  tone: 'self' | 'success' | 'warning' | 'danger'
  guidance: string
  action: 'start' | 'continue' | 'retry' | 'none'
}

export type CompanionGateVerification = {
  adminStatus?: AdminVerificationStatus | null
  verificationSource?: 'persona' | 'in_app' | 'legacy_manual' | null
  identityStage?: 'draft' | 'extracting' | 'confirmation_required' | 'ready_for_review' | 'failed' | 'approved' | 'rejected' | 'purged' | null
  isCurrent?: boolean | null
  reason?: string | null
} | null | undefined

// A Companion profile may be opened, submitted, or resubmitted only when the
// member has a current approved identity or the current identity attempt is
// ready for admin review. This mirrors isIdentityReadyForAdminReview in
// apps/web/convex/identityVerification.ts: only adminStatus pending with a
// current in_app attempt in ready_for_review counts. Incomplete, processing,
// expired, rejected, and dormant Persona attempts stay locked.
export function canOpenCompanionProfile(identityEligible: boolean, latest?: CompanionGateVerification) {
  if (identityEligible) return true
  if (!latest) return false
  if (latest.adminStatus !== 'pending') return false
  if (latest.isCurrent !== true) return false
  if (latest.reason === 'booking') return false
  if (latest.verificationSource === 'in_app') return latest.identityStage === 'ready_for_review'
  return false
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
      guidance: 'Your identity check and safety review are approved. You can request bookings with Companions.',
      action: 'none',
    }
  }

  if (latestRequest?.adminStatus === 'approved') {
    return {
      state: 'expired',
      label: 'Verification renewal needed',
      tone: 'warning',
      guidance: 'Your previous identity approval is no longer current. Complete a new identity check and safety review before booking or companion again.',
      action: 'retry',
    }
  }

  if (latestRequest?.adminStatus === 'rejected' || status === 'rejected') {
    return {
      state: 'admin_rejected',
      label: 'Not approved',
      tone: 'danger',
      guidance: 'The safety team did not approve this identity attempt. Start a new identity check if another attempt is available.',
      action: 'retry',
    }
  }

  if (latestRequest?.adminStatus === 'pending') {
    if (latestRequest.personaDecision === 'declined') {
      return {
        state: 'provider_declined',
        label: 'Review required',
        tone: 'danger',
        guidance: 'The identity provider could not verify this identity. The safety team will review the result before closing the attempt.',
        action: 'none',
      }
    }
    return {
      state: 'admin_pending',
      label: 'Safety review pending',
      tone: 'warning',
      guidance: 'Your identity submission is complete. Every identity is reviewed by the safety team before access is approved.',
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
      guidance: 'Your government ID is being processed. Booking remains locked until processing finishes and a safety reviewer approves it.',
      action: 'none',
    }
  }

  if (latestRequest?.personaStatus === 'expired' || latestRequest?.personaStatus === 'failed') {
    return {
      state: 'expired',
      label: 'New attempt needed',
      tone: 'danger',
      guidance: 'This identity attempt could not be completed. Start a new identity check to continue.',
      action: 'retry',
    }
  }

  if (latestRequest?.identityStage === 'draft' || latestRequest?.identityStage === 'extracting' || latestRequest?.identityStage === 'confirmation_required' || latestRequest?.personaStatus === 'created' || latestRequest?.personaStatus === 'in_progress' || status === 'pending') {
    return {
      state: 'action_required',
      label: 'Identity check incomplete',
      tone: 'self',
      guidance: 'Continue the private identity flow to confirm your government ID details and take a current selfie for safety review.',
      action: 'continue',
    }
  }

  return {
    state: 'not_started',
    label: 'Identity not started',
    tone: 'self',
    guidance: 'Complete a private government ID check and current selfie capture. The safety team reviews every submission before booking access is approved.',
    action: 'start',
  }
}
