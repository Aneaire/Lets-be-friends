import { Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../../design-system/atoms/Avatar'
import { describeConvexError } from '../../lib/convexErrors'
import { formatSocialTime } from '../social/formatSocialTime'
import { PostActionBar } from '../social/PostActionBar'
import { ReviewStars } from '../social/ReviewStars'

export type SubmittedReviewViewModel = {
  _id: string
  reviewerId?: string
  reviewerDisplayName: string
  reviewerProfileImageUrl?: string | null
  createdAt: number
  rating: number
  body?: string
  imageUrl?: string | null
  imageUrls?: readonly string[] | null
  companionDisplayName?: string
  revieweeDisplayName?: string
  likeCount?: number
  liked?: boolean
  saved?: boolean
  commentCount?: number
  comments?: readonly {
    _id: string
    body: string
    authorDisplayName: string
    authorProfileImageUrl?: string | null
    ownComment?: boolean
  }[]
}

/**
 * A focused permalink for a review the viewer published. It mirrors the
 * fullscreen review viewer: the shared photo fills the stage and the review,
 * its actions, and its comments stay in the side panel.
 */
export function SubmittedReviewView({
  review,
  onLike,
  onCreateComment,
  onDeleteComment,
}: {
  review: SubmittedReviewViewModel
  onLike: () => Promise<unknown> | void
  onCreateComment: (body: string) => Promise<unknown>
  onDeleteComment: (commentId: string) => Promise<unknown>
}) {
  const [commentDraft, setCommentDraft] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [imageIndex, setImageIndex] = useState(0)

  const images = review.imageUrls?.length
    ? review.imageUrls
    : review.imageUrl
      ? [review.imageUrl]
      : []
  const boundedIndex = Math.min(imageIndex, Math.max(0, images.length - 1))
  const activeImage = images[boundedIndex]
  const contextLabel = review.companionDisplayName
    ? `Experience with ${review.companionDisplayName}`
    : review.revieweeDisplayName
      ? `Review of ${review.revieweeDisplayName}`
      : 'Submitted review'

  async function submitComment() {
    const body = commentDraft.trim()
    if (!body) return
    setCommentBusy(true)
    setCommentError('')
    try {
      await onCreateComment(body)
      setCommentDraft('')
    } catch (error) {
      setCommentError(error instanceof Error ? describeConvexError(error) : 'Comment could not be added.')
    } finally {
      setCommentBusy(false)
    }
  }

  return (
    <main className="review-page">
      <header className="review-page-header">
        <Link to="/app" className="member-profile-back"><ArrowLeft size={15} aria-hidden="true" />Back to bookings</Link>
        <span className="status-pill" data-tone="success">Review submitted</span>
      </header>

      <section
        className="review-page-panel"
        data-has-media={images.length > 0 ? undefined : 'false'}
        aria-labelledby="review-page-title"
      >
        <h1 id="review-page-title" className="sr-only">Your review</h1>
        {images.length > 0 && (
          <div className="review-page-stage" aria-label="Photo shared with your review">
            {activeImage && (
              <img
                key={activeImage}
                src={activeImage}
                alt={images.length > 1 ? `Photo ${boundedIndex + 1} of ${images.length} shared with your review` : 'Photo shared with your review'}
                className="review-page-media"
              />
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="social-lightbox-nav social-lightbox-prev"
                  aria-label="Show previous photo"
                  onClick={() => setImageIndex((current) => (current - 1 + images.length) % images.length)}
                >
                  <ChevronLeft size={22} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="social-lightbox-nav social-lightbox-next"
                  aria-label="Show next photo"
                  onClick={() => setImageIndex((current) => (current + 1) % images.length)}
                >
                  <ChevronRight size={22} aria-hidden="true" />
                </button>
                <p className="social-lightbox-counter tabular" aria-live="polite">
                  {boundedIndex + 1} of {images.length}
                </p>
              </>
            )}
          </div>
        )}

        <div className="review-page-details">
          <div className="social-lightbox-post">
            <div className="social-lightbox-author">
              {review.reviewerId ? (
                <Link
                  to="/member-profile"
                  search={{ userId: review.reviewerId }}
                  className="social-post-avatar-link"
                  aria-label={`View ${review.reviewerDisplayName}'s profile`}
                >
                  <Avatar name={review.reviewerDisplayName} src={review.reviewerProfileImageUrl} size="large" decorative />
                </Link>
              ) : (
                <Avatar name={review.reviewerDisplayName} src={review.reviewerProfileImageUrl} size="large" decorative />
              )}
              <div className="min-w-0">
                <div className="social-lightbox-author-name"><strong>{review.reviewerDisplayName}</strong></div>
                <time className="text-meta" dateTime={new Date(review.createdAt).toISOString()}>
                  {formatSocialTime(review.createdAt)}
                </time>
              </div>
            </div>
            <ReviewStars rating={review.rating} showValue />
            {review.body && <p className="ds-post-copy">{review.body}</p>}
            <p className="text-meta">{contextLabel}</p>
            <PostActionBar
              liked={Boolean(review.liked)}
              likeCount={review.likeCount ?? 0}
              commentCount={review.commentCount ?? 0}
              saved={Boolean(review.saved)}
              commentsOpen
              likeDisabled={false}
              showSave={false}
              onLike={() => void onLike()}
              onToggleComments={() => undefined}
              onSave={() => undefined}
            />
            <div className="social-lightbox-comments">
              {(review.comments ?? []).length === 0 && <p className="text-meta">No comments yet.</p>}
              <div className="social-comment-list">
                {(review.comments ?? []).map((comment) => (
                  <div key={comment._id} className="profile-review-comment">
                    <Avatar name={comment.authorDisplayName} src={comment.authorProfileImageUrl} size="small" decorative />
                    <div>
                      <strong>{comment.authorDisplayName}</strong>
                      <p>{comment.body}</p>
                      {comment.ownComment && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm profile-review-comment-delete"
                          onClick={() => {
                            setCommentError('')
                            void onDeleteComment(comment._id).catch((error) => {
                              setCommentError(error instanceof Error ? describeConvexError(error) : 'Comment could not be deleted.')
                            })
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {commentError && <p className="text-meta social-comment-error" role="alert">{commentError}</p>}
              <form
                className="profile-review-comment-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void submitComment()
                }}
              >
                <input
                  className="field"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.currentTarget.value)}
                  placeholder="Write a comment"
                  aria-label="Write a comment on your review"
                  maxLength={500}
                  disabled={commentBusy}
                />
                <button className="btn btn-social-quiet btn-sm" disabled={commentBusy || !commentDraft.trim()}>
                  {commentBusy ? 'Posting...' : 'Post'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
