import type { StoredMention } from '@lets-be-friends/shared'
import { Link } from '@tanstack/react-router'
import { forwardRef, Fragment, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Avatar } from '../../design-system/atoms/Avatar'
import { ConfirmationDialog } from '../../design-system/molecules/Dialog'
import { describeConvexError } from '../../lib/convexErrors'
import { postMuteAnnouncement } from './notificationMutes'
import { FeaturedComment, type FeaturedCommentView } from './FeaturedComment'
import { MentionText } from './MentionText'
import { PollCard, type PollView } from './PollCard'
import { PostActionsMenu } from './PostActionsMenu'
import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { PostMediaGrid, type DisplayPostMediaItem } from './PostMediaGrid'
import { ShareDialog } from './ShareDialog'
import { SharedPostEmbed, SharedReviewEmbed, type SharedPostView, type SharedReviewView } from './SharedEmbeds'
import { formatSocialTime } from './formatSocialTime'
import { shareTargetUrl } from './shareLinks'

export type SocialPostView = {
  _id: string
  authorId?: string
  authorDisplayName: string
  authorProfileImageUrl?: string | null
  authorCompanionProfileId?: string | null
  ownPost?: boolean
  body?: string
  mentions?: StoredMention[]
  createdAt: number
  media: readonly DisplayPostMediaItem[]
  poll?: PollView | null
  featuredComment?: FeaturedCommentView | null
  sharedPost?: SharedPostView | null
  sharedReview?: SharedReviewView | null
  liked: boolean
  likeCount: number
  commentCount: number
  saved: boolean
  experienceBookingId?: string | null
  profilePictureUpdate?: boolean
}

export type SocialPostCardProps = {
  post: SocialPostView
  viewerReady: boolean
  id?: string
  className?: string
  tabIndex?: number
  commentsOpen?: boolean
  comments?: ReactNode
  onToggleComments: () => void
  onLike: () => Promise<void>
  onSave?: () => Promise<void>
  notificationsMuted?: boolean
  onToggleNotificationsMuted?: () => Promise<void>
  onEdit?: (body: string) => Promise<void>
  onDelete?: () => Promise<void>
  onReport?: () => Promise<void>
  onVotePoll?: (optionId: string) => Promise<void>
  onShareToFeed?: (message: string) => Promise<void>
  onOpenMedia?: (index: number) => void
}

/**
 * The single post card composition shared by the social feed and profile
 * surfaces. Surfaces supply data, permissions, and mutations; the card owns
 * the shared identity, content, menu, share, and action presentation.
 */
export const SocialPostCard = forwardRef<HTMLElement, SocialPostCardProps>(function SocialPostCard({
  post,
  viewerReady,
  id,
  className = '',
  tabIndex,
  commentsOpen = false,
  comments,
  onToggleComments,
  onLike,
  onSave,
  notificationsMuted = false,
  onToggleNotificationsMuted,
  onEdit,
  onDelete,
  onReport,
  onVotePoll,
  onShareToFeed,
  onOpenMedia,
}, ref) {
  const [editing, setEditing] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [actionPending, setActionPending] = useState('')
  const [actionError, setActionError] = useState('')

  const authorAction = post.ownPost ? (
    <Link to="/profile" className="social-post-author-link">{post.authorDisplayName}</Link>
  ) : post.authorCompanionProfileId ? (
    <Link
      to="/companion-profile"
      search={{ companionProfileId: post.authorCompanionProfileId }}
      className="social-post-author-link"
    >
      {post.authorDisplayName}
    </Link>
  ) : undefined

  const avatar = <Avatar name={post.authorDisplayName} src={post.authorProfileImageUrl} size="large" className="ds-post-avatar-round" decorative />

  const avatarAction = post.ownPost ? (
    <Link to="/profile" className="social-post-avatar-link" aria-label="View your profile">
      {avatar}
    </Link>
  ) : post.authorCompanionProfileId ? (
    <Link
      to="/companion-profile"
      search={{ companionProfileId: post.authorCompanionProfileId }}
      className="social-post-avatar-link"
      aria-label={`View ${post.authorDisplayName}'s profile`}
    >
      {avatar}
    </Link>
  ) : post.authorId ? (
    <Link
      to="/member-profile"
      search={{ userId: post.authorId }}
      className="social-post-avatar-link"
      aria-label={`View ${post.authorDisplayName}'s profile`}
    >
      {avatar}
    </Link>
  ) : avatar

  async function runAction(kind: string, action: () => Promise<void>, fallback: string) {
    setActionPending(kind)
    setActionError('')
    try {
      await action()
      return true
    } catch (error) {
      setActionError(error instanceof Error ? describeConvexError(error) : fallback)
      return false
    } finally {
      setActionPending('')
    }
  }

  function handleLike() {
    void runAction('like', onLike, 'Like could not be updated.')
  }

  function handleSave() {
    if (!onSave) return
    void runAction('save', onSave, 'Save could not be updated.')
  }

  async function deleteFromOptions() {
    if (!onDelete) return
    setActionPending('delete')
    setActionError('')
    try {
      await onDelete()
      setDeleteConfirmOpen(false)
    } catch (error) {
      setActionError(error instanceof Error ? describeConvexError(error) : 'Post could not be deleted.')
    } finally {
      setActionPending('')
    }
  }

  function reportFromOptions() {
    if (!onReport) return
    void runAction('report', onReport, 'Post could not be reported.')
  }

  async function toggleNotificationsFromOptions() {
    if (!onToggleNotificationsMuted) return
    const muted = !notificationsMuted
    const saved = await runAction('notifications', onToggleNotificationsMuted, 'The notification setting could not be updated.')
    if (saved) toast.success(postMuteAnnouncement(muted))
  }

  const showMenu = viewerReady && Boolean(onEdit || onDelete || onReport || onToggleNotificationsMuted)
  const shareAction = viewerReady && onShareToFeed ? () => setShareOpen(true) : undefined
  const metaLabels = [
    post.profilePictureUpdate ? 'Profile picture update' : null,
    post.experienceBookingId ? 'Experience post' : null,
  ].filter((label): label is string => Boolean(label))

  return (
    <>
      <PostCard
        ref={ref}
        id={id}
        tabIndex={tabIndex}
        className={className}
        author={post.authorDisplayName}
        imageUrl={post.authorProfileImageUrl}
        timestamp={formatSocialTime(post.createdAt)}
        dateTime={new Date(post.createdAt).toISOString()}
        authorAction={authorAction}
        avatarAction={avatarAction}
        meta={metaLabels.length > 0 ? (
          <>
            {metaLabels.map((label) => (
              <Fragment key={label}>
                <span className="ds-post-meta-separator" aria-hidden="true">·</span>
                <span>{label}</span>
              </Fragment>
            ))}
          </>
        ) : undefined}
        actions={showMenu ? (
          <PostActionsMenu
            ownedByViewer={Boolean(post.ownPost)}
            disabled={Boolean(actionPending)}
            notificationsMuted={notificationsMuted}
            onToggleNotifications={onToggleNotificationsMuted ? () => void toggleNotificationsFromOptions() : undefined}
            onEdit={post.ownPost && onEdit ? () => setEditing((value) => !value) : undefined}
            onDelete={post.ownPost && onDelete ? () => setDeleteConfirmOpen(true) : undefined}
            onReport={!post.ownPost && onReport ? reportFromOptions : undefined}
          />
        ) : undefined}
      >
        <ConfirmationDialog
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={deleteFromOptions}
          title="Delete this post?"
          description="This also deletes its comments. This action cannot be undone."
          confirmLabel="Delete post"
          busy={actionPending === 'delete'}
        />
        {editing && onEdit ? (
          <form
            className="social-edit-form"
            onSubmit={(event) => {
              event.preventDefault()
              void runAction('edit', async () => {
                const body = String(new FormData(event.currentTarget).get('body') ?? '')
                await onEdit(body)
                setEditing(false)
              }, 'Post could not be updated.')
            }}
          >
            <textarea name="body" className="field min-h-24" maxLength={1000} defaultValue={post.body} aria-label="Edit post" />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button disabled={Boolean(actionPending)} className="btn btn-social btn-sm">{actionPending === 'edit' ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        ) : post.body ? <MentionText body={post.body} mentions={post.mentions} className="ds-post-copy" /> : null}
        {actionError && <p className="text-meta social-comment-error mt-2" role="alert">{actionError}</p>}
        {post.media.length > 0 && (
          <PostMediaGrid
            media={post.media}
            onOpenAt={onOpenMedia}
            className={post.profilePictureUpdate ? 'profile-picture-post-media' : undefined}
          />
        )}
        {post.poll && (
          <PollCard
            poll={post.poll}
            disabled={!viewerReady || !onVotePoll}
            onVote={onVotePoll ?? (async () => undefined)}
          />
        )}
        {post.featuredComment && !commentsOpen && (
          <FeaturedComment comment={post.featuredComment} onOpenThread={onToggleComments} />
        )}
        {post.sharedPost && <SharedPostEmbed post={post.sharedPost} />}
        {post.sharedReview && <SharedReviewEmbed review={post.sharedReview} />}
        <PostActionBar
          liked={post.liked}
          likeCount={post.likeCount}
          commentCount={post.commentCount}
          saved={post.saved}
          commentsOpen={commentsOpen}
          likeDisabled={!viewerReady || actionPending === 'like'}
          showSave={Boolean(onSave)}
          onLike={handleLike}
          onToggleComments={onToggleComments}
          onSave={handleSave}
          onShare={shareAction}
        />
        {onShareToFeed && (
          <ShareDialog
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            title="Share this post"
            url={shareTargetUrl({ kind: 'post', postId: String(post._id) })}
            preview={{
              label: `Post by ${post.authorDisplayName}`,
              body: post.body ?? '',
              imageUrl: post.media?.[0]?.url,
            }}
            onShareToFeed={onShareToFeed}
          />
        )}
        {commentsOpen ? comments : null}
      </PostCard>
    </>
  )
})
