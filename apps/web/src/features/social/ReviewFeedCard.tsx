import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import { Avatar } from '../../design-system/atoms/Avatar'
import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { ReviewContent } from './ReviewContent'
import { ShareDialog } from './ShareDialog'
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
          onToggleComments={onOpen}
          onSave={onSave}
          onShare={() => setShareOpen(true)}
        />
      </PostCard>
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
