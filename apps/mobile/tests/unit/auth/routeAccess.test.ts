import { canAccessMemberRoutes, mobileRouteAccess } from '@/auth/routeAccess'

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
})
