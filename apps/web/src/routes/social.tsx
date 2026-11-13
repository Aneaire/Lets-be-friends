import { createFileRoute } from '@tanstack/react-router'
import { RequireSignedIn } from '../features/auth/RequireSignedIn'
import { SocialPage } from '../features/social/SocialPage'

export const Route = createFileRoute('/social')({
  validateSearch: (search: Record<string, unknown>): { postId?: string; commentId?: string; compose?: string } => ({
    ...(typeof search.postId === 'string' ? { postId: search.postId } : {}),
    ...(typeof search.commentId === 'string' ? { commentId: search.commentId } : {}),
    ...(typeof search.compose === 'string' ? { compose: search.compose } : {}),
  }),
  component: SocialRoutePage,
})

function SocialRoutePage() {
  const { postId, commentId, compose } = Route.useSearch()
  return (
    <RequireSignedIn>
      <SocialPage postId={postId} commentId={commentId} compose={compose} />
    </RequireSignedIn>
  )
}
