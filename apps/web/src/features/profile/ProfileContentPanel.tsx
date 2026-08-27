import { Link } from '@tanstack/react-router'
import { Heart, MessageCircle, Star } from 'lucide-react'
import { useId, useRef, useState, type ReactNode, type Ref } from 'react'
import { Avatar } from '../../design-system/atoms/Avatar'
import { OpenableImage } from '../../design-system/molecules/OpenableImage'
import { PostMediaGrid, type DisplayPostMediaItem } from '../social/PostMediaGrid'

export type ProfileContentPost = {
  _id: string
  body?: string
  createdAt: number
  media: readonly DisplayPostMediaItem[]
}

export type ProfileContentReview = {
  _id: string
  body?: string
  createdAt: number
  rating: number
  imageUrl?: string | null
  reviewerId?: string
  reviewerDisplayName: string
  reviewerProfileImageUrl?: string | null
  likeCount?: number
  liked?: boolean
  commentCount?: number
  comments?: readonly {
    _id: string
    body: string
    createdAt: number
    authorDisplayName: string
    authorProfileImageUrl?: string | null
  }[]
  saved?: boolean
}

type ContentTab = 'posts' | 'reviews'

export function ProfileContentPanel({
  ownerName,
  posts,
  reviews,
  rating,
  reviewCount,
  postsDescription,
  postsAction,
  emptyPostsDescription = 'This member has not shared a post yet.',
  reviewsDescription = 'Ratings from members after completed plans.',
  unavailableReviewsTitle = 'Reviews are not available for this profile.',
  unavailableReviewsDescription = 'Reviews appear when a member has an approved Companion profile.',
  unavailableReviewsAction,
  emptyReviewsDescription = 'Reviews will appear here after members complete plans together.',
  reviewAction,
  onLikeReview,
  onCommentReview,
  className,
}: {
  ownerName: string
  posts: readonly ProfileContentPost[] | undefined
  reviews: readonly ProfileContentReview[] | undefined | null
  rating?: number
  reviewCount?: number
  postsDescription: string
  postsAction?: ReactNode
  emptyPostsDescription?: string
  reviewsDescription?: string
  unavailableReviewsTitle?: string
  unavailableReviewsDescription?: string
  unavailableReviewsAction?: ReactNode
  emptyReviewsDescription?: string
  reviewAction?: (review: ProfileContentReview) => ReactNode
  onLikeReview?: (review: ProfileContentReview) => Promise<unknown>
  onCommentReview?: (review: ProfileContentReview, body: string) => Promise<unknown>
  className?: string
}) {
  const [selectedTab, setSelectedTab] = useState<ContentTab>('posts')
  const [openComments, setOpenComments] = useState<Set<string>>(() => new Set())
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [commentBusy, setCommentBusy] = useState<string | null>(null)
  const tabId = useId()
  const postsTabRef = useRef<HTMLButtonElement>(null)
  const reviewsTabRef = useRef<HTMLButtonElement>(null)
  const rootClassName = ['profile-content-panel', className].filter(Boolean).join(' ')
  const selectTab = (tab: ContentTab, focus = false) => {
    setSelectedTab(tab)
    if (focus) (tab === 'posts' ? postsTabRef : reviewsTabRef).current?.focus()
  }

  return (
    <section className={rootClassName}>
      <div className="profile-content-tabs" role="tablist" aria-label={`${ownerName} profile content`}>
        <ContentTabButton
          buttonRef={postsTabRef}
          id={`${tabId}-posts-tab`}
          panelId={`${tabId}-posts-panel`}
          tab="posts"
          selected={selectedTab === 'posts'}
          onSelect={selectTab}
        >
          Posts
        </ContentTabButton>
        <ContentTabButton
          buttonRef={reviewsTabRef}
          id={`${tabId}-reviews-tab`}
          panelId={`${tabId}-reviews-panel`}
          tab="reviews"
          selected={selectedTab === 'reviews'}
          onSelect={selectTab}
        >
          Reviews
        </ContentTabButton>
      </div>

      {selectedTab === 'posts' ? (
        <div id={`${tabId}-posts-panel`} role="tabpanel" aria-labelledby={`${tabId}-posts-tab`}>
          <div className="profile-tab-panel-header">
            <div>
              <h2 className="text-h2">Posts</h2>
              <p className="text-meta mt-1">{postsDescription}</p>
            </div>
            {postsAction}
          </div>
          {posts === undefined && <div className="empty-state m-5">Loading posts...</div>}
          {posts?.length === 0 && (
            <div className="empty-state m-5">
              <p className="empty-state-title">No posts yet.</p>
              <p className="text-meta">{emptyPostsDescription}</p>
            </div>
          )}
          {posts && posts.length > 0 && (
            <div className="worklist">
              {posts.map((post) => (
                <article key={post._id} className="worklist-row">
                  <div className="worklist-row-head">
                    <div className="min-w-0">
                      <h3 className="text-h3">{ownerName}</h3>
                      <div className="worklist-row-meta tabular">{formatTime(post.createdAt)}</div>
                    </div>
                  </div>
                  {post.body && <p className="text-body muted whitespace-pre-wrap">{post.body}</p>}
                  {post.media.length > 0 && <PostMediaGrid media={post.media} className="profile-post-media" />}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div id={`${tabId}-reviews-panel`} role="tabpanel" aria-labelledby={`${tabId}-reviews-tab`}>
          <div className="profile-tab-panel-header">
            <div>
              <h2 className="text-h2">Reviews</h2>
              <p className="text-meta mt-1">{reviewsDescription}</p>
            </div>
            {typeof rating === 'number' && reviewCount ? (
              <div className="profile-rating-summary" aria-label={`${rating.toFixed(1)} out of 5 from ${reviewCount} reviews`}>
                <strong>{rating.toFixed(1)}</strong>
                <span>★</span>
                <small>{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</small>
              </div>
            ) : null}
          </div>
          {reviews === null && (
            <div className="empty-state m-5">
              <p className="empty-state-title">{unavailableReviewsTitle}</p>
              <p className="text-meta">{unavailableReviewsDescription}</p>
              {unavailableReviewsAction}
            </div>
          )}
          {reviews === undefined && <div className="empty-state m-5">Loading reviews...</div>}
          {reviews?.length === 0 && (
            <div className="empty-state m-5">
              <p className="empty-state-title">No reviews yet.</p>
              <p className="text-meta">{emptyReviewsDescription}</p>
            </div>
          )}
          {reviews && reviews.length > 0 && (
            <div className="worklist">
              {reviews.map((review) => (
                <article key={review._id} className="worklist-row profile-review-card">
                  <div className="profile-review-author-row">
                    {review.reviewerId ? (
                      <Link to="/member-profile" search={{ userId: review.reviewerId }} className="profile-review-author-link" aria-label={`View ${review.reviewerDisplayName}'s profile`}>
                        <Avatar name={review.reviewerDisplayName} src={review.reviewerProfileImageUrl} size="large" decorative />
                      </Link>
                    ) : (
                      <Avatar name={review.reviewerDisplayName} src={review.reviewerProfileImageUrl} size="large" decorative />
                    )}
                    <div className="min-w-0 profile-review-author-copy">
                      {review.reviewerId ? (
                        <Link to="/member-profile" search={{ userId: review.reviewerId }} className="profile-review-author-name">{review.reviewerDisplayName}</Link>
                      ) : (
                        <h3 className="text-h3">{review.reviewerDisplayName}</h3>
                      )}
                      <div className="worklist-row-meta tabular">{formatTime(review.createdAt)}</div>
                    </div>
                    {reviewAction?.(review)}
                  </div>
                  <RatingStars rating={review.rating} />
                  {review.body && <p className="text-body muted profile-review-body">{review.body}</p>}
                  {review.imageUrl && (
                    <div className="profile-review-image">
                      <OpenableImage src={review.imageUrl} alt={`Photo shared with ${review.reviewerDisplayName}'s review`} />
                    </div>
                  )}
                  <div className="profile-review-actions" aria-label={`Actions for ${review.reviewerDisplayName}'s review`}>
                    <button
                      type="button"
                      className="profile-review-action"
                      data-active={review.liked || undefined}
                      disabled={!onLikeReview}
                      onClick={() => void onLikeReview?.(review)}
                      title={onLikeReview ? undefined : 'Sign in to like this review'}
                    >
                      <Heart size={17} fill={review.liked ? 'currentColor' : 'none'} aria-hidden="true" />
                      Like{review.likeCount ? ` ${review.likeCount}` : ''}
                    </button>
                    <button
                      type="button"
                      className="profile-review-action"
                      disabled={!onCommentReview && !(review.commentCount || 0)}
                      onClick={() => setOpenComments((current) => {
                        const next = new Set(current)
                        if (next.has(review._id)) next.delete(review._id)
                        else next.add(review._id)
                        return next
                      })}
                      title={!onCommentReview ? 'Sign in to comment on this review' : undefined}
                    >
                      <MessageCircle size={17} aria-hidden="true" />
                      Comment{review.commentCount ? ` ${review.commentCount}` : ''}
                    </button>
                  </div>
                  {openComments.has(review._id) && (
                    <div className="profile-review-comments">
                      {review.comments?.map((comment) => (
                        <div key={comment._id} className="profile-review-comment">
                          <Avatar name={comment.authorDisplayName} src={comment.authorProfileImageUrl} size="small" decorative />
                          <div>
                            <strong>{comment.authorDisplayName}</strong>
                            <p>{comment.body}</p>
                          </div>
                        </div>
                      ))}
                      {onCommentReview && (
                        <form
                          className="profile-review-comment-form"
                          onSubmit={async (event) => {
                            event.preventDefault()
                            const body = commentDrafts[review._id]?.trim() ?? ''
                            if (!body) return
                            setCommentBusy(review._id)
                            try {
                              await onCommentReview(review, body)
                              setCommentDrafts((current) => ({ ...current, [review._id]: '' }))
                            } finally {
                              setCommentBusy(null)
                            }
                          }}
                        >
                          <input
                            className="field"
                            value={commentDrafts[review._id] ?? ''}
                            onChange={(event) => setCommentDrafts((current) => ({ ...current, [review._id]: event.target.value }))}
                            placeholder="Write a comment"
                            aria-label={`Comment on ${review.reviewerDisplayName}'s review`}
                            maxLength={500}
                          />
                          <button className="btn btn-social-quiet btn-sm" disabled={commentBusy === review._id}>Post</button>
                        </form>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="profile-review-stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, rating - index))
        return (
          <span key={index} className="profile-review-star" aria-hidden="true">
            <Star size={18} />
            <span style={{ width: `${fill * 100}%` }}><Star size={18} fill="currentColor" /></span>
          </span>
        )
      })}
      <strong>{rating.toFixed(1)}</strong>
    </div>
  )
}

function ContentTabButton({
  buttonRef,
  id,
  panelId,
  tab,
  selected,
  onSelect,
  children,
}: {
  buttonRef: Ref<HTMLButtonElement>
  id: string
  panelId: string
  tab: ContentTab
  selected: boolean
  onSelect: (tab: ContentTab, focus?: boolean) => void
  children: ReactNode
}) {
  const otherTab: ContentTab = tab === 'posts' ? 'reviews' : 'posts'

  return (
    <button
      ref={buttonRef}
      id={id}
      type="button"
      role="tab"
      className="profile-content-tab"
      aria-selected={selected}
      aria-controls={panelId}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(tab)}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const nextTab = event.key === 'Home' ? 'posts' : event.key === 'End' ? 'reviews' : otherTab
        onSelect(nextTab, true)
      }}
    >
      {children}
    </button>
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
