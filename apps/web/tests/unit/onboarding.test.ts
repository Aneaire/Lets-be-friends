import { describe, expect, it } from 'vitest'
import { goalForSkip, onboardingDestination, onboardingGateDecision } from '../../src/lib/onboarding'

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
  termsVersion: '2026-08-13',
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
})

describe('onboarding destinations', () => {
  it('uses the goal-specific destination', () => {
    expect(onboardingDestination('member')).toBe('/discover')
    expect(onboardingDestination('companion')).toBe('/become-companion')
  })

  it('defaults skip to member while preserving a companion choice', () => {
    expect(goalForSkip()).toBe('member')
    expect(goalForSkip('companion')).toBe('companion')
  })
})
