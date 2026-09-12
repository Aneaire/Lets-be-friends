import { createFileRoute } from '@tanstack/react-router'
import { GatheringWorkspacePage } from '../features/gatherings/GatheringWorkspacePage'

export const Route = createFileRoute('/gatherings/$gatheringId')({
  component: GatheringRoute,
})

function GatheringRoute() {
  const { gatheringId } = Route.useParams()
  return <GatheringWorkspacePage gatheringId={gatheringId} />
}
