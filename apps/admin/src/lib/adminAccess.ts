import { isAdminRole, type UserRole } from '@lets-be-friends/shared'

export type AdminRole = Extract<UserRole, 'admin' | 'reviewer'>

export type AdminRoute =
  | '/overview'
  | '/host-applications'
  | '/booking-verification'
  | '/reports'
  | '/users'
  | '/posts'
  | '/reviews'
  | '/profile'
  | '/categories'
  | '/audit-logs'
  | '/settings'

export type AdminNavItem = {
  to: AdminRoute
  label: string
  countKey?: string
  fullAdminOnly?: boolean
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
      { to: '/booking-verification', label: 'Identity verification', countKey: 'memberVerificationsPending' },
      { to: '/reports', label: 'Reports', countKey: 'reportsOpen' },
    ],
  },
  {
    title: 'Moderation',
    items: [
      { to: '/users', label: 'Users', fullAdminOnly: true },
      { to: '/posts', label: 'Posts' },
      { to: '/reviews', label: 'Reviews' },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/profile', label: 'Profile' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/categories', label: 'Categories' },
      { to: '/audit-logs', label: 'Audit logs', fullAdminOnly: true },
      { to: '/settings', label: 'Settings', fullAdminOnly: true },
    ],
  },
]

export function getAdminNavSections(role: AdminRole): AdminNavSection[] {
  return adminNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => role === 'admin' || !item.fullAdminOnly),
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
