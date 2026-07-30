export const primaryNavigation = [
  { id: 'home', to: '/', label: 'Home' },
  { id: 'discover', to: '/discover', label: 'Discover' },
  { id: 'bookings', to: '/app', label: 'Bookings' },
  { id: 'hosting', to: '/host', label: 'Hosting' },
] as const

export type PrimaryNavigationId = (typeof primaryNavigation)[number]['id']

export function activePrimaryNavigation(pathname: string): PrimaryNavigationId | null {
  if (pathname === '/' || pathname === '/social') return 'home'
  if (pathname === '/discover' || pathname === '/host-profile') return 'discover'
  if (pathname === '/app' || pathname.startsWith('/app/')) return 'bookings'
  if (pathname === '/host' || pathname.startsWith('/host/')) return 'hosting'
  return null
}

export function isWorkspacePath(pathname: string) {
  return pathname === '/app'
    || pathname.startsWith('/app/')
    || pathname === '/profile'
    || pathname.startsWith('/profile/')
    || pathname === '/host'
    || pathname.startsWith('/host/')
}
