import type { Doc } from './_generated/dataModel'

export const identityVerificationReasons = ['member', 'booking', 'host_application', 'reverification'] as const

export type PersonaStatus =
  | 'not_started'
  | 'created'
  | 'in_progress'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'pending'
  | 'approved'
  | 'rejected'

export type PersonaDecision = 'unknown' | 'passed' | 'needs_review' | 'declined'
export type IdentityAdminStatus = 'not_ready' | 'pending' | 'approved' | 'rejected' | 'not_started'
export type IdentityRecordStage = 'draft' | 'extracting' | 'confirmation_required' | 'ready_for_review' | 'failed' | 'approved' | 'rejected' | 'purged'

export function isRealPersonaInquiryId(value: string | undefined) {
  return Boolean(value?.startsWith('inq_') && !value.startsWith('persona_dummy_'))
}

export function isIdentityVerificationReason(value: string): value is typeof identityVerificationReasons[number] {
  return identityVerificationReasons.includes(value as typeof identityVerificationReasons[number])
}

export function isPersonaTerminal(status: PersonaStatus) {
  return status === 'completed' || status === 'failed' || status === 'expired' || status === 'approved' || status === 'rejected'
}

export function personaLifecycleRank(status: PersonaStatus) {
  if (status === 'not_started') return 0
  if (status === 'created') return 1
  if (status === 'in_progress' || status === 'pending') return 2
  if (status === 'processing') return 3
  return 4
}

export function isIdentityReadyForAdminReview(
  request: Pick<Doc<'verificationRequests'>, 'adminStatus' | 'personaStatus' | 'personaInquiryId' | 'verificationSource' | 'identityStage' | 'isCurrent'>,
) {
  if (request.adminStatus !== 'pending' || request.isCurrent !== true) return false
  if (request.verificationSource === 'in_app') return request.identityStage === 'ready_for_review'
  return (request.personaStatus === 'completed' || request.personaStatus === 'failed')
    && request.verificationSource === 'persona'
    && isRealPersonaInquiryId(request.personaInquiryId)
}

export function canAdminApproveIdentity(
  request: Pick<Doc<'verificationRequests'>, 'adminStatus' | 'personaStatus' | 'personaDecision' | 'personaInquiryId' | 'verificationSource' | 'identityStage' | 'isCurrent'>,
) {
  return isIdentityReadyForAdminReview(request)
    && (request.verificationSource === 'in_app' || (
      request.personaStatus === 'completed'
      && (request.personaDecision === 'passed' || request.personaDecision === 'needs_review')
    ))
}

export function hasCurrentPersonaApproval(
  user: Pick<Doc<'users'>, 'verificationStatus' | 'verificationSource' | 'identityVerifiedAt' | 'identityExpiresAt'>,
  now = Date.now(),
) {
  return user.verificationStatus === 'approved'
    && user.verificationSource === 'persona'
    && typeof user.identityVerifiedAt === 'number'
    && typeof user.identityExpiresAt === 'number'
    && user.identityExpiresAt > now
}

export function identityTestBypassAllowed(user: Pick<Doc<'users'>, 'clerkUserId'>) {
  const allowedUserIds = process.env.IDENTITY_TEST_BYPASS_USER_IDS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? []
  return allowedUserIds.includes(user.clerkUserId)
}

export function hasCurrentIdentityApproval(
  user: Pick<Doc<'users'>, 'clerkUserId' | 'verificationStatus' | 'verificationSource' | 'identityVerifiedAt' | 'identityExpiresAt' | 'identityTestBypass'>,
  now = Date.now(),
) {
  return (user.verificationStatus === 'approved'
      && (user.verificationSource === 'persona' || user.verificationSource === 'in_app')
      && typeof user.identityVerifiedAt === 'number'
      && typeof user.identityExpiresAt === 'number'
      && user.identityExpiresAt > now)
    || (identityTestBypassAllowed(user) && user.identityTestBypass === true)
}

export function personaEventTransition(eventName: string): {
  personaStatus: PersonaStatus
  personaDecision: PersonaDecision
  adminStatus: IdentityAdminStatus
  queueForAdmin: boolean
} | null {
  if (eventName === 'inquiry.approved') {
    return { personaStatus: 'completed', personaDecision: 'passed', adminStatus: 'pending', queueForAdmin: true }
  }
  if (eventName === 'inquiry.marked-for-review') {
    return { personaStatus: 'completed', personaDecision: 'needs_review', adminStatus: 'pending', queueForAdmin: true }
  }
  if (eventName === 'inquiry.declined') {
    return { personaStatus: 'completed', personaDecision: 'declined', adminStatus: 'pending', queueForAdmin: true }
  }
  if (eventName === 'inquiry.failed') {
    return { personaStatus: 'failed', personaDecision: 'declined', adminStatus: 'pending', queueForAdmin: true }
  }
  if (eventName === 'inquiry.expired') {
    return { personaStatus: 'expired', personaDecision: 'unknown', adminStatus: 'not_ready', queueForAdmin: false }
  }
  if (eventName === 'inquiry.completed') {
    return { personaStatus: 'processing', personaDecision: 'unknown', adminStatus: 'not_ready', queueForAdmin: false }
  }
  if (eventName === 'inquiry.started') {
    return { personaStatus: 'in_progress', personaDecision: 'unknown', adminStatus: 'not_ready', queueForAdmin: false }
  }
  if (eventName === 'inquiry.created') {
    return { personaStatus: 'created', personaDecision: 'unknown', adminStatus: 'not_ready', queueForAdmin: false }
  }
  return null
}
