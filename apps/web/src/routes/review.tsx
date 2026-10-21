import { createFileRoute } from '@tanstack/react-router'
import { SubmittedReviewPage } from '../features/review/SubmittedReviewPage'

export const Route = createFileRoute('/review')({
  validateSearch: (search: Record<string, unknown>): { reviewId?: string } => (
    typeof search.reviewId === 'string' ? { reviewId: search.reviewId } : {}
  ),
  component: ReviewRoute,
})

function ReviewRoute() {
  const { reviewId } = Route.useSearch()
  return <SubmittedReviewPage reviewId={reviewId} />
}
