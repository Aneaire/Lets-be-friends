import { Bookmark, Heart, MessageCircle } from 'lucide-react'

export function PostActionBar({
  liked,
  likeCount,
  commentCount,
  saved,
  commentsOpen,
  likeDisabled,
  showSave,
  onLike,
  onToggleComments,
  onSave,
}: {
  liked: boolean
  likeCount: number
  commentCount: number
  saved: boolean
  commentsOpen: boolean
  likeDisabled: boolean
  showSave: boolean
  onLike: () => void
  onToggleComments: () => void
  onSave: () => void
}) {
  return (
    <div className="social-action-bar" aria-label="Post actions">
      <button
        type="button"
        disabled={likeDisabled}
        className="social-action"
        data-active={liked}
        aria-label={liked ? 'Remove appreciation' : 'Appreciate post'}
        title={liked ? 'Remove appreciation' : 'Appreciate post'}
        onClick={onLike}
      >
        <Heart size={17} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
        {likeCount > 0 && <span aria-hidden="true">{likeCount}</span>}
      </button>
      <button
        type="button"
        className="social-action"
        aria-label={commentCount > 0 ? `Show ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}` : 'Show comments'}
        title="Show comments"
        aria-expanded={commentsOpen}
        onClick={onToggleComments}
      >
        <MessageCircle size={17} aria-hidden="true" />
        {commentCount > 0 && <span aria-hidden="true">{commentCount}</span>}
      </button>
      {showSave && (
        <button
          type="button"
          onClick={onSave}
          className="social-action"
          data-active={saved}
          aria-label={saved ? 'Remove saved post' : 'Save post'}
          title={saved ? 'Remove saved post' : 'Save post'}
        >
          <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
