import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/circles')({ component: CircleLayout })

export function CircleLayout() {
  return <Outlet />
}
