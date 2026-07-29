import { describe, expect, it } from 'vitest'
import { goalForSkip, onboardingDestination, onboardingGateDecision } from './onboarding'

const ready = {
  clerkLoaded: true,
  signedIn: true,
  clerkUserId: 'clerk-current',
  convexLoading: false,
  convexAuthenticated: true,
  pathname: '/discover',
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
      viewer: { clerkUserId: 'clerk-current', onboardingCompletedAt: 1 },
    })).toBe('allow')
  })
})

describe('onboarding destinations', () => {
  it('uses the goal-specific destination', () => {
    expect(onboardingDestination('member')).toBe('/discover')
    expect(onboardingDestination('friend_host')).toBe('/become-host')
  })

  it('defaults skip to member while preserving a host choice', () => {
    expect(goalForSkip()).toBe('member')
    expect(goalForSkip('friend_host')).toBe('friend_host')
  })
})
