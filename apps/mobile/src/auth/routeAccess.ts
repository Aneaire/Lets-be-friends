import type { MobileAuthState } from './MobileAuth'

export function canAccessMemberRoutes(status: MobileAuthState['status']) {
  return status === 'signed_in'
}
