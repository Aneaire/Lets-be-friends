import { canAccessMemberRoutes } from '@/auth/routeAccess'

describe('mobile route access', () => {
  it('allows app routes only for a completed signed-in session', () => {
    expect(canAccessMemberRoutes('signed_in')).toBe(true)

    for (const status of ['loading', 'signed_out', 'needs_task', 'unconfigured', 'setup_error'] as const) {
      expect(canAccessMemberRoutes(status)).toBe(false)
    }
  })
})
