import { createFileRoute } from '@tanstack/react-router'
import { SocialPage } from '../features/social/SocialPage'

export const Route = createFileRoute('/social')({
  validateSearch: (search: Record<string, unknown>): { postId?: string } => typeof search.postId === 'string' ? { postId: search.postId } : {},
  component: SocialRoutePage,
})

function SocialRoutePage() {
  const { postId } = Route.useSearch()
  return <SocialPage postId={postId} />
}
