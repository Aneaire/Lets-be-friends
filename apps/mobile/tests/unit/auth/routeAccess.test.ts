import { authCallbackDestination, canAccessMemberRoutes, mobileRouteAccess } from '@/auth/routeAccess'

describe('mobile route access', () => {
  it('allows private member routes only for a completed signed-in session', () => {
    expect(canAccessMemberRoutes('signed_in')).toBe(true)

    for (const status of ['loading', 'signed_out', 'needs_task', 'unconfigured', 'setup_error'] as const) {
      expect(canAccessMemberRoutes(status)).toBe(false)
    }
  })

  it('exposes only the auth route without a signed-in session', () => {
    expect(mobileRouteAccess('signed_in')).toBe('member')

    for (const status of ['loading', 'signed_out', 'needs_task', 'unconfigured', 'setup_error'] as const) {
      expect(mobileRouteAccess(status)).toBe('auth_only')
    }
  })

  it('leaves the callback after authentication resolves', () => {
    expect(authCallbackDestination('loading')).toBeNull()
    expect(authCallbackDestination('signed_in')).toBe('/')

    for (const status of ['signed_out', 'needs_task', 'unconfigured', 'setup_error'] as const) {
      expect(authCallbackDestination(status)).toBe('/auth')
    }
  })
})
