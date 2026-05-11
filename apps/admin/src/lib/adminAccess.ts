import { isAdminRole, type UserRole } from '@lets-be-friends/shared'

export type AdminRole = Extract<UserRole, 'owner' | 'reviewer'>

export type AdminRoute =
  | '/overview'
  | '/host-applications'
  | '/booking-verification'
  | '/reports'
  | '/users'
  | '/posts'
  | '/reviews'
  | '/categories'
  | '/audit-logs'
  | '/settings'

export type AdminNavItem = {
  to: AdminRoute
  label: string
  countKey?: string
  ownerOnly?: boolean
}

export type AdminNavSection = {
  title: string
  items: AdminNavItem[]
}

const adminNavSections: AdminNavSection[] = [
  {
    title: 'Review',
    items: [
      { to: '/overview', label: 'Overview' },
      { to: '/host-applications', label: 'Host applications', countKey: 'hostApplicationsPending' },
      { to: '/booking-verification', label: 'Booking verification', countKey: 'bookingVerificationsPending' },
      { to: '/reports', label: 'Reports', countKey: 'reportsOpen' },
    ],
  },
  {
    title: 'Moderation',
    items: [
      { to: '/users', label: 'Users', ownerOnly: true },
      { to: '/posts', label: 'Posts' },
      { to: '/reviews', label: 'Reviews' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/categories', label: 'Categories' },
      { to: '/audit-logs', label: 'Audit logs', ownerOnly: true },
      { to: '/settings', label: 'Settings', ownerOnly: true },
    ],
  },
]

export function getAdminNavSections(role: AdminRole): AdminNavSection[] {
  return adminNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => role === 'owner' || !item.ownerOnly),
    }))
    .filter((section) => section.items.length > 0)
}

export type AdminGateState = 'loading' | 'signed_out' | 'sync_profile' | 'denied' | 'allowed'

export function getAdminGateState(input: {
  authLoaded: boolean
  isSignedIn: boolean
  viewer: { role: UserRole; suspended?: boolean } | null | undefined
}): AdminGateState {
  if (!input.authLoaded) return 'loading'
  if (!input.isSignedIn) return 'signed_out'
  if (input.viewer === undefined) return 'loading'
  if (input.viewer === null) return 'sync_profile'
  if (input.viewer.suspended) return 'denied'
  if (!isAdminRole(input.viewer.role)) return 'denied'
  return 'allowed'
}
