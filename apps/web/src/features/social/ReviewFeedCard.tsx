import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Avatar } from '../../design-system/atoms/Avatar'
import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { ReviewContent } from './ReviewContent'
import { ReviewStars } from './ReviewStars'
import { ShareDialog } from './ShareDialog'
import { SocialLightbox } from './SocialLightbox'
import { shareTargetUrl } from './shareLinks'
import { formatSocialTime } from './formatSocialTime'

type FeedItem = NonNullable<FunctionReturnType<typeof api.social.feedPage>>['page'][number]
export type FeedReview = Extract<FeedItem, { kind: 'review' }>['review']

export function ReviewFeedCard({
  review,
  viewerReady,
  onLike,
  onOpen,
  onSave,
  onShareToFeed,
  onShared,
  onCopied,
}: {
  review: FeedReview
  viewerReady: boolean
  onLike: () => void
  onOpen: () => void
  onSave: () => void
  onShareToFeed: (message: string) => Promise<void>
  onShared?: () => void
  onCopied?: () => void
}) {
  const [shareOpen, setShareOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const shareUrl = shareTargetUrl({
    kind: 'review',
    companionProfileId: String(review.companionProfileId ?? ''),
    reviewId: String(review._id),
  })

  return (
    <>
      <PostCard
        author={review.reviewerDisplayName}
        imageUrl={review.reviewerProfileImageUrl}
        timestamp={formatSocialTime(review.createdAt)}
        dateTime={new Date(review.createdAt).toISOString()}
        className="social-review-card"
        aria-label={`Review by ${review.reviewerDisplayName}`}
        avatarAction={
          <Link to="/member-profile" search={{ userId: review.reviewerId }} className="social-post-avatar-link" aria-label={`View ${review.reviewerDisplayName}'s profile`}>
            <Avatar name={review.reviewerDisplayName} src={review.reviewerProfileImageUrl} size="large" className="ds-post-avatar-image" decorative />
          </Link>
        }
        authorAction={
          <Link to="/member-profile" search={{ userId: review.reviewerId }} className="social-post-author-link">{review.reviewerDisplayName}</Link>
        }
        meta={
          <>
            <span aria-hidden="true" className="ds-post-meta-separator">·</span>
            <Link
              to="/companion-profile"
              search={{ companionProfileId: review.companionProfileId, reviewId: review._id }}
              className="social-review-companion"
              onClick={onOpen}
            >
              Shared an experience with {review.companionDisplayName ?? 'this Companion'}
            </Link>
          </>
        }
      >
        <ReviewContent
          rating={review.rating}
          body={review.body}
          imageUrl={review.imageUrl}
          reviewerDisplayName={review.reviewerDisplayName}
          onOpenImage={review.imageUrl ? () => setLightboxOpen(true) : undefined}
        />
        <PostActionBar
          liked={Boolean(review.liked)}
          likeCount={review.likeCount ?? 0}
          commentCount={review.commentCount ?? 0}
          saved={Boolean(review.saved)}
          commentsOpen={false}
          likeDisabled={!viewerReady}
          showSave={viewerReady}
          onLike={onLike}
          onToggleComments={() => {
            if (review.imageUrl) setLightboxOpen(true)
            else onOpen()
          }}
          onSave={onSave}
          onShare={() => setShareOpen(true)}
        />
      </PostCard>
      {lightboxOpen && review.imageUrl && (
        <ReviewLightbox
          review={review}
          viewerReady={viewerReady}
          onClose={() => setLightboxOpen(false)}
          onLike={onLike}
          onSave={onSave}
          onOpenFull={() => { setLightboxOpen(false); onOpen() }}
          onShare={() => setShareOpen(true)}
        />
      )}
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share this review"
        url={shareUrl}
        preview={{
          label: `Review by ${review.reviewerDisplayName}`,
          meta: review.companionDisplayName ? `Experience with ${review.companionDisplayName}` : undefined,
          body: review.body ?? '',
          imageUrl: review.imageUrl,
        }}
        onShareToFeed={onShareToFeed}
        onShared={onShared}
        onCopied={onCopied}
      />
    </>
  )
}

type ReviewLightboxComment = {
  _id: string
  body: string
  authorDisplayName: string
  authorProfileImageUrl?: string | null
  ownComment?: boolean
}

function ReviewLightbox({
  review,
  viewerReady,
  onClose,
  onLike,
  onSave,
  onOpenFull,
  onShare,
}: {
  review: FeedReview
  viewerReady: boolean
  onClose: () => void
  onLike: () => void
  onSave: () => void
  onOpenFull: () => void
  onShare: () => void
}) {
  const [commentDraft, setCommentDraft] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentError, setCommentError] = useState('')
  const detailedReview = useQuery(api.reviews.requested, { reviewId: review._id as Id<'reviews'> }) as
    | { comments?: readonly ReviewLightboxComment[]; commentCount?: number }
    | null
    | undefined
  const createReviewComment = useMutation(api.reviews.createComment)
  const deleteReviewComment = useMutation(api.reviews.deleteComment)
  const reviewComments = detailedReview?.comments ?? []
  const commentCount = detailedReview?.commentCount ?? review.commentCount ?? 0

  if (!review.imageUrl) return null

  return (
    <SocialLightbox
      open
      onClose={onClose}
      title={`Review by ${review.reviewerDisplayName}`}
      media={[{ kind: 'image', url: review.imageUrl, alt: `Photo shared with ${review.reviewerDisplayName}'s review` }]}
      details={(
        <div className="social-lightbox-post">
          <div className="social-lightbox-author">
            <Avatar name={review.reviewerDisplayName} src={review.reviewerProfileImageUrl} size="large" decorative />
            <div className="min-w-0">
              <div className="social-lightbox-author-name"><strong>{review.reviewerDisplayName}</strong></div>
              <time className="text-meta" dateTime={new Date(review.createdAt).toISOString()}>{formatSocialTime(review.createdAt)}</time>
            </div>
          </div>
          <ReviewStars rating={review.rating} showValue />
          {review.body ? <p className="ds-post-copy">{review.body}</p> : null}
          <p className="text-meta">Experience with {review.companionDisplayName ?? 'this Companion'}</p>
          <PostActionBar
            liked={Boolean(review.liked)}
            likeCount={review.likeCount ?? 0}
            commentCount={commentCount}
            saved={Boolean(review.saved)}
            commentsOpen
            likeDisabled={!viewerReady}
            showSave={viewerReady}
            onLike={onLike}
            onToggleComments={onClose}
            onSave={onSave}
            onShare={onShare}
          />
          <div className="social-lightbox-comments">
            {detailedReview === undefined ? (
              <p className="text-meta">Loading comments...</p>
            ) : reviewComments.length === 0 ? (
              <p className="text-meta">No comments yet.</p>
            ) : (
              <div className="social-comment-list">
                {reviewComments.map((comment) => (
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
                            void deleteReviewComment({ commentId: comment._id as Id<'reviewComments'> }).catch((error) => {
                              setCommentError(error instanceof Error ? error.message : 'Comment could not be deleted.')
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
            )}
            {commentError && <p className="text-meta social-comment-error" role="alert">{commentError}</p>}
            {viewerReady && (
              <form
                className="profile-review-comment-form"
                onSubmit={async (event) => {
                  event.preventDefault()
                  const body = commentDraft.trim()
                  if (!body) return
                  setCommentBusy(true)
                  setCommentError('')
                  try {
                    await createReviewComment({ reviewId: review._id as Id<'reviews'>, body })
                    setCommentDraft('')
                  } catch (error) {
                    setCommentError(error instanceof Error ? error.message : 'Comment could not be added.')
                  } finally {
                    setCommentBusy(false)
                  }
                }}
              >
                <input
                  className="field"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.currentTarget.value)}
                  placeholder="Write a comment"
                  aria-label={`Comment on ${review.reviewerDisplayName}'s review`}
                  maxLength={500}
                />
                <button className="btn btn-social-quiet btn-sm" disabled={commentBusy}>Post</button>
              </form>
            )}
            <button type="button" className="btn btn-neutral btn-sm mt-3" onClick={onOpenFull}>
              Open full review
            </button>
          </div>
        </div>
      )}
    />
  )
}
