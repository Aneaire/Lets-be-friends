import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { StoredMention } from '@lets-be-friends/shared'
import { Avatar } from '../../design-system/atoms/Avatar'
import { MentionText } from './MentionText'
import { PostMediaGrid, type DisplayPostMediaItem } from './PostMediaGrid'
import { ReviewContent } from './ReviewContent'
import { formatSocialTime } from './formatSocialTime'

export type SharedPostView = {
  authorId: string
  authorDisplayName: string
  authorProfileImageUrl?: string | null
  authorCompanionProfileId?: string | null
  ownPost?: boolean
  body?: string
  mentions?: StoredMention[]
  media?: readonly DisplayPostMediaItem[]
  createdAt: number
}

export type SharedReviewView = {
  reviewerId: string
  reviewerDisplayName: string
  reviewerProfileImageUrl?: string | null
  companionDisplayName?: string
  rating: number
  body?: string | null
  imageUrl?: string | null
}

function AuthorProfileLink({ post, className, label, children }: {
  post: SharedPostView
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

export function SharedPostEmbed({ post }: { post: SharedPostView }) {
  return (
    <article className="social-shared-embed" aria-label={`Shared post by ${post.authorDisplayName}`}>
      <header className="social-shared-embed-head">
        <AuthorProfileLink post={post} className="social-shared-embed-avatar" label={`View ${post.authorDisplayName}'s profile`}>
          <Avatar name={post.authorDisplayName} src={post.authorProfileImageUrl} size="small" decorative />
        </AuthorProfileLink>
        <div className="social-shared-embed-identity">
          <AuthorProfileLink post={post} className="social-shared-embed-author" label={`View ${post.authorDisplayName}'s profile`}>
            {post.authorDisplayName}
          </AuthorProfileLink>
          <time className="text-meta" dateTime={new Date(post.createdAt).toISOString()}>{formatSocialTime(post.createdAt)}</time>
        </div>
      </header>
      {post.body ? <MentionText body={post.body} mentions={post.mentions} className="social-shared-embed-body" /> : null}
      {post.media?.length ? <PostMediaGrid media={post.media} /> : null}
    </article>
  )
}

export function SharedReviewEmbed({ review }: { review: SharedReviewView }) {
  return (
    <article className="social-shared-embed" aria-label={`Shared review by ${review.reviewerDisplayName}`}>
      <header className="social-shared-embed-head">
        <Link to="/member-profile" search={{ userId: review.reviewerId }} className="social-shared-embed-avatar" aria-label={`View ${review.reviewerDisplayName}'s profile`}>
          <Avatar name={review.reviewerDisplayName} src={review.reviewerProfileImageUrl} size="small" decorative />
        </Link>
        <div className="social-shared-embed-identity">
          <Link to="/member-profile" search={{ userId: review.reviewerId }} className="social-shared-embed-author">{review.reviewerDisplayName}</Link>
          <p className="text-meta">reviewed {review.companionDisplayName ?? 'a Companion'}</p>
        </div>
      </header>
      <ReviewContent
        rating={review.rating}
        body={review.body}
        imageUrl={review.imageUrl}
        reviewerDisplayName={review.reviewerDisplayName}
        bodyClassName="social-shared-embed-body"
        imageWrapperClassName="social-shared-embed-image"
      />
    </article>
  )
}
