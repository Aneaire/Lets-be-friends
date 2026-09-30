import { createFileRoute } from '@tanstack/react-router'
import { RequireSignedIn } from '../features/auth/RequireSignedIn'
import { SocialPage } from '../features/social/SocialPage'

export const Route = createFileRoute('/social')({
  validateSearch: (search: Record<string, unknown>): { postId?: string; commentId?: string } => ({
    ...(typeof search.postId === 'string' ? { postId: search.postId } : {}),
    ...(typeof search.commentId === 'string' ? { commentId: search.commentId } : {}),
  }),
  component: SocialRoutePage,
})

function SocialRoutePage() {
  const { postId, commentId } = Route.useSearch()
  return (
    <RequireSignedIn>
      <SocialPage postId={postId} commentId={commentId} />
    </RequireSignedIn>
  )
}
