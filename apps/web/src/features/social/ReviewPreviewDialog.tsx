import { Dialog } from '../../design-system/molecules/Dialog'
import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { ReviewContent } from './ReviewContent'

const noop = () => undefined

export type ReviewPreviewDraft = {
  companionName: string
  rating: number
  body?: string
  imageUrl?: string
}

/**
 * The same three pieces the feed card is built from, so what a reviewer sees
 * here is the layout other members get: shared PostCard shell, ReviewContent,
 * and the action row with no interactions yet.
 */
export function ReviewPostPreview({
  authorName,
  authorImageUrl,
  companionName,
  rating,
  body,
  imageUrl,
}: {
  authorName: string
  authorImageUrl?: string | null
} & ReviewPreviewDraft) {
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

export function ReviewPreviewDialog({
  open,
  onClose,
  authorName,
  authorImageUrl,
  companionName,
  rating,
  body,
  imageUrl,
}: {
  open: boolean
  onClose: () => void
  authorName: string
  authorImageUrl?: string | null
} & ReviewPreviewDraft) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="How your review will look"
      description="Published reviews appear in the feed like this. Appreciation, comments, saving, and sharing start once it is live."
      size="large"
    >
      <div className="review-preview">
        <ReviewPostPreview
          authorName={authorName}
          authorImageUrl={authorImageUrl}
          companionName={companionName}
          rating={rating}
          body={body}
          imageUrl={imageUrl}
        />
        <p className="review-preview-note">
          Reviews with a note or a photo are the ones that reach the feed. A star rating on its own stays on {companionName}&rsquo;s profile.
        </p>
      </div>
    </Dialog>
  )
}
