import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { SubmittedReviewView } from './SubmittedReviewView'

type SubmittedReview = NonNullable<ReturnType<typeof useQuery<typeof api.reviews.viewerSubmission>>>

/** Loads the reviewer's own submission for the /review permalink. */
export function SubmittedReviewPage({ reviewId }: { reviewId?: string }) {
  const review = useQuery(
    api.reviews.viewerSubmission,
    reviewId ? { reviewId: reviewId as Id<'reviews'> } : 'skip',
  ) as SubmittedReview | null | undefined
  const toggleLike = useMutation(api.reviews.toggleLike)
  const createComment = useMutation(api.reviews.createComment)
  const deleteComment = useMutation(api.reviews.deleteComment)

  if (!reviewId) {
    return (
      <ReviewShell>
        <div className="empty-state">
          <p className="empty-state-title">Choose a review first.</p>
          <p className="text-meta">Open a completed booking to view the review you submitted.</p>
          <Link to="/app" className="btn btn-neutral btn-sm mt-3">Back to bookings</Link>
        </div>
      </ReviewShell>
    )
  }

  if (review === undefined) {
    return (
      <ReviewShell>
        <div className="empty-state" role="status">Loading your review...</div>
      </ReviewShell>
    )
  }

  if (review === null) {
    return (
      <ReviewShell>
        <div className="empty-state">
          <p className="empty-state-title">This review is not available.</p>
          <p className="text-meta">Reviews can be opened only by the member who submitted them, and only while they are visible.</p>
          <Link to="/app" className="btn btn-neutral btn-sm mt-3">Back to bookings</Link>
        </div>
      </ReviewShell>
    )
  }

  return (
    <SubmittedReviewView
      review={review}
      onLike={() => toggleLike({ reviewId: review._id })}
      onCreateComment={(body) => createComment({ reviewId: review._id, body })}
      onDeleteComment={(commentId) => deleteComment({ commentId: commentId as Id<'reviewComments'> })}
    />
  )
}

function ReviewShell({ children }: { children: ReactNode }) {
  return (
    <main className="review-page">
      <header className="review-page-header">
        <Link to="/app" className="member-profile-back"><ArrowLeft size={15} aria-hidden="true" />Back to bookings</Link>
      </header>
      {children}
    </main>
  )
}
