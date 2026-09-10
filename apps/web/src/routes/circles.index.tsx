import { createFileRoute } from '@tanstack/react-router'
import { CircleIndexPage } from '../features/circles/CircleIndexPage'

export const Route = createFileRoute('/circles/')({ component: CircleIndexRoute })

export function CircleIndexRoute() {
  return <CircleIndexPage />
}
