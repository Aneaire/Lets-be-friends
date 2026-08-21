import { describe, expect, it } from 'vitest'
import { identityEntitlementStatus, memberVerificationPresentation } from '../../src/lib/memberVerification'

describe('member verification presentation', () => {
  it('labels test bypass without claiming a provider approval', () => {
    expect(memberVerificationPresentation('not_started', null, true)).toMatchObject({
      state: 'approved',
      label: 'Test access enabled',
      tone: 'warning',
      action: 'none',
    })
  })

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
