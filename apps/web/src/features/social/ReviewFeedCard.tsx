import { Star } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import { Avatar } from '../../design-system/atoms/Avatar'
import { OpenableImage } from '../../design-system/molecules/OpenableImage'
import { PostActionBar } from './PostActionBar'
import { ShareDialog } from './ShareDialog'
import { shareTargetUrl } from './shareLinks'

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
  const shareUrl = shareTargetUrl({
    kind: 'review',
    companionProfileId: String(review.companionProfileId ?? ''),
    reviewId: String(review._id),
  })

  return (
    <>
      <article className="social-post social-review-card" aria-label={`Review by ${review.reviewerDisplayName}`}>
        <header className="social-post-head">
          <Link to="/member-profile" search={{ userId: review.reviewerId }} className="social-post-avatar-link" aria-label={`View ${review.reviewerDisplayName}'s profile`}>
            <Avatar name={review.reviewerDisplayName} src={review.reviewerProfileImageUrl} size="large" className="ds-post-avatar-image" decorative />
          </Link>
          <div className="social-post-identity">
            <Link to="/member-profile" search={{ userId: review.reviewerId }} className="social-post-author-link">{review.reviewerDisplayName}</Link>
            <div className="social-post-meta">
              <time dateTime={new Date(review.createdAt).toISOString()}>{formatTime(review.createdAt)}</time>
              <span aria-hidden="true" className="ds-post-meta-separator">·</span>
              <Link
                to="/companion-profile"
                search={{ companionProfileId: review.companionProfileId, reviewId: review._id }}
                className="social-review-companion"
                onClick={onOpen}
              >
                Shared an experience with {review.companionDisplayName ?? 'this Companion'}
              </Link>
            </div>
          </div>
        </header>
        <div className="social-post-body">
          <div className="profile-review-stars" aria-label={`${review.rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, index) => {
              const fill = Math.max(0, Math.min(1, review.rating - index))
              return (
                <span key={index} className="profile-review-star" aria-hidden="true">
                  <Star size={18} />
                  <span style={{ width: `${fill * 100}%` }}><Star size={18} fill="currentColor" /></span>
                </span>
              )
            })}
          </div>
          {review.body ? <p className="social-review-body">{review.body}</p> : null}
          {review.imageUrl ? (
            <OpenableImage src={review.imageUrl} alt={`Photo shared with ${review.reviewerDisplayName}'s review`} />
          ) : null}
          <PostActionBar
            liked={Boolean(review.liked)}
            likeCount={review.likeCount ?? 0}
            commentCount={review.commentCount ?? 0}
            saved={Boolean(review.saved)}
            commentsOpen={false}
            likeDisabled={!viewerReady}
            showSave={viewerReady}
            onLike={onLike}
            onToggleComments={onOpen}
            onSave={onSave}
            onShare={() => setShareOpen(true)}
          />
        </div>
      </article>
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

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
