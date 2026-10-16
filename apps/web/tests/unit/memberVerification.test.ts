import { describe, expect, it } from 'vitest'
import { canOpenCompanionProfile, identityEntitlementStatus, memberVerificationPresentation } from '../../src/lib/memberVerification'
import { identityRejectionReasons } from '../../convex/identityVerification'

describe('member verification presentation', () => {
  it('prompts a member to start Persona before any attempt exists', () => {
    expect(memberVerificationPresentation('not_started', null)).toMatchObject({
      state: 'not_started',
      label: 'Identity not started',
      tone: 'self',
      action: 'start',
    })
  })

  it('offers to continue an active Persona inquiry', () => {
    expect(memberVerificationPresentation('pending', {
      personaStatus: 'in_progress',
      personaDecision: 'unknown',
      adminStatus: 'not_ready',
    })).toMatchObject({
      state: 'action_required',
      action: 'continue',
    })
  })

  it('keeps access locked while Persona processes the result', () => {
    expect(memberVerificationPresentation('pending', {
      personaStatus: 'processing',
      personaDecision: 'unknown',
      adminStatus: 'not_ready',
    })).toMatchObject({
      state: 'provider_processing',
      action: 'none',
    })
  })

  it('shows the mandatory admin-review state for a Persona pass', () => {
    expect(memberVerificationPresentation('pending', {
      personaStatus: 'completed',
      personaDecision: 'passed',
      adminStatus: 'pending',
    })).toMatchObject({
      state: 'admin_pending',
      label: 'Safety review pending',
      action: 'none',
    })
  })

  it('does not offer an approval path for a Persona decline', () => {
    expect(memberVerificationPresentation('pending', {
      personaStatus: 'completed',
      personaDecision: 'declined',
      adminStatus: 'pending',
    })).toMatchObject({
      state: 'provider_declined',
      action: 'none',
    })
  })

  it('offers a new attempt after an admin rejection', () => {
    expect(memberVerificationPresentation('rejected', {
      personaStatus: 'completed',
      personaDecision: 'declined',
      adminStatus: 'rejected',
    })).toMatchObject({
      state: 'admin_rejected',
      label: 'Not approved',
      action: 'retry',
    })
  })

  it('offers a new attempt when Persona expires or fails', () => {
    expect(memberVerificationPresentation('pending', {
      personaStatus: 'expired',
      personaDecision: 'unknown',
      adminStatus: 'not_ready',
    })).toMatchObject({
      state: 'expired',
      action: 'retry',
    })
  })

  it('uses only the account entitlement to unlock booking', () => {
    expect(memberVerificationPresentation('approved', {
      personaStatus: 'completed',
      personaDecision: 'declined',
      adminStatus: 'rejected',
    })).toMatchObject({
      state: 'approved',
      action: 'none',
    })
    expect(memberVerificationPresentation('not_started', {
      personaStatus: 'completed',
      personaDecision: 'passed',
      adminStatus: 'approved',
    })).toMatchObject({
      state: 'expired',
      label: 'Verification renewal needed',
      action: 'retry',
    })
  })

  it('downgrades legacy or expired approved strings without a current entitlement', () => {
    expect(identityEntitlementStatus('approved', false)).toBe('not_started')
    expect(identityEntitlementStatus('approved', true)).toBe('approved')
  })
})

describe('companion profile gate', () => {
  it('opens for a current approved identity', () => {
    expect(canOpenCompanionProfile(true, null)).toBe(true)
    expect(canOpenCompanionProfile(true, {
      adminStatus: 'not_ready',
      verificationSource: 'in_app',
      identityStage: 'draft',
      isCurrent: true,
      reason: 'member',
    })).toBe(true)
  })

  it('opens for a current identity submitted for safety review', () => {
    expect(canOpenCompanionProfile(false, {
      adminStatus: 'pending',
      verificationSource: 'in_app',
      identityStage: 'ready_for_review',
      isCurrent: true,
      reason: 'member',
    })).toBe(true)
  })

  it('keeps a genuinely ready provider-declined attempt eligible', () => {
    expect(canOpenCompanionProfile(false, {
      adminStatus: 'pending',
      verificationSource: 'in_app',
      identityStage: 'ready_for_review',
      isCurrent: true,
      reason: 'companion_application',
    })).toBe(true)
  })

  it('locks incomplete, processing, expired, and rejected attempts', () => {
    expect(canOpenCompanionProfile(false, null)).toBe(false)
    expect(canOpenCompanionProfile(false, {
      adminStatus: 'not_ready',
      verificationSource: 'in_app',
      identityStage: 'draft',
      isCurrent: true,
      reason: 'member',
    })).toBe(false)
    expect(canOpenCompanionProfile(false, {
      adminStatus: 'not_ready',
      verificationSource: 'in_app',
      identityStage: 'confirmation_required',
      isCurrent: true,
      reason: 'member',
    })).toBe(false)
    expect(canOpenCompanionProfile(false, {
      adminStatus: 'not_ready',
      verificationSource: 'in_app',
      identityStage: 'failed',
      isCurrent: true,
      reason: 'member',
    })).toBe(false)
    expect(canOpenCompanionProfile(false, {
      adminStatus: 'rejected',
      verificationSource: 'in_app',
      identityStage: 'rejected',
      isCurrent: true,
      reason: 'member',
    })).toBe(false)
  })

  it('locks dormant provider attempts, booking reasons, and non-current rows', () => {
    expect(canOpenCompanionProfile(false, {
      adminStatus: 'pending',
      verificationSource: 'persona',
      identityStage: 'ready_for_review',
      isCurrent: true,
      reason: 'member',
    })).toBe(false)
    expect(canOpenCompanionProfile(false, {
      adminStatus: 'pending',
      verificationSource: 'in_app',
      identityStage: 'ready_for_review',
      isCurrent: true,
      reason: 'booking',
    })).toBe(false)
    expect(canOpenCompanionProfile(false, {
      adminStatus: 'pending',
      verificationSource: 'in_app',
      identityStage: 'ready_for_review',
      isCurrent: false,
      reason: 'member',
    })).toBe(false)
  })
})

describe('rejected identity attempts tell the member why', () => {
  it('uses the reviewer reason the member was given', () => {
    expect(memberVerificationPresentation('rejected', {
      adminStatus: 'rejected',
      memberReason: 'expired_id',
    })).toMatchObject({
      state: 'admin_rejected',
      tone: 'danger',
      action: 'retry',
      guidance: expect.stringContaining('has expired'),
    })
    expect(memberVerificationPresentation('rejected', {
      adminStatus: 'rejected',
      memberReason: 'unclear_image',
    })).toMatchObject({ guidance: expect.stringContaining('not clear enough to read') })
    expect(memberVerificationPresentation('rejected', {
      adminStatus: 'rejected',
      memberReason: 'not_accepted_document',
    })).toMatchObject({ guidance: expect.stringContaining('not an accepted government ID') })
    expect(memberVerificationPresentation('rejected', {
      adminStatus: 'rejected',
      memberReason: 'selfie_unclear',
    })).toMatchObject({ guidance: expect.stringContaining('selfie') })
    expect(memberVerificationPresentation('rejected', {
      adminStatus: 'rejected',
      memberReason: 'details_mismatch',
    })).toMatchObject({ guidance: expect.stringContaining('did not match your ID') })
    expect(memberVerificationPresentation('rejected', {
      adminStatus: 'rejected',
      memberReason: 'looks_altered',
    })).toMatchObject({ guidance: expect.stringContaining('genuine') })
  })

  it('falls back to the generic copy for an attempt rejected before reasons existed', () => {
    for (const memberReason of [undefined, null, 'something_unexpected' as never]) {
      expect(memberVerificationPresentation('rejected', { adminStatus: 'rejected', memberReason })).toMatchObject({
        state: 'admin_rejected',
        guidance: 'The safety team did not approve this identity attempt. Start a new identity check if another attempt is available.',
      })
    }
    expect(memberVerificationPresentation('rejected', null)).toMatchObject({ state: 'admin_rejected' })
  })

  it('offers every reason a distinct sentence', () => {
    const guidance = identityRejectionReasons.map((reason) => (
      memberVerificationPresentation('rejected', { adminStatus: 'rejected', memberReason: reason.code }).guidance
    ))
    expect(new Set(guidance).size).toBe(identityRejectionReasons.length)
    for (const line of guidance) expect(line).not.toContain('—')
  })
})
