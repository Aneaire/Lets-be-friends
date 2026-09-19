import { Star } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import { Avatar } from '../../design-system/atoms/Avatar'
import { OpenableImage } from '../../design-system/molecules/OpenableImage'
import { MentionText } from './MentionText'
import { PostMediaGrid } from './PostMediaGrid'

type FeedItem = NonNullable<FunctionReturnType<typeof api.social.feedPage>>['page'][number]
type FeedPost = Extract<FeedItem, { kind: 'post' }>['post']

export type SharedPostPayload = NonNullable<FeedPost['sharedPost']>
export type SharedReviewPayload = NonNullable<FeedPost['sharedReview']>

function AuthorProfileLink({ post, className, label, children }: {
  post: SharedPostPayload
  className: string
  label: string
  children: ReactNode
}) {
  if (post.ownPost) {
    return <Link to="/profile" className={className} aria-label={label}>{children}</Link>
  }
  if (post.authorCompanionProfileId) {
    return <Link to="/companion-profile" search={{ companionProfileId: post.authorCompanionProfileId }} className={className} aria-label={label}>{children}</Link>
  }
  return <Link to="/member-profile" search={{ userId: post.authorId }} className={className} aria-label={label}>{children}</Link>
}

export function SharedPostEmbed({ post }: { post: SharedPostPayload }) {
  return (
    <article className="social-shared-embed" aria-label={`Shared post by ${post.authorDisplayName}`}>
      <header className="social-shared-embed-head">
        <AuthorProfileLink post={post} className="social-shared-embed-avatar" label={`View ${post.authorDisplayName}'s profile`}>
          <Avatar name={post.authorDisplayName} src={post.authorProfileImageUrl} size="small" decorative />
        </AuthorProfileLink>
        <div>
          <AuthorProfileLink post={post} className="social-shared-embed-author" label={`View ${post.authorDisplayName}'s profile`}>
            {post.authorDisplayName}
          </AuthorProfileLink>
          <time className="text-meta" dateTime={new Date(post.createdAt).toISOString()}>{formatTime(post.createdAt)}</time>
        </div>
      </header>
      {post.body ? <MentionText body={post.body} mentions={post.mentions} className="social-shared-embed-body" /> : null}
      {post.media?.length ? <PostMediaGrid media={post.media} /> : null}
    </article>
  )
}

export function SharedReviewEmbed({ review }: { review: SharedReviewPayload }) {
  return (
    <article className="social-shared-embed" aria-label={`Shared review by ${review.reviewerDisplayName}`}>
      <header className="social-shared-embed-head">
        <Link to="/member-profile" search={{ userId: review.reviewerId }} className="social-shared-embed-avatar" aria-label={`View ${review.reviewerDisplayName}'s profile`}>
          <Avatar name={review.reviewerDisplayName} src={review.reviewerProfileImageUrl} size="small" decorative />
        </Link>
        <div>
          <Link to="/member-profile" search={{ userId: review.reviewerId }} className="social-shared-embed-author">{review.reviewerDisplayName}</Link>
          <p className="text-meta">reviewed {review.companionDisplayName ?? 'a Companion'}</p>
        </div>
      </header>
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
      {review.body ? <p className="social-shared-embed-body">{review.body}</p> : null}
      {review.imageUrl ? (
        <div className="social-shared-embed-image">
          <OpenableImage src={review.imageUrl} alt={`Photo shared with ${review.reviewerDisplayName}'s review`} />
        </div>
      ) : null}
    </article>
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
