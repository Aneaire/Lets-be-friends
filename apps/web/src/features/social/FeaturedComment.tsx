import { withoutLeadingReplyMention, type StoredMention } from '@lets-be-friends/shared'
import { Link } from '@tanstack/react-router'
import { Avatar } from '../../design-system/atoms/Avatar'
import { CommentBubble } from './CommentBubble'
import { MentionText } from './MentionText'
import { formatSocialTime } from './formatSocialTime'

export type FeaturedCommentView = {
  authorId: string
  authorDisplayName: string
  authorProfileImageUrl?: string | null
  ownComment?: boolean
  body: string
  mentions?: StoredMention[]
  replyToAuthorUsername?: string
  threadInteractionCount: number
  createdAt: number
  updatedAt: number
}

export function FeaturedComment({
  comment,
  onOpenThread,
}: {
  comment: FeaturedCommentView
  onOpenThread: () => void
}) {
  const avatarAction = comment.ownComment ? (
    <Link to="/profile" className="social-comment-avatar-link" aria-label="View your profile">
      <Avatar name={comment.authorDisplayName} src={comment.authorProfileImageUrl} size="small" className="ds-comment-avatar" decorative />
    </Link>
  ) : (
    <Link
      to="/member-profile"
      search={{ userId: comment.authorId }}
      className="social-comment-avatar-link"
      aria-label={`View ${comment.authorDisplayName}'s profile`}
    >
      <Avatar name={comment.authorDisplayName} src={comment.authorProfileImageUrl} size="small" className="ds-comment-avatar" decorative />
    </Link>
  )

  return (
    <section className="social-featured-comment" aria-label="Most discussed comment">
      <p className="social-featured-comment-label">Most discussed</p>
      <CommentBubble
        author={comment.authorDisplayName}
        imageUrl={comment.authorProfileImageUrl}
        avatarAction={avatarAction}
        timestamp={formatSocialTime(comment.createdAt)}
        dateTime={new Date(comment.createdAt).toISOString()}
        edited={comment.updatedAt > comment.createdAt}
        threadPosition="standalone"
      >
        <MentionText body={withoutLeadingReplyMention(comment.body, comment.replyToAuthorUsername)} mentions={comment.mentions} />
      </CommentBubble>
      <button type="button" className="social-featured-comment-action" onClick={onOpenThread}>
        See the conversation ({comment.threadInteractionCount} interactions)
      </button>
    </section>
  )
}
