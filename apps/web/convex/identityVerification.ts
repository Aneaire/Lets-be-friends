import type { Doc } from './_generated/dataModel'

export const identityVerificationReasons = ['member', 'booking', 'companion_application', 'reverification'] as const

export const identityDocumentTypes = ['passport', 'drivers_license', 'national_id', 'residence_permit', 'other_government_id'] as const
export type IdentityDocumentType = typeof identityDocumentTypes[number]

const DAY_MS = 24 * 60 * 60 * 1_000

// These ID types always carry a printed expiration date.
const expiringIdTypes = new Set<IdentityDocumentType>(['passport', 'drivers_license', 'residence_permit'])

export function isExpiringIdType(idType: IdentityDocumentType) {
  return expiringIdTypes.has(idType)
}

// Parses a strict YYYY-MM-DD calendar date. Returns null for malformed or
// impossible dates such as 2026-02-30 or 2026-13-01.
export function parseIdentityDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null
  return date
}

// The calendar day in Asia/Manila as a YYYY-MM-DD string. Age and ID expiry
// boundaries are evaluated against the member's calendar day in Manila.
export function todayInManila(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// Whole calendar years elapsed between a birth date and a reference day.
export function ageOn(dateOfBirth: string, today: string): number | null {
  const birth = parseIdentityDate(dateOfBirth)
  if (!birth) return null
  const reference = parseIdentityDate(today)
  if (!reference) return null
  let age = reference.getUTCFullYear() - birth.getUTCFullYear()
  const beforeBirthday = reference.getUTCMonth() < birth.getUTCMonth()
    || (reference.getUTCMonth() === birth.getUTCMonth() && reference.getUTCDate() < birth.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}

// The printed expiration day is inclusive: an ID is expired only once the
// Manila calendar day is strictly after the printed expiration date.
export function isIdentityExpired(expirationDate: string, today: string) {
  return today > expirationDate
}

export type IdentityPolicyViolation = {
  ok: true
} | {
  ok: false
  error: string
}

export function validateIdentityFields(input: {
  dateOfBirth: string
  idType: IdentityDocumentType
  expirationDate?: string
  today?: string
}): IdentityPolicyViolation {
  const today = input.today ?? todayInManila()
  const birth = parseIdentityDate(input.dateOfBirth)
  if (!birth) return { ok: false, error: 'Date of birth must be a valid date' }
  const age = ageOn(input.dateOfBirth, today)
  if (age === null) return { ok: false, error: 'Date of birth must be a valid date' }
  if (age < 18) return { ok: false, error: 'You must be at least 18 years old to verify your identity' }

  const expirationDate = input.expirationDate?.trim()
  if (expirationDate) {
    if (!parseIdentityDate(expirationDate)) return { ok: false, error: 'Expiration date must be a valid date' }
    if (isIdentityExpired(expirationDate, today)) {
      return { ok: false, error: 'This ID is expired. Use a current government ID.' }
    }
  } else if (isExpiringIdType(input.idType)) {
    return { ok: false, error: 'This ID type requires an expiration date' }
  }
  return { ok: true }
}

export function identityApprovalTtlDays(): number {
  const preferred = Number(process.env.IDENTITY_APPROVAL_TTL_DAYS)
  if (Number.isFinite(preferred) && preferred > 0) return preferred
  const fallback = Number(process.env.PERSONA_VERIFICATION_TTL_DAYS)
  if (Number.isFinite(fallback) && fallback > 0) return fallback
  return 730
}

// End of the printed expiration day (23:59:59.999) in Asia/Manila, as a
// millisecond timestamp, or null when the date is not a valid calendar date.
export function endOfManilaDay(expirationDate: string): number | null {
  const date = parseIdentityDate(expirationDate)
  if (!date) return null
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  // Manila is UTC+8: the next UTC midnight minus the offset is this Manila day's end.
  return Date.UTC(year, month, day + 1) - 8 * 60 * 60 * 1_000 - 1
}

// Approval entitlement expiry: the default TTL, capped at the printed ID
// expiration day when one is present.
export function identityApprovalExpiresAt(now: number, expirationDate?: string): number {
  const defaultExpiry = now + identityApprovalTtlDays() * DAY_MS
  const capped = expirationDate?.trim() ? endOfManilaDay(expirationDate.trim()) : null
  if (capped === null) return defaultExpiry
  return Math.min(defaultExpiry, capped)
}

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
  request: Pick<Doc<'verificationRequests'>, 'adminStatus' | 'personaStatus' | 'personaInquiryId' | 'verificationSource' | 'identityStage' | 'isCurrent' | 'reason'>,
) {
  if (request.adminStatus !== 'pending' || request.isCurrent !== true) return false
  // Booking-linked verification was retired; only member, reverification, and
  // Companion application attempts are actionable.
  if (request.reason === 'booking') return false
  // Persona is dormant and no longer queues rows for admin review.
  if (request.verificationSource === 'in_app') return request.identityStage === 'ready_for_review'
  return false
}

export function canAdminApproveIdentity(
  request: Pick<Doc<'verificationRequests'>, 'adminStatus' | 'personaStatus' | 'personaDecision' | 'personaInquiryId' | 'verificationSource' | 'identityStage' | 'isCurrent' | 'reason'>,
  record?: Pick<Doc<'identityRecords'>, 'stage' | 'fieldsConfirmedAt' | 'fullLegalName' | 'dateOfBirth' | 'idType' | 'expirationDate'> | null,
) {
  if (!isIdentityReadyForAdminReview(request)) return false
  if (request.verificationSource === 'in_app') {
    if (!record) return false
    if (record.stage !== 'ready_for_review') return false
    if (!record.fieldsConfirmedAt || !record.fullLegalName?.trim() || !record.dateOfBirth || !record.idType) return false
    if (validateIdentityFields({ dateOfBirth: record.dateOfBirth, idType: record.idType, expirationDate: record.expirationDate }).ok !== true) return false
    return true
  }
  return false
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
