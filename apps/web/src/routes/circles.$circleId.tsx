import { createFileRoute } from '@tanstack/react-router'
import { CircleWorkspacePage } from '../features/circles/CircleWorkspacePage'

export const Route = createFileRoute('/circles/$circleId')({
  validateSearch: (search: Record<string, unknown>): { postId?: string; commentId?: string } => ({
    ...(typeof search.postId === 'string' ? { postId: search.postId } : {}),
    ...(typeof search.commentId === 'string' ? { commentId: search.commentId } : {}),
  }),
  component: CircleRoute,
})

function CircleRoute() {
  const { circleId } = Route.useParams()
  const { postId, commentId } = Route.useSearch()
  return <CircleWorkspacePage circleId={circleId} postId={postId} commentId={commentId} />
}
