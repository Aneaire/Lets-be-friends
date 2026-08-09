export const primaryNavigation = [
  { id: 'home', to: '/', label: 'Home' },
  { id: 'discover', to: '/discover', label: 'Explore' },
  { id: 'messages', to: '/messages', label: 'Messages' },
  { id: 'bookings', to: '/app', label: 'Bookings' },
] as const

export type PrimaryNavigationId = (typeof primaryNavigation)[number]['id']

export function activePrimaryNavigation(pathname: string): PrimaryNavigationId | null {
  if (pathname === '/' || pathname === '/social') return 'home'
  if (pathname === '/discover' || pathname === '/nearby' || pathname === '/host-profile') return 'discover'
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
    || pathname === '/host'
    || pathname.startsWith('/host/')
    || pathname === '/nearby'
}
