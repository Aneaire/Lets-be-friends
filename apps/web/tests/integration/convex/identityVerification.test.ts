import { describe, expect, it } from 'vitest'
import {
  ageOn,
  canAdminApproveIdentity,
  endOfManilaDay,
  hasCurrentIdentityApproval,
  hasCurrentPersonaApproval,
  identityApprovalExpiresAt,
  identityApprovalTtlDays,
  isExpiringIdType,
  isIdentityExpired,
  isIdentityReadyForAdminReview,
  isRealPersonaInquiryId,
  parseIdentityDate,
  personaEventTransition,
  personaLifecycleRank,
  todayInManila,
  validateIdentityFields,
} from '../../../convex/identityVerification'

describe('identity verification policy helpers', () => {
  it('accepts only real Persona inquiry identifiers', () => {
    expect(isRealPersonaInquiryId('inq_abc123')).toBe(true)
    expect(isRealPersonaInquiryId('persona_dummy_companion_123')).toBe(false)
    expect(isRealPersonaInquiryId(undefined)).toBe(false)
  })

  it('queues every completed Persona decision while keeping incomplete expiration retryable', () => {
    expect(personaEventTransition('inquiry.approved')).toMatchObject({ personaDecision: 'passed', adminStatus: 'pending' })
    expect(personaEventTransition('inquiry.marked-for-review')).toMatchObject({ personaDecision: 'needs_review', adminStatus: 'pending' })
    expect(personaEventTransition('inquiry.declined')).toMatchObject({ personaDecision: 'declined', adminStatus: 'pending' })
    expect(personaEventTransition('inquiry.failed')).toMatchObject({ personaStatus: 'failed', personaDecision: 'declined', adminStatus: 'pending' })
    expect(personaEventTransition('inquiry.expired')).toMatchObject({ personaStatus: 'expired', adminStatus: 'not_ready', queueForAdmin: false })
    expect(personaEventTransition('inquiry.completed')).toMatchObject({ personaStatus: 'processing', adminStatus: 'not_ready' })
  })

  it('orders Persona lifecycle states monotonically', () => {
    expect(personaLifecycleRank('created')).toBeLessThan(personaLifecycleRank('in_progress'))
    expect(personaLifecycleRank('in_progress')).toBeLessThan(personaLifecycleRank('processing'))
    expect(personaLifecycleRank('processing')).toBeLessThan(personaLifecycleRank('completed'))
    expect(personaLifecycleRank('completed')).toBe(personaLifecycleRank('rejected'))
  })

  it('allows admin approval only for a current in-app record that passes policy', () => {
    const valid = {
      adminStatus: 'pending',
      personaStatus: 'not_started',
      personaDecision: 'unknown',
      personaInquiryId: undefined,
      verificationSource: 'in_app',
      identityStage: 'ready_for_review',
      isCurrent: true,
      reason: 'member',
    } as const
    const record = {
      stage: 'ready_for_review',
      fieldsConfirmedAt: 100,
      fullLegalName: 'Test Member',
      dateOfBirth: '1990-01-01',
      idType: 'national_id',
      expirationDate: undefined,
    } as const
    expect(canAdminApproveIdentity(valid as any, record as any)).toBe(true)
    expect(canAdminApproveIdentity({ ...valid, verificationSource: 'persona' } as any, record as any)).toBe(false)
    expect(canAdminApproveIdentity({ ...valid, reason: 'booking' } as any, record as any)).toBe(false)
    expect(canAdminApproveIdentity(valid as any, { ...record, stage: 'confirmation_required' } as any)).toBe(false)
    expect(canAdminApproveIdentity(valid as any, { ...record, fieldsConfirmedAt: undefined } as any)).toBe(false)
    expect(canAdminApproveIdentity(valid as any, { ...record, fullLegalName: ' ' } as any)).toBe(false)
    expect(canAdminApproveIdentity(valid as any, { ...record, dateOfBirth: '2012-01-01' } as any)).toBe(false)
    expect(canAdminApproveIdentity(valid as any, { ...record, idType: 'passport', expirationDate: undefined } as any)).toBe(false)
    expect(canAdminApproveIdentity(valid as any, null)).toBe(false)
    expect(isIdentityReadyForAdminReview(valid as any)).toBe(true)
    expect(isIdentityReadyForAdminReview({ ...valid, verificationSource: 'legacy_manual' } as any)).toBe(false)
    expect(isIdentityReadyForAdminReview({ ...valid, isCurrent: false } as any)).toBe(false)
  })

  it('requires current Persona provenance and an unexpired entitlement', () => {
    const now = 10_000
    const valid = {
      verificationStatus: 'approved',
      verificationSource: 'persona',
      identityVerifiedAt: 5_000,
      identityExpiresAt: 15_000,
    } as const
    expect(hasCurrentPersonaApproval(valid as any, now)).toBe(true)
    expect(hasCurrentPersonaApproval({ ...valid, verificationSource: 'legacy_manual' } as any, now)).toBe(false)
    expect(hasCurrentPersonaApproval({ ...valid, identityExpiresAt: 9_999 } as any, now)).toBe(false)
    expect(hasCurrentPersonaApproval({ ...valid, identityVerifiedAt: undefined } as any, now)).toBe(false)
  })

  it('does not treat a legacy test bypass field as identity approval', () => {
    const user = {
      verificationStatus: 'not_started',
      identityTestBypass: true,
    }
    expect(hasCurrentIdentityApproval(user as any)).toBe(false)
  })
})

describe('identity policy date helpers', () => {
  it('parses strict calendar dates and rejects malformed or impossible values', () => {
    expect(parseIdentityDate('1990-02-28')).not.toBeNull()
    expect(parseIdentityDate('1990-02-30')).toBeNull()
    expect(parseIdentityDate('1990-13-01')).toBeNull()
    expect(parseIdentityDate('1990-00-10')).toBeNull()
    expect(parseIdentityDate('90-02-28')).toBeNull()
    expect(parseIdentityDate('1990/02/28')).toBeNull()
    expect(parseIdentityDate(undefined)).toBeNull()
    expect(parseIdentityDate('2024-02-29')).not.toBeNull()
    expect(parseIdentityDate('2023-02-29')).toBeNull()
  })

  it('computes whole calendar years for age', () => {
    expect(ageOn('2000-01-01', '2018-01-01')).toBe(18)
    expect(ageOn('2000-01-01', '2017-12-31')).toBe(17)
    expect(ageOn('2000-12-31', '2018-12-31')).toBe(18)
    expect(ageOn('2000-12-31', '2018-12-30')).toBe(17)
    expect(ageOn('not-a-date', '2018-01-01')).toBeNull()
  })

  it('reports the Manila calendar day as YYYY-MM-DD', () => {
    expect(todayInManila(Date.parse('2026-08-21T03:00:00Z'))).toBe('2026-08-21')
    // 2026-08-20 18:00Z is still 2026-08-21 in Manila (UTC+8).
    expect(todayInManila(Date.parse('2026-08-20T18:00:00Z'))).toBe('2026-08-21')
  })

  it('treats the printed expiration day as still valid and rejects later days', () => {
    expect(isIdentityExpired('2026-08-21', '2026-08-21')).toBe(false)
    expect(isIdentityExpired('2026-08-21', '2026-08-22')).toBe(true)
    expect(isIdentityExpired('2026-08-21', '2026-08-20')).toBe(false)
  })
})

describe('identity policy field validation', () => {
  it('enforces age 18 and rejects underage members', () => {
    const today = '2026-08-21'
    expect(validateIdentityFields({ dateOfBirth: '2008-08-22', idType: 'national_id', today }).ok).toBe(false)
    expect(validateIdentityFields({ dateOfBirth: '2008-08-21', idType: 'national_id', today }).ok).toBe(true)
    expect(validateIdentityFields({ dateOfBirth: '2008-01-01', idType: 'national_id', today }).ok).toBe(true)
    expect(validateIdentityFields({ dateOfBirth: '2008-12-31', idType: 'national_id', today }).ok).toBe(false)
  })

  it('rejects invalid or impossible birth dates', () => {
    expect(validateIdentityFields({ dateOfBirth: '1990-02-30', idType: 'national_id' }).ok).toBe(false)
    expect(validateIdentityFields({ dateOfBirth: 'not-a-date', idType: 'national_id' }).ok).toBe(false)
  })

  it('requires an expiration date for expiring ID types', () => {
    expect(validateIdentityFields({ dateOfBirth: '1990-01-01', idType: 'passport' }).ok).toBe(false)
    expect(validateIdentityFields({ dateOfBirth: '1990-01-01', idType: 'drivers_license' }).ok).toBe(false)
    expect(validateIdentityFields({ dateOfBirth: '1990-01-01', idType: 'residence_permit' }).ok).toBe(false)
    expect(validateIdentityFields({ dateOfBirth: '1990-01-01', idType: 'national_id' }).ok).toBe(true)
    expect(validateIdentityFields({ dateOfBirth: '1990-01-01', idType: 'other_government_id' }).ok).toBe(true)
  })

  it('rejects an expired ID and accepts a future or same-day expiration', () => {
    const today = '2026-08-21'
    expect(validateIdentityFields({ dateOfBirth: '1990-01-01', idType: 'passport', expirationDate: '2026-08-20', today }).ok).toBe(false)
    expect(validateIdentityFields({ dateOfBirth: '1990-01-01', idType: 'passport', expirationDate: '2026-08-21', today }).ok).toBe(true)
    expect(validateIdentityFields({ dateOfBirth: '1990-01-01', idType: 'passport', expirationDate: '2030-01-01', today }).ok).toBe(true)
    expect(validateIdentityFields({ dateOfBirth: '1990-01-01', idType: 'passport', expirationDate: '2026-13-01', today }).ok).toBe(false)
  })

  it('flags expiring ID types', () => {
    expect(isExpiringIdType('passport')).toBe(true)
    expect(isExpiringIdType('drivers_license')).toBe(true)
    expect(isExpiringIdType('residence_permit')).toBe(true)
    expect(isExpiringIdType('national_id')).toBe(false)
    expect(isExpiringIdType('other_government_id')).toBe(false)
  })

  it('resolves the approval TTL with preferred, fallback, and default precedence', () => {
    const previousPreferred = process.env.IDENTITY_APPROVAL_TTL_DAYS
    const previousFallback = process.env.PERSONA_VERIFICATION_TTL_DAYS
    try {
      process.env.IDENTITY_APPROVAL_TTL_DAYS = '365'
      process.env.PERSONA_VERIFICATION_TTL_DAYS = '200'
      expect(identityApprovalTtlDays()).toBe(365)
      delete process.env.IDENTITY_APPROVAL_TTL_DAYS
      expect(identityApprovalTtlDays()).toBe(200)
      delete process.env.PERSONA_VERIFICATION_TTL_DAYS
      expect(identityApprovalTtlDays()).toBe(730)
      process.env.IDENTITY_APPROVAL_TTL_DAYS = '0'
      expect(identityApprovalTtlDays()).toBe(730)
    } finally {
      if (previousPreferred === undefined) delete process.env.IDENTITY_APPROVAL_TTL_DAYS
      else process.env.IDENTITY_APPROVAL_TTL_DAYS = previousPreferred
      if (previousFallback === undefined) delete process.env.PERSONA_VERIFICATION_TTL_DAYS
      else process.env.PERSONA_VERIFICATION_TTL_DAYS = previousFallback
    }
  })

  it('caps approval expiry at the printed ID expiration day', () => {
    expect(endOfManilaDay('2026-08-31')).toBe(Date.parse('2026-08-31T15:59:59.999Z'))
    const previous = process.env.IDENTITY_APPROVAL_TTL_DAYS
    try {
      process.env.IDENTITY_APPROVAL_TTL_DAYS = '730'
      const now = Date.parse('2026-01-01T00:00:00Z')
      const capped = identityApprovalExpiresAt(now, '2026-06-01')
      expect(capped).toBe(Date.parse('2026-06-01T15:59:59.999Z'))
      const uncapped = identityApprovalExpiresAt(now, undefined)
      expect(uncapped).toBe(now + 730 * 24 * 60 * 60 * 1000)
    } finally {
      if (previous === undefined) delete process.env.IDENTITY_APPROVAL_TTL_DAYS
      else process.env.IDENTITY_APPROVAL_TTL_DAYS = previous
    }
  })
})
