export const primaryNavigation = [
  { id: 'home', to: '/social', label: 'Home' },
  { id: 'discover', to: '/discover', label: 'Explore' },
  { id: 'circles', to: '/circles', label: 'Circles' },
  { id: 'gatherings', to: '/gatherings', label: 'Gatherings' },
  { id: 'messages', to: '/messages', label: 'Messages' },
  { id: 'bookings', to: '/app', label: 'Bookings' },
] as const

export type PrimaryNavigationId = (typeof primaryNavigation)[number]['id']

// Sidebar keeps discovery destinations. Messages and Bookings live in the
// signed-in header so the rail stays focused on Home and Explore.
export const sidebarNavigation = [
  ...primaryNavigation.filter((item) => item.id === 'home' || item.id === 'discover'),
  { id: 'circles' as const, to: '/circles' as const, label: 'Circles' },
  { id: 'gatherings' as const, to: '/gatherings' as const, label: 'Gatherings' },
]

export const headerNavigation = primaryNavigation.filter(
  (item) => item.id === 'messages' || item.id === 'bookings',
)

// Mobile bottom tabs stay focused on frequent destinations. Circles and
// Gatherings remain reachable from the desktop rail, Explore, and Home.
export const mobileNavigation = primaryNavigation.filter((item) => item.id !== 'circles' && item.id !== 'gatherings')

export function activePrimaryNavigation(pathname: string): PrimaryNavigationId | null {
  if (pathname === '/' || pathname === '/social') return 'home'
  if (pathname === '/discover' || pathname === '/nearby' || pathname === '/companion-profile') return 'discover'
  if (pathname === '/circles' || pathname.startsWith('/circles/')) return 'circles'
  if (pathname === '/gatherings' || pathname.startsWith('/gatherings/')) return 'gatherings'
  if (pathname === '/messages' || pathname.startsWith('/messages/')) return 'messages'
  if (pathname === '/app' || pathname.startsWith('/app/')) return 'bookings'
  return null
}

export function isWorkspacePath(pathname: string) {
  return pathname === '/app'
    || pathname.startsWith('/app/')
    || pathname === '/profile'
    || pathname.startsWith('/profile/')
    || pathname === '/settings'
    || pathname === '/messages'
    || pathname.startsWith('/messages/')
    || pathname === '/companion'
    || pathname.startsWith('/companion/')
    || pathname === '/wallet'
    || pathname === '/get-verified'
    || pathname === '/nearby'
    || pathname === '/notifications'
    || pathname === '/circles'
    || pathname.startsWith('/circles/')
    || pathname === '/gatherings'
    || pathname.startsWith('/gatherings/')
}
