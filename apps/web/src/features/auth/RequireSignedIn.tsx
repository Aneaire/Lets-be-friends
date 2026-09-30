import { useAuth } from '@clerk/react'
import { Navigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'

/**
 * Keeps member-only routes, including the Home feed, out of reach for
 * signed-out visitors. While Clerk is still resolving the session we render
 * nothing so a reload never flashes the public marketing home.
 */
export function RequireSignedIn({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return null
  if (!isSignedIn) return <Navigate to="/" replace />

  return <>{children}</>
}
