import { createFileRoute, Outlet } from '@tanstack/react-router'
import { RequireSignedIn } from '../features/auth/RequireSignedIn'

export const Route = createFileRoute('/circles')({ component: CircleLayout })

export function CircleLayout() {
  return (
    <RequireSignedIn>
      <Outlet />
    </RequireSignedIn>
  )
}
