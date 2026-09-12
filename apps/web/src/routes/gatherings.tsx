import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/gatherings')({ component: GatheringLayout })

export function GatheringLayout() {
  return <Outlet />
}
