import { describe, expect, it } from 'vitest'
import {
  canAdminApproveIdentity,
  hasCurrentIdentityApproval,
  hasCurrentPersonaApproval,
  isIdentityReadyForAdminReview,
  isRealPersonaInquiryId,
  personaEventTransition,
  personaLifecycleRank,
} from './identityVerification'
import { personaEventCreatedAt, verifyPersonaSignature } from './http'

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

  it('allows admin approval only for a current, completed, Persona-backed pass or review result', () => {
    const valid = {
      adminStatus: 'pending',
      personaStatus: 'completed',
      personaDecision: 'passed',
      personaInquiryId: 'inq_valid',
      verificationSource: 'persona',
      isCurrent: true,
    } as const
    expect(canAdminApproveIdentity(valid as any)).toBe(true)
    expect(canAdminApproveIdentity({ ...valid, personaDecision: 'needs_review' } as any)).toBe(true)
    expect(canAdminApproveIdentity({ ...valid, personaDecision: 'declined' } as any)).toBe(false)
    expect(canAdminApproveIdentity({ ...valid, personaStatus: 'processing' } as any)).toBe(false)
    expect(canAdminApproveIdentity({ ...valid, verificationSource: 'legacy_manual' } as any)).toBe(false)
    expect(canAdminApproveIdentity({ ...valid, isCurrent: false } as any)).toBe(false)
    expect(isIdentityReadyForAdminReview(valid as any)).toBe(true)
    expect(isIdentityReadyForAdminReview({ ...valid, verificationSource: 'legacy_manual' } as any)).toBe(false)
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

  it('allows test bypass only for an explicitly allowlisted account', () => {
    const previous = process.env.IDENTITY_TEST_BYPASS_USER_IDS
    process.env.IDENTITY_TEST_BYPASS_USER_IDS = 'allowed-user'
    const user = {
      clerkUserId: 'allowed-user',
      verificationStatus: 'not_started',
      identityTestBypass: true,
    }
    try {
      expect(hasCurrentIdentityApproval(user as any)).toBe(true)
      expect(hasCurrentIdentityApproval({ ...user, clerkUserId: 'another-user' } as any)).toBe(false)
      expect(hasCurrentIdentityApproval({ ...user, identityTestBypass: false } as any)).toBe(false)
    } finally {
      if (previous === undefined) delete process.env.IDENTITY_TEST_BYPASS_USER_IDS
      else process.env.IDENTITY_TEST_BYPASS_USER_IDS = previous
    }
  })
})

describe('Persona webhook signatures', () => {
  it('orders webhook delivery by the event timestamp, never inquiry updated-at', () => {
    const event = {
      data: {
        id: 'evt_ordered',
        attributes: {
          name: 'inquiry.approved',
          'created-at': '2026-07-31T07:00:00.000Z',
          payload: { data: { id: 'inq_ordered', attributes: { 'updated-at': '2026-07-31T08:00:00.000Z' } } },
        },
      },
    }
    expect(personaEventCreatedAt(event)).toBe(Date.parse('2026-07-31T07:00:00.000Z'))
    expect(personaEventCreatedAt({ data: { attributes: { payload: event.data.attributes.payload } } })).toBeUndefined()
  })

  it('verifies the raw-body HMAC and rejects stale or altered payloads', async () => {
    const secret = 'webhook-secret'
    const timestamp = 1_700_000_000
    const rawBody = '{"data":{"id":"evt_1"}}'
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`))
    const signature = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    const header = `t=${timestamp},v1=${signature}`

    expect(await verifyPersonaSignature(rawBody, header, secret, 300, timestamp + 10)).toBe(true)
    expect(await verifyPersonaSignature(`${rawBody} `, header, secret, 300, timestamp + 10)).toBe(false)
    expect(await verifyPersonaSignature(rawBody, header, secret, 300, timestamp + 301)).toBe(false)
  })
})
