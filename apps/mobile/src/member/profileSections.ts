export type CompanionStatus =
  | 'approved'
  | 'pending_review'
  | 'rejected'
  | 'suspended'
  | 'draft'
  | 'not started'
  | (string & {})

export function companionStatusLabel(status: string): string {
  if (status === 'approved') return 'Profile saved'
  if (status === 'pending_review') return 'Saved'
  if (status === 'rejected') return 'Needs changes'
  if (status === 'suspended') return 'Suspended'
  if (status === 'not started') return 'Not started'
  if (status === 'draft') return 'Draft'
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll('_', ' ')
}

export function companionStatusTone(status: string): 'self' | 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success'
  if (status === 'rejected' || status === 'suspended') return 'danger'
  if (status === 'pending_review') return 'warning'
  return 'self'
}

export function companionModeLabel(mode: string): string {
  if (mode === 'online') return 'Online'
  if (mode === 'in_person') return 'In-person'
  return 'Online and in-person'
}

/**
 * Mirrors web profile.tsx: a Companion profile is readable by others only
 * while it is approved and the member holds a current identity approval.
 * Uses the authoritative viewer/application fields, never invented ids.
 */
export function companionIsPublic(applicationStatus: string | null | undefined, identityEligible: boolean): boolean {
  return applicationStatus === 'approved' && identityEligible === true
}

export function formatDiscoveryArea(latitude: unknown, longitude: unknown): string {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return ''
  return `${latitude}, ${longitude}`
}

export type ProfileActionId = 'edit' | 'bookings' | 'companion'

export function profileActionLabels(hasApplication: boolean): Array<{ id: ProfileActionId; label: string }> {
  return [
    { id: 'edit', label: 'Edit profile' },
    { id: 'bookings', label: 'Your bookings' },
    { id: 'companion', label: hasApplication ? 'Edit Companion profile' : 'Become a Companion' },
  ]
}

export type VerificationAction = 'verify' | 'continue' | 'retry' | 'none'

export function verificationActionFor(
  viewerStatus: string,
  verification: { adminStatus?: string | null; personaStatus?: string | null; identityStage?: string | null } | null | undefined,
  approved: boolean,
): VerificationAction {
  if (approved) return 'none'
  if (viewerStatus === 'rejected' || verification?.adminStatus === 'rejected') return 'retry'
  if (verification?.personaStatus === 'failed' || verification?.personaStatus === 'expired') return 'retry'
  if (
    viewerStatus === 'pending'
    || verification?.adminStatus === 'pending'
    || ['created', 'in_progress', 'processing', 'completed', 'pending'].includes(verification?.personaStatus ?? '')
    || ['extracting', 'confirmation_required', 'ready_for_review'].includes(verification?.identityStage ?? '')
  ) {
    if (
      verification?.identityStage === 'extracting'
      || verification?.identityStage === 'confirmation_required'
      || verification?.personaStatus === 'created'
      || verification?.personaStatus === 'in_progress'
    ) {
      return 'continue'
    }
    return 'none'
  }
  if (verification?.adminStatus === 'not_ready') return 'none'
  return 'verify'
}
