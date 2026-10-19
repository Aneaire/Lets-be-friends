import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { ReviewContent } from './ReviewContent'

const noop = () => undefined

/**
 * The same three pieces the feed card is built from, so a reviewer watching
 * this while writing sees the layout other members get: shared PostCard shell,
 * ReviewContent, and the action row with no interactions yet.
 */
export function ReviewPostPreview({
  authorName,
  authorImageUrl,
  companionName,
  rating,
  body,
  imageUrl,
  imageUrls,
}: {
  authorName: string
  authorImageUrl?: string | null
  companionName: string
  rating: number
  body?: string
  imageUrl?: string
  imageUrls?: readonly string[]
}) {
  return (
    <PostCard
      author={authorName}
      imageUrl={authorImageUrl}
      timestamp="Just now"
      className="social-review-card"
      aria-label="Review preview"
      meta={
        <>
          <span aria-hidden="true" className="ds-post-meta-separator">·</span>
          <span className="social-review-companion">Shared an experience with {companionName}</span>
        </>
      }
    >
      <ReviewContent
        rating={rating}
        body={body}
        imageUrl={imageUrl}
        imageUrls={imageUrls}
        reviewerDisplayName={authorName}
        plainImage
      />
      <PostActionBar
        liked={false}
        likeCount={0}
        commentCount={0}
        saved={false}
        commentsOpen={false}
        likeDisabled={false}
        showSave
        onLike={noop}
        onToggleComments={noop}
        onSave={noop}
        onShare={noop}
      />
    </PostCard>
  )
}
