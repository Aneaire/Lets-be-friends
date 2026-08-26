import type { MobileAuthState } from './MobileAuth'

export type MobileRouteAccess = 'auth_only' | 'member'

export function mobileRouteAccess(status: MobileAuthState['status']): MobileRouteAccess {
  return status === 'signed_in' ? 'member' : 'auth_only'
}

export function canAccessMemberRoutes(status: MobileAuthState['status']) {
  return mobileRouteAccess(status) === 'member'
}
