import { describe, expect, it } from 'vitest'
import { deviceLocationErrorMessage, onboardingDestination, onboardingGateDecision } from '../../src/lib/onboarding'
import { currentPolicyVersion } from '@lets-be-friends/shared'

const ready = {
  clerkLoaded: true,
  signedIn: true,
  clerkUserId: 'clerk-current',
  convexLoading: false,
  convexAuthenticated: true,
  pathname: '/discover',
}

const completedViewer = {
  clerkUserId: 'clerk-current',
  username: 'current_friend',
  onboardingCompletedAt: 1,
  approximateLatitude: 10.31,
  approximateLongitude: 123.89,
  approximateLocationConsentedAt: 1,
  termsAcceptedAt: 1,
  termsVersion: currentPolicyVersion,
  privacyPolicyAcceptedAt: 1,
  privacyPolicyVersion: currentPolicyVersion,
  identityConsentAcceptedAt: 1,
  identityConsentVersion: currentPolicyVersion,
}

describe('onboarding gate decisions', () => {
  it('waits for Clerk, loading Convex auth, and the viewer query', () => {
    expect(onboardingGateDecision({ ...ready, clerkLoaded: false, viewer: undefined })).toBe('loading')
    expect(onboardingGateDecision({ ...ready, convexLoading: true, viewer: null })).toBe('loading')
    expect(onboardingGateDecision({ ...ready, viewer: undefined })).toBe('loading')
  })

  it('shows a recoverable error when Convex auth settles unauthenticated', () => {
    expect(onboardingGateDecision({ ...ready, convexAuthenticated: false, viewer: undefined })).toBe('auth_error')
  })

  it('allows signed-out public routes without provisioning', () => {
    expect(onboardingGateDecision({ ...ready, signedIn: false, convexAuthenticated: false, viewer: null })).toBe('allow')
  })

  it('provisions an authenticated identity with no viewer', () => {
    expect(onboardingGateDecision({ ...ready, viewer: null })).toBe('provision')
  })

  it('blocks a viewer returned for another Clerk identity', () => {
    expect(onboardingGateDecision({ ...ready, viewer: { clerkUserId: 'clerk-previous' } })).toBe('identity_mismatch')
  })

  it('redirects a matching incomplete viewer to onboarding', () => {
    expect(onboardingGateDecision({ ...ready, viewer: { clerkUserId: 'clerk-current' } })).toBe('redirect_onboarding')
  })

  it('lets a matching incomplete viewer remain on onboarding', () => {
    expect(onboardingGateDecision({ ...ready, pathname: '/onboarding', viewer: { clerkUserId: 'clerk-current' } })).toBe('allow')
  })

  it('lets matching completed viewers revisit onboarding', () => {
    expect(onboardingGateDecision({
      ...ready,
      pathname: '/onboarding',
      viewer: completedViewer,
    })).toBe('allow')
  })

  it('keeps the dedicated legal pages public for every gate state', () => {
    for (const pathname of ['/terms-and-conditions', '/privacy-policy', '/privacy-policy/']) {
      expect(onboardingGateDecision({ ...ready, signedIn: false, convexAuthenticated: false, viewer: null, pathname })).toBe('allow')
      expect(onboardingGateDecision({ ...ready, viewer: { clerkUserId: 'clerk-current' }, pathname })).toBe('allow')
      expect(onboardingGateDecision({ ...ready, viewer: undefined, pathname })).toBe('allow')
      expect(onboardingGateDecision({ ...ready, viewer: null, pathname })).toBe('allow')
      expect(onboardingGateDecision({ ...ready, clerkLoaded: false, viewer: undefined, pathname })).toBe('allow')
      expect(onboardingGateDecision({ ...ready, convexAuthenticated: false, viewer: undefined, pathname })).toBe('allow')
    }
  })

  it('still gates app paths while legal pages stay public', () => {
    expect(onboardingGateDecision({ ...ready, viewer: { clerkUserId: 'clerk-current' }, pathname: '/nearby' })).toBe('redirect_onboarding')
    expect(onboardingGateDecision({ ...ready, viewer: { clerkUserId: 'clerk-current' }, pathname: '/terms-and-conditions/extra' })).toBe('redirect_onboarding')
    expect(onboardingGateDecision({ ...ready, viewer: completedViewer, pathname: '/nearby' })).toBe('allow')
  })

  it('requires completed legacy viewers without the current required fields to return to onboarding', () => {
    expect(onboardingGateDecision({
      ...ready,
      viewer: { clerkUserId: 'clerk-current', onboardingCompletedAt: 1 },
    })).toBe('redirect_onboarding')
    expect(onboardingGateDecision({
      ...ready,
      viewer: { clerkUserId: 'clerk-current', username: 'current_friend', onboardingCompletedAt: 1 },
    })).toBe('redirect_onboarding')
    expect(onboardingGateDecision({ ...ready, viewer: completedViewer })).toBe('allow')
    expect(onboardingGateDecision({
      ...ready,
      viewer: { ...completedViewer, approximateLatitude: 10.315699 },
    })).toBe('redirect_onboarding')
  })

  it('routes legacy general Terms acceptance back to onboarding for the new unified scope', () => {
    expect(onboardingGateDecision({
      ...ready,
      viewer: {
        clerkUserId: 'clerk-current',
        username: 'current_friend',
        onboardingCompletedAt: 1,
        approximateLatitude: 10.31,
        approximateLongitude: 123.89,
        approximateLocationConsentedAt: 1,
        termsAcceptedAt: 1,
        termsVersion: '2026-08-13',
      },
    })).toBe('redirect_onboarding')
    expect(onboardingGateDecision({
      ...ready,
      viewer: {
        ...completedViewer,
        privacyPolicyVersion: '2026-08-13',
      },
    })).toBe('redirect_onboarding')
  })

  it('routes the old 730 day policy scope back to onboarding instead of grandfathering it', () => {
    expect(onboardingGateDecision({
      ...ready,
      viewer: { ...completedViewer, termsVersion: '2026-10-17' },
    })).toBe('redirect_onboarding')
    expect(onboardingGateDecision({
      ...ready,
      viewer: { ...completedViewer, privacyPolicyVersion: '2026-10-17' },
    })).toBe('redirect_onboarding')
    expect(onboardingGateDecision({
      ...ready,
      viewer: { ...completedViewer, identityConsentVersion: '2026-10-17' },
    })).toBe('redirect_onboarding')
    expect(onboardingGateDecision({ ...ready, viewer: completedViewer })).toBe('allow')
  })
})

describe('onboarding destinations', () => {
  it('uses the goal-specific destination', () => {
    expect(onboardingDestination('member')).toBe('/nearby')
    expect(onboardingDestination('companion')).toBe('/companion')
  })


})

describe('onboarding device location errors', () => {
  it('explains each failure without offering a manual pin fallback', () => {
    expect(deviceLocationErrorMessage(1)).toContain('browser site settings')
    expect(deviceLocationErrorMessage(2)).toContain('could not determine your location')
    expect(deviceLocationErrorMessage(3)).toContain('timed out')
    expect(deviceLocationErrorMessage(99)).toContain('could not be read')
  })

  it('never directs users to place a pin', () => {
    for (const code of [1, 2, 3, 99]) {
      expect(deviceLocationErrorMessage(code)).not.toMatch(/pin/i)
    }
  })
})
