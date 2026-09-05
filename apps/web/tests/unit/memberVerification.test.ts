import { describe, expect, it } from 'vitest'
import { canOpenCompanionProfile, identityEntitlementStatus, memberVerificationPresentation } from '../../src/lib/memberVerification'

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
