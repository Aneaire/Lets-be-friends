import { canOpenCompanionProfile, mobileIdentityPresentation } from '@/features/verification/identityPresentation'
import { getVerifiedModel } from '@/features/verification/getVerifiedModel'
import { verificationNudge, fullyVerifiedAccount } from '@/features/verification/verificationNudge'
import { verificationActionFor } from '@/member/profileSections'
import { onboardingIdentityPresentation } from '@/features/verification/onboardingIdentityPresentation'
import { buildAccountSheetItems } from '@/features/account/accountSheet'

const ready = { adminStatus: 'pending', isCurrent: true, verificationSource: 'in_app', identityStage: 'ready_for_review', reason: 'companion_application' }

describe('Companion identity gate', () => {
  it('unlocks current approval and current in-app safety submissions only', () => {
    expect(canOpenCompanionProfile(true, null)).toBe(true)
    expect(canOpenCompanionProfile(false, ready)).toBe(true)
    for (const patch of [{ isCurrent: false }, { isCurrent: undefined }, { reason: 'booking' }, { identityStage: 'draft' }, { identityStage: 'extracting' }, { adminStatus: 'rejected' }, { verificationSource: 'persona' }, { verificationSource: undefined }]) {
      expect(canOpenCompanionProfile(false, { ...ready, ...patch })).toBe(false)
    }
    expect(canOpenCompanionProfile(false, null)).toBe(false)
  })
})

describe('shared mobile identity presentation and verification steps', () => {
  it.each([
    [null, 'not_started', 'start', false],
    [{ identityStage: 'draft' }, 'action_required', 'continue', false],
    [{ personaStatus: 'created' }, 'action_required', 'continue', false],
    [{ personaStatus: 'failed' }, 'expired', 'retry', false],
    [{ adminStatus: 'approved' }, 'expired', 'retry', false],
    [ready, 'admin_pending', 'none', true],
    [{ adminStatus: 'pending', personaDecision: 'declined' }, 'provider_declined', 'none', false],
    [{ personaStatus: 'processing' }, 'provider_processing', 'none', false],
    [{ adminStatus: 'rejected' }, 'admin_rejected', 'retry', false],
  ])('maps %j to %s and %s', (verification, state, action, unlocked) => {
    const model = getVerifiedModel({ verificationStatus: 'not_started', identityEligible: false, verification })
    expect(model.identity.state).toBe(state)
    expect(model.identity.action).toBe(action)
    expect(model.companionUnlocked).toBe(unlocked)
    expect(model.completedSteps).toBe(0)
  })
  it('counts approval and saved profile independently', () => {
    const model = getVerifiedModel({ verificationStatus: 'approved', identityEligible: true, verification: null, applicationStatus: 'approved' })
    expect(model.completedSteps).toBe(2)
    expect(model.identity.action).toBe('none')
    expect(model.companionLabel).toBe('Profile saved')
    expect(getVerifiedModel({ verificationStatus: 'approved', identityEligible: false, verification: { adminStatus: 'approved' }, applicationStatus: 'approved' }).completedSteps).toBe(1)
  })
  it.each([['pending_review', 'Saved'], ['rejected', 'Needs changes'], ['suspended', 'Suspended'], ['draft', 'Not started']])('labels %s', (status, label) => {
    expect(getVerifiedModel({ verificationStatus: 'not_started', identityEligible: false, verification: null, applicationStatus: status }).companionLabel).toBe(label)
  })
  it('renews expired approval across profile and onboarding', () => {
    expect(verificationActionFor('approved', { adminStatus: 'approved' }, false)).toBe('retry')
    expect(onboardingIdentityPresentation({ verificationStatus: 'approved', verification: { adminStatus: 'approved' }, identityEligible: false })).toMatchObject({ approved: false, action: 'retry', finishActionLabel: 'Start a new identity check' })
    expect(mobileIdentityPresentation('approved', { adminStatus: 'approved' }, false).label).toBe('Verification renewal needed')
  })
})

describe('verification navigation nudge', () => {
  it.each([false, true])('highlights identity before approval (%s)', eligible => {
    const row = buildAccountSheetItems({ identityEligible: eligible, hasCompanionContext: false }).find(item => item.id === 'verification')
    expect(row).toMatchObject({ highlight: true, label: eligible ? 'Unlock earnings' : 'Verify identity', route: { pathname: eligible ? '/companion' : '/get-verified' } })
  })
  it('goes quiet only after identity approval and a saved Companion profile', () => {
    for (const status of ['approved', 'pending_review', 'rejected', 'suspended'] as const) {
      expect(verificationNudge({ state: 'approved' }, status)).toEqual({ highlight: false, label: 'Verified' })
      expect(fullyVerifiedAccount({ state: 'approved' }, status)).toBe(true)
    }
    expect(verificationNudge({ state: 'approved' }, 'draft').label).toBe('Unlock earnings')
    expect(fullyVerifiedAccount({ state: 'expired' }, 'approved')).toBe(false)
  })
})
