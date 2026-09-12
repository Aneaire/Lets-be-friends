import { createFileRoute } from '@tanstack/react-router'
import { GatheringsPage } from '../features/gatherings/GatheringsPage'

export const Route = createFileRoute('/gatherings/')({ component: GatheringsIndexRoute })

export function GatheringsIndexRoute() {
  return <GatheringsPage />
}
