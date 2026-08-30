import { activeMentionQuery, arrangeCommentThreads, splitBodyIntoSegments, withoutLeadingReplyMention, type CommentThreadPosition, type FeedInstrumentationAction, type StoredMention } from '@lets-be-friends/shared'
import { Link, useNavigate } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { Heart, ImagePlus, MessageCircle, Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Avatar } from '../../design-system/atoms/Avatar'
import { ConfirmationDialog } from '../../design-system/molecules/Dialog'
import { CommentActionsMenu } from './CommentActionsMenu'
import { CommentBubble } from './CommentBubble'
import { PostActionsMenu } from './PostActionsMenu'
import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { PostMediaGrid } from './PostMediaGrid'

type FeedItem = NonNullable<ReturnType<typeof useQuery<typeof api.social.feed>>>[number]
type FeedPostItem = Extract<FeedItem, { kind: 'post' }>
type FeedPost = FeedPostItem['post']
type PostComment = NonNullable<ReturnType<typeof useQuery<typeof api.social.commentsForPost>>>[number]
type FeedFilter = 'for_you' | 'following' | 'saved'
type SelectedMedia = {
  file: File
  kind: 'image' | 'video'
  previewUrl: string
}

export function SocialPage({ postId }: { postId?: string }) {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()
  const viewer = useQuery(api.users.viewer)
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('for_you')
  const feedItems = useQuery(api.social.feed, { filter: viewer ? feedFilter : 'for_you' }) as FeedItem[] | undefined
  const requestedPost = useQuery(api.social.requestedPost, postId ? { postId } : 'skip') as FeedPost | null | undefined
  const mediaUsage = useQuery(api.social.mediaUploadUsage)
  const createPost = useMutation(api.social.createPost)
  const editPost = useMutation(api.social.editPost)
  const deletePost = useMutation(api.social.deletePost)
  const createComment = useMutation(api.social.createComment)
  const editComment = useMutation(api.social.editComment)
  const toggleCommentLike = useMutation(api.social.toggleCommentLike)
  const generatePostMediaUploadUrl = useMutation(api.social.generatePostMediaUploadUrl)
  const registerPostMediaUpload = useMutation(api.social.registerPostMediaUpload)
  const discardPostMediaUpload = useMutation(api.social.discardPostMediaUpload)
  const toggleSave = useMutation(api.social.toggleSavePost)
  const toggleLike = useMutation(api.social.toggleLike)
  const recordFeedImpressions = useMutation(api.social.recordFeedImpressions)
  const recordFeedAction = useMutation(api.social.recordFeedAction)
  const report = useMutation(api.reports.create)
  const feedSessionId = useRef(`feed-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const impressedItemKeys = useRef(new Set<string>())
  const recordedActionKeys = useRef(new Set<string>())
  const setNotice = useCallback((message: string) => toast.success(message), [])
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const [composerBody, setComposerBody] = useState('')
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedMediaRef = useRef<SelectedMedia[]>([])
  const fallbackName = viewer?.displayName ?? 'New friend'
  const mediaLimit = mediaUsage?.limit ?? 5
  const remainingUploads = mediaUsage?.remaining ?? mediaLimit
  const displayedFeedItems = useMemo(() => feedItems && requestedPost && !feedItems.some((item) => item.kind === 'post' && String(item.post._id) === String(requestedPost._id))
    ? [{ kind: 'post' as const, itemKey: `post:${requestedPost._id}`, source: 'recent' as const, reason: 'Opened from your notification', post: requestedPost }, ...feedItems]
    : feedItems, [feedItems, requestedPost])

  selectedMediaRef.current = selectedMedia

  useEffect(() => () => {
    selectedMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
  }, [])

  useEffect(() => {
    if (!viewer || !displayedFeedItems) return
    const newItems = displayedFeedItems
      .map((item, position) => ({ item, position }))
      .filter(({ item }) => !impressedItemKeys.current.has(`${feedFilter}:${item.itemKey}`))
    newItems.forEach(({ item }) => impressedItemKeys.current.add(`${feedFilter}:${item.itemKey}`))
    for (let index = 0; index < newItems.length; index += 20) {
      void recordFeedImpressions({
        sessionId: feedSessionId.current,
        surface: feedFilter,
        items: newItems.slice(index, index + 20).map(({ item, position }) => ({
          itemKey: item.itemKey,
          itemType: item.kind,
          source: item.source,
          position,
        })),
      }).catch(() => undefined)
    }
  }, [displayedFeedItems, feedFilter, recordFeedImpressions, viewer])

  const recordAction = (item: FeedItem, action: FeedInstrumentationAction) => {
    if (!viewer) return
    const key = `${feedFilter}:${item.itemKey}:${action}`
    if (recordedActionKeys.current.has(key)) return
    recordedActionKeys.current.add(key)
    void recordFeedAction({
      sessionId: feedSessionId.current,
      surface: feedFilter,
      itemKey: item.itemKey,
      itemType: item.kind,
      source: item.source,
      action,
    }).catch(() => undefined)
  }

  const clearSelectedMedia = () => {
    selectedMedia.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    setSelectedMedia([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    setError('')
    const current = selectedMedia.length
    const slots = Math.max(0, remainingUploads - current)
    if (slots === 0) {
      setError('You have reached the daily media upload limit.')
      return
    }
    const accepted: SelectedMedia[] = []
    for (const file of Array.from(files)) {
      if (accepted.length >= slots) break
      const kind = mediaKind(file)
      if (!kind) {
        setError('Posts can include photos and video only.')
        continue
      }
      if (kind === 'image' && file.size > 10 * 1024 * 1024) {
        setError('Photos must be 10 MB or smaller.')
        continue
      }
      if (kind === 'video' && file.size > 50 * 1024 * 1024) {
        setError('Videos must be 50 MB or smaller.')
        continue
      }
      accepted.push({ file, kind, previewUrl: URL.createObjectURL(file) })
    }
    if (Array.from(files).length > slots) setError(`You can add ${slots} more media upload${slots === 1 ? '' : 's'} before the daily limit.`)
    setSelectedMedia((items) => [...items, ...accepted])
  }

  const removeSelectedMedia = (index: number) => {
    setSelectedMedia((items) => {
      const next = [...items]
      const [removed] = next.splice(index, 1)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return next
    })
  }

  return (
    <main className="social-page">
      <section className="social-timeline" aria-label="Home feed">
        <header className="social-timeline-header">
          <div>
            <h1 className="text-h1">Home</h1>
            <p className="text-meta">Everyday help, useful ideas, and people worth connecting with.</p>
          </div>
          <Link to="/discover" className="btn btn-social-quiet btn-sm">Explore Companions</Link>
        </header>

        <div className="social-feed-tabs" role="tablist" aria-label="Social feed">
          {(['for_you', 'following', 'saved'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={feedFilter === filter}
              className="social-feed-tab"
              data-active={feedFilter === filter}
              disabled={filter !== 'for_you' && !viewer}
              title={filter !== 'for_you' && !viewer ? 'Sign in to use this feed' : undefined}
              onClick={() => {
                setError('')
                setFeedFilter(filter)
              }}
            >
              {filter === 'for_you' ? 'For you' : filter[0].toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="notice notice-danger social-notice" role="alert">
            <span className="notice-icon">!</span>
            <span>{error}</span>
          </div>
        )}

        {isSignedIn ? (
          <form
            className="social-composer"
            onSubmit={async (event) => {
              event.preventDefault()
              setPosting(true)
              setError('')
              let mediaUploadIds: Id<'postMediaUploads'>[] = []
              try {
                const body = composerBody.trim()
                if (!body && selectedMedia.length === 0) return
                mediaUploadIds = await uploadPostMedia(
                  selectedMedia,
                  generatePostMediaUploadUrl,
                  registerPostMediaUpload,
                  discardPostMediaUpload,
                )
                await createPost({ body, mediaUploadIds: mediaUploadIds.length > 0 ? mediaUploadIds : undefined })
                setComposerBody('')
                clearSelectedMedia()
                setNotice('Post shared.')
              } catch (postError) {
                await discardRegisteredUploads(mediaUploadIds, discardPostMediaUpload)
                setError(postError instanceof Error ? postError.message : 'Post could not be shared.')
              } finally {
                setPosting(false)
              }
            }}
          >
            <span className="avatar avatar-lg" aria-hidden="true">{initials(fallbackName)}</span>
            <div className="social-composer-body">
              <div className="social-composer-intents">
                <strong>Share an update</strong>
                <Link to="/discover">Find help or company</Link>
              </div>
              <MentionField
                value={composerBody}
                onChange={setComposerBody}
                name="body"
                className="social-composer-input"
                maxLength={1000}
                placeholder="What could feel easier or better together?"
                ariaLabel="Create a post"
                multiline
              />
              {selectedMedia.length > 0 && (
                <PostMediaGrid mode="preview" media={selectedMedia} onRemove={removeSelectedMedia} />
              )}
              <div className="social-composer-toolbar">
                <div className="social-upload-actions">
                  <button
                    type="button"
                    className="social-icon-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={remainingUploads <= selectedMedia.length}
                    aria-label="Add photos or video"
                    title="Add photos or video"
                  >
                    <ImagePlus size={18} />
                  </button>
                  <input
                    ref={fileInputRef}
                    className="social-file-input"
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(event) => addFiles(event.currentTarget.files)}
                  />
                  <span className="text-meta">{remainingUploads} of {mediaLimit} daily media uploads left</span>
                </div>
                <button disabled={posting} className="btn btn-social btn-sm">
                  <Send size={14} />
                  {posting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="social-signin">
            <p className="empty-state-title">Sign in to post, comment, save, or follow.</p>
            <SignInButton mode="modal">
              <button className="btn btn-self btn-sm mt-2">Sign in</button>
            </SignInButton>
          </div>
        )}

        {displayedFeedItems === undefined && <SocialTimelineSkeleton />}
        {displayedFeedItems && displayedFeedItems.length === 0 && feedFilter !== 'for_you' && (
          <div className="empty-state social-feed-empty">
            <p className="empty-state-title">No {feedFilter} posts yet.</p>
            <p className="text-meta">Posts in your {feedFilter} feed will appear here.</p>
          </div>
        )}
        {displayedFeedItems && displayedFeedItems.length > 0 && (
          <div className="social-feed">
            {displayedFeedItems.map((item) => {
              if (item.kind === 'companion') {
                return <CompanionRecommendationCard key={item.itemKey} item={item} onOpen={() => recordAction(item, 'open_companion')} />
              }
              if (item.kind === 'guidance') {
                return <GuidanceCard key={item.itemKey} item={item} onOpen={() => recordAction(item, 'open_guidance')} />
              }
              const post = item.post
              return (
                <PostRow
                  key={item.itemKey}
                  post={post}
                  focusComments={postId === String(post._id)}
                  viewerReady={Boolean(viewer)}
                  onComment={async (body, parentCommentId) => {
                    await createComment({ postId: post._id, body, parentCommentId })
                    recordAction(item, 'comment')
                    setNotice(parentCommentId ? 'Reply added.' : 'Comment added.')
                  }}
                  onEdit={async (body) => {
                    await editPost({ postId: post._id, body })
                    setNotice('Post updated.')
                  }}
                  onDelete={async () => {
                    await deletePost({ postId: post._id })
                    setNotice('Post deleted.')
                  }}
                  onLike={async () => {
                    await toggleLike({ postId: post._id })
                    recordAction(item, 'like')
                  }}
                  onSave={async () => {
                    await toggleSave({ postId: post._id })
                    recordAction(item, 'save')
                    setNotice(post.saved ? 'Post removed from saved.' : 'Post saved.')
                  }}
                  onReport={async () => {
                    await report({ targetType: 'post', targetId: post._id, reason: 'Post needs safety review' })
                    recordAction(item, 'report')
                    setNotice('Report sent to safety review.')
                  }}
                  onEditComment={async (commentId, body) => {
                    await editComment({ commentId, body })
                    setNotice('Comment updated.')
                  }}
                  onLikeComment={async (commentId) => {
                    await toggleCommentLike({ commentId })
                  }}
                  onReportComment={async (commentId) => {
                    await report({ targetType: 'comment', targetId: commentId, reason: 'Comment needs safety review' })
                    recordAction(item, 'report_comment')
                    setNotice('Comment report sent to safety review.')
                  }}
                />
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function CompanionRecommendationCard({
  item,
  onOpen,
}: {
  item: Extract<FeedItem, { kind: 'companion' }>
  onOpen: () => void
}) {
  return (
    <aside className="social-reserve-card" aria-label={`Recommended Companion: ${item.companion.displayName}`}>
      <div className="social-reserve-planline"><span>From a good fit to a shared plan</span></div>
      <div className="social-reserve-label">Companion idea</div>
      <div className="social-reserve-head">
        <div>
          <h2 className="text-h3">{item.companion.displayName}</h2>
          <p className="text-meta">{item.companion.mode.replace('_', ' ')} · {item.companion.rating.toFixed(1)} from {item.companion.reviewCount} reviews</p>
        </div>
        <Link
          to="/companion-profile"
          search={{ companionProfileId: item.companion._id }}
          className="btn btn-social btn-sm"
          onClick={onOpen}
          aria-label={`View ${item.companion.displayName}'s Companion profile`}
        >
          See their ideas
        </Link>
      </div>
      <p className="social-reserve-copy">{item.companion.intro}</p>
      <p className="social-feed-reason">Because you might like: {item.reason}</p>
      <div className="social-reserve-tags" aria-label="Categories and Strengths">
        {[...item.companion.categories, ...item.companion.strengths].slice(0, 4).map((label) => <span key={label}>{label}</span>)}
      </div>
    </aside>
  )
}

function GuidanceCard({
  item,
  onOpen,
}: {
  item: Extract<FeedItem, { kind: 'guidance' }>
  onOpen: () => void
}) {
  return (
    <aside className="social-reserve-card social-guidance-card" aria-label="Let's Be Friends guidance">
      <div className="social-reserve-label">A helpful next step</div>
      <h2 className="text-h3">{item.title}</h2>
      <p className="social-reserve-copy">{item.body}</p>
      <p className="social-feed-reason">Why you’re seeing this: {item.reason}</p>
      <Link to={item.actionHref} className="btn btn-neutral btn-sm" onClick={onOpen}>{item.actionLabel}</Link>
    </aside>
  )
}

const SKELETON_VARIANTS: Array<'image' | 'text'> = ['image', 'text', 'image', 'text', 'image']

function SocialTimelineSkeleton() {
  return (
    <div className="social-feed" aria-label="Loading posts">
      {SKELETON_VARIANTS.map((variant, index) => (
        <article className="social-post skeleton-row" aria-hidden="true" key={index}>
          <span className="skeleton skeleton-avatar skeleton-avatar-lg" />
          <div className="social-post-body skeleton-stack">
            <span className="skeleton skeleton-line skeleton-line-title" />
            <span className="skeleton skeleton-line skeleton-line-meta" />
            <span className="skeleton skeleton-line skeleton-line-body" />
            <span className="skeleton skeleton-line skeleton-line-short" />
            {variant === 'image' && <span className="skeleton skeleton-media" />}
            <div className="social-action-bar">
              <span className="skeleton skeleton-action" />
              <span className="skeleton skeleton-action" />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function PostRow({
  post,
  focusComments,
  viewerReady,
  onComment,
  onEdit,
  onDelete,
  onLike,
  onSave,
  onReport,
  onEditComment,
  onLikeComment,
  onReportComment,
}: {
  post: FeedPost
  focusComments: boolean
  viewerReady: boolean
  onComment: (body: string, parentCommentId?: Id<'postComments'>) => Promise<void>
  onEdit: (body: string) => Promise<void>
  onDelete: () => Promise<void>
  onLike: () => Promise<void>
  onSave: () => Promise<void>
  onReport: () => Promise<void>
  onEditComment: (commentId: Id<'postComments'>, body: string) => Promise<void>
  onLikeComment: (commentId: Id<'postComments'>) => Promise<void>
  onReportComment: (commentId: Id<'postComments'>) => Promise<void>
}) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commenting, setCommenting] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [editing, setEditing] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [actionPending, setActionPending] = useState('')
  const [actionError, setActionError] = useState('')
  const comments = useQuery(api.social.commentsForPost, commentsOpen ? { postId: post._id } : 'skip') as PostComment[] | undefined
  const threadedComments = useMemo(() => comments ? arrangeCommentThreads(comments) : undefined, [comments])
  const rowRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!focusComments) return
    setCommentsOpen(true)
    requestAnimationFrame(() => rowRef.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }, [focusComments])

  function editFromOptions() {
    setEditing((value) => !value)
  }

  async function deleteFromOptions() {
    setActionPending('delete')
    setActionError('')
    try {
      await onDelete()
      setDeleteConfirmOpen(false)
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Post could not be deleted.')
    } finally {
      setActionPending('')
    }
  }

  async function reportFromOptions() {
    setActionPending('report')
    setActionError('')
    try {
      await onReport()
    } catch (reportError) {
      setActionError(reportError instanceof Error ? reportError.message : 'Post could not be reported.')
    } finally {
      setActionPending('')
    }
  }

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

  const avatarAction = post.ownPost ? (
    <Link to="/profile" className="social-post-avatar-link" aria-label="View your profile">
      <Avatar name={post.authorDisplayName} src={post.authorProfileImageUrl} size="large" decorative />
    </Link>
  ) : post.authorCompanionProfileId ? (
    <Link
      to="/companion-profile"
      search={{ companionProfileId: post.authorCompanionProfileId }}
      className="social-post-avatar-link"
      aria-label={`View ${post.authorDisplayName}'s profile`}
    >
      <Avatar name={post.authorDisplayName} src={post.authorProfileImageUrl} size="large" decorative />
    </Link>
  ) : undefined

  return (
    <PostCard
      ref={rowRef}
      id={`post-${post._id}`}
      tabIndex={focusComments ? -1 : undefined}
      author={post.authorDisplayName}
      imageUrl={post.authorProfileImageUrl}
      timestamp={formatTime(post.createdAt)}
      dateTime={new Date(post.createdAt).toISOString()}
      authorAction={authorAction}
      avatarAction={avatarAction}
      meta={post.experienceBookingId ? (
        <>
          <span className="ds-post-meta-separator" aria-hidden="true">·</span>
          <span>Experience post</span>
        </>
      ) : undefined}
      actions={viewerReady ? (
        <PostActionsMenu
          ownedByViewer={post.ownPost}
          disabled={Boolean(actionPending)}
          onEdit={post.ownPost ? editFromOptions : undefined}
          onDelete={post.ownPost ? () => setDeleteConfirmOpen(true) : undefined}
          onReport={!post.ownPost ? () => void reportFromOptions() : undefined}
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
      {editing ? (
          <form
            className="social-edit-form"
            onSubmit={async (event) => {
              event.preventDefault()
              setActionPending('edit')
              setActionError('')
              try {
                const body = String(new FormData(event.currentTarget).get('body') ?? '')
                await onEdit(body)
                setEditing(false)
              } catch (editError) {
                setActionError(editError instanceof Error ? editError.message : 'Post could not be updated.')
              } finally {
                setActionPending('')
              }
            }}
          >
            <textarea name="body" className="field min-h-24" maxLength={1000} defaultValue={post.body} aria-label="Edit post" />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button disabled={Boolean(actionPending)} className="btn btn-social btn-sm">{actionPending === 'edit' ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        ) : post.body ? <MentionText body={post.body} mentions={post.mentions} className="social-post-copy" /> : null}
        {actionError && <p className="text-meta social-comment-error mt-2">{actionError}</p>}
        {post.media.length > 0 && <PostMediaGrid media={post.media} />}
        <PostActionBar
          liked={post.liked}
          likeCount={post.likeCount}
          commentCount={post.commentCount}
          saved={post.saved}
          commentsOpen={commentsOpen}
          likeDisabled={!viewerReady || actionPending === 'like'}
          showSave={viewerReady}
          onLike={() => {
            void (async () => {
              setActionPending('like')
              setActionError('')
              try {
                await onLike()
              } catch (likeError) {
                setActionError(likeError instanceof Error ? likeError.message : 'Like could not be updated.')
              } finally {
                setActionPending('')
              }
            })()
          }}
          onToggleComments={() => setCommentsOpen((open) => !open)}
          onSave={onSave}
        />
        {commentsOpen && (
          <div className="social-comments">
            {viewerReady && (
              <form
                className="social-comment-form"
                onSubmit={async (event) => {
                  event.preventDefault()
                  setCommenting(true)
                  setCommentError('')
                  try {
                    const body = commentBody.trim()
                    if (!body) return
                    await onComment(body)
                    setCommentBody('')
                  } catch (error) {
                    setCommentError(error instanceof Error ? error.message : 'Comment could not be added.')
                  } finally {
                    setCommenting(false)
                  }
                }}
              >
                <MentionField
                  value={commentBody}
                  onChange={setCommentBody}
                  name="comment"
                  className="field"
                  maxLength={500}
                  placeholder="Post your comment"
                  ariaLabel="Comment"
                />
                <button disabled={commenting} className="btn btn-social btn-sm">{commenting ? 'Sending...' : 'Comment'}</button>
              </form>
            )}
            {commentError && <p className="text-meta social-comment-error">{commentError}</p>}
            {comments === undefined ? (
              <p className="text-meta">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-meta">No comments yet.</p>
            ) : (
              <div className="social-comment-list">
                {threadedComments?.map(({ comment, position, isLastReply }) => (
                  <CommentRow
                    key={comment._id}
                    comment={comment}
                    threadPosition={position}
                    isLastReply={isLastReply}
                    viewerReady={viewerReady}
                    onReply={(body) => onComment(body, comment._id)}
                    onLike={() => onLikeComment(comment._id)}
                    onEdit={(body) => onEditComment(comment._id, body)}
                    onReport={() => onReportComment(comment._id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
    </PostCard>
  )
}

function CommentRow({
  comment,
  viewerReady,
  onReply,
  onLike,
  onEdit,
  onReport,
  threadPosition,
  isLastReply,
}: {
  comment: PostComment
  threadPosition: CommentThreadPosition
  isLastReply: boolean
  viewerReady: boolean
  onReply: (body: string) => Promise<void>
  onLike: () => Promise<void>
  onEdit: (body: string) => Promise<void>
  onReport: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [replying, setReplying] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [actionPending, setActionPending] = useState<'edit' | 'like' | 'reply' | 'report' | ''>('')
  const [actionError, setActionError] = useState('')

  function beginEditing() {
    setEditBody(comment.body)
    setActionError('')
    setEditing(true)
  }

  async function reportComment() {
    setActionPending('report')
    setActionError('')
    try {
      await onReport()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Comment could not be reported.')
    } finally {
      setActionPending('')
    }
  }

  function beginReplying() {
    setReplyBody('')
    setActionError('')
    setReplying(true)
  }

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
    <CommentBubble
      author={comment.authorDisplayName}
      imageUrl={comment.authorProfileImageUrl}
      avatarAction={avatarAction}
      timestamp={formatTime(comment.createdAt)}
      dateTime={new Date(comment.createdAt).toISOString()}
      edited={comment.updatedAt > comment.createdAt}
      threadPosition={threadPosition}
      isLastReply={isLastReply}
      replyContext={comment.parentCommentId && comment.replyToAuthorId ? (
        <span>
          Replying to{' '}
          <Link to="/member-profile" search={{ userId: comment.replyToAuthorId }}>
            {comment.replyToAuthorUsername ? `@${comment.replyToAuthorUsername}` : comment.replyToAuthorDisplayName ?? 'Member'}
          </Link>
        </span>
      ) : undefined}
      actions={viewerReady ? (
        <CommentActionsMenu
          ownedByViewer={comment.ownComment}
          disabled={editing || Boolean(actionPending)}
          onEdit={comment.ownComment ? beginEditing : undefined}
          onReport={!comment.ownComment ? () => void reportComment() : undefined}
        />
      ) : undefined}
    >
      {editing ? (
        <form
          className="social-comment-edit-form"
          onSubmit={async (event) => {
            event.preventDefault()
            setActionPending('edit')
            setActionError('')
            try {
              await onEdit(editBody)
              setEditing(false)
            } catch (error) {
              setActionError(error instanceof Error ? error.message : 'Comment could not be updated.')
            } finally {
              setActionPending('')
            }
          }}
        >
          <MentionField
            value={editBody}
            onChange={setEditBody}
            name="comment-edit"
            className="field"
            maxLength={500}
            placeholder="Update your comment"
            ariaLabel="Edit comment"
          />
          <div className="social-comment-edit-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={actionPending === 'edit'}
              onClick={() => {
                setEditing(false)
                setActionError('')
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-social btn-sm"
              disabled={actionPending === 'edit'}
            >
              {actionPending === 'edit' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <MentionText body={withoutLeadingReplyMention(comment.body, comment.replyToAuthorUsername)} mentions={comment.mentions} />
      )}
      {!editing && (
        <div className="social-comment-interactions" aria-label={`Interactions for ${comment.authorDisplayName}'s comment`}>
          {viewerReady && (
            <button
              type="button"
              className="social-comment-interaction"
              onClick={beginReplying}
              disabled={Boolean(actionPending)}
              aria-expanded={replying}
            >
              <MessageCircle size={13} aria-hidden="true" />
              Reply
            </button>
          )}
          <button
            type="button"
            className="social-comment-interaction"
            data-active={comment.liked}
            aria-pressed={comment.liked}
            aria-label={`${comment.liked ? 'Unlike' : 'Like'} ${comment.authorDisplayName}'s comment`}
            disabled={!viewerReady || Boolean(actionPending)}
            onClick={() => {
              setActionPending('like')
              setActionError('')
              void onLike()
                .catch((error) => setActionError(error instanceof Error ? error.message : 'Like could not be updated.'))
                .finally(() => setActionPending(''))
            }}
          >
            <Heart size={13} fill={comment.liked ? 'currentColor' : 'none'} aria-hidden="true" />
            <span>{comment.likeCount > 0 ? comment.likeCount : 'Like'}</span>
          </button>
        </div>
      )}
      {replying && (
        <form
          className="social-comment-reply-form"
          onSubmit={async (event) => {
            event.preventDefault()
            const body = replyBody.trim()
            if (!body) return
            setActionPending('reply')
            setActionError('')
            try {
              await onReply(body)
              setReplying(false)
              setReplyBody('')
            } catch (error) {
              setActionError(error instanceof Error ? error.message : 'Reply could not be added.')
            } finally {
              setActionPending('')
            }
          }}
        >
          <MentionField
            value={replyBody}
            onChange={setReplyBody}
            name={`reply-${comment._id}`}
            className="field"
            maxLength={500}
            placeholder="Write a reply"
            ariaLabel={`Reply to ${comment.authorDisplayName}`}
            autoFocus
          />
          <div className="social-comment-edit-actions">
            <button type="button" className="btn btn-ghost btn-sm" disabled={actionPending === 'reply'} onClick={() => setReplying(false)}>Cancel</button>
            <button className="btn btn-social btn-sm" disabled={actionPending === 'reply' || !replyBody.trim()}>{actionPending === 'reply' ? 'Replying...' : 'Reply'}</button>
          </div>
        </form>
      )}
      {actionError && <p className="social-comment-error" role="alert">{actionError}</p>}
    </CommentBubble>
  )
}

function MentionText({ body, mentions, className }: { body: string; mentions?: StoredMention[]; className?: string }) {
  const segments = splitBodyIntoSegments(body, mentions ?? [])
  return (
    <p className={className}>
      {segments.map((segment, index) => segment.type === 'mention' ? (
        <Link
          key={index}
          to="/member-profile"
          search={{ userId: segment.userId }}
          className="social-mention"
          onClick={(event) => event.stopPropagation()}
        >
          @{segment.username}
        </Link>
      ) : (
        <span key={index}>{segment.text}</span>
      ))}
    </p>
  )
}

function MentionField({
  value,
  onChange,
  name,
  placeholder,
  ariaLabel,
  maxLength,
  multiline = false,
  className,
  autoFocus = false,
}: {
  value: string
  onChange: (value: string) => void
  name: string
  placeholder: string
  ariaLabel: string
  maxLength: number
  multiline?: boolean
  className?: string
  autoFocus?: boolean
}) {
  const [caret, setCaret] = useState(value.length)
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const activeToken = activeMentionQuery(value, caret)
  const suggestions = useQuery(api.social.mentionLookup, activeToken ? { query: activeToken } : 'skip')

  const syncCaret = (nextValue: string, nextCaret: number) => {
    setCaret(nextCaret)
    openRef.current = Boolean(activeMentionQuery(nextValue, nextCaret))
    setOpen(openRef.current)
  }

  const insertMention = (username: string) => {
    const before = value.slice(0, caret).replace(/@[a-z0-9_]*$/i, `@${username} `)
    const after = value.slice(caret)
    onChange(before + after)
    openRef.current = false
    setOpen(false)
  }

  const shared = {
    name,
    placeholder,
    'aria-label': ariaLabel,
    maxLength,
    autoFocus,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = event.currentTarget.value
      const nextCaret = event.currentTarget.selectionStart ?? next.length
      onChange(next)
      syncCaret(next, nextCaret)
    },
    onSelect: (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const el = event.currentTarget
      syncCaret(el.value, el.selectionStart ?? el.value.length)
    },
    onFocus: () => {
      openRef.current = Boolean(activeMentionQuery(value, caret))
      setOpen(openRef.current)
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === 'Escape' && openRef.current) {
        event.preventDefault()
        openRef.current = false
        setOpen(false)
      }
    },
  }

  return (
    <div className="social-mention-wrap">
      {multiline ? (
        <textarea {...shared} className={className} />
      ) : (
        <input {...shared} className={className} />
      )}
      {open && suggestions && suggestions.length > 0 && (
        <div className="social-mention-menu" role="listbox" aria-label="Mention suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.userId}
              type="button"
              role="option"
              className="social-mention-option"
              onClick={() => insertMention(suggestion.username)}
            >
              <span className="avatar" aria-hidden="true">{initials(suggestion.displayName)}</span>
              <span className="social-mention-option-copy">
                <strong>{suggestion.displayName}</strong>
                <small>@{suggestion.username}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}



async function uploadPostMedia(
  media: SelectedMedia[],
  generateUpload: () => Promise<{ uploadUrl: string; uploadId: Id<'postMediaUploads'> }>,
  registerUpload: (args: { uploadId: Id<'postMediaUploads'>; storageId: Id<'_storage'> }) => Promise<unknown>,
  discardUpload: (args: { uploadId: Id<'postMediaUploads'>; storageId?: Id<'_storage'> }) => Promise<unknown>,
): Promise<Id<'postMediaUploads'>[]> {
  const registeredUploadIds: Id<'postMediaUploads'>[] = []
  try {
    for (const item of media) {
      const { uploadUrl, uploadId } = await generateUpload()
      let storageId: Id<'_storage'> | undefined
      try {
        const result = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': item.file.type },
          body: item.file,
        })
        if (!result.ok) throw new Error('Media upload failed.')
        const uploadResult = await result.json() as { storageId: string }
        storageId = uploadResult.storageId as Id<'_storage'>
        await registerUpload({ uploadId, storageId })
        registeredUploadIds.push(uploadId)
      } catch (error) {
        await Promise.allSettled([discardUpload({ uploadId, storageId })])
        throw error
      }
    }
    return registeredUploadIds
  } catch (error) {
    await discardRegisteredUploads(registeredUploadIds, discardUpload)
    throw error
  }
}

async function discardRegisteredUploads(
  uploadIds: Id<'postMediaUploads'>[],
  discardUpload: (args: { uploadId: Id<'postMediaUploads'>; storageId?: Id<'_storage'> }) => Promise<unknown>,
) {
  await Promise.allSettled(uploadIds.map((uploadId) => discardUpload({ uploadId })))
}

function mediaKind(file: File): 'image' | 'video' | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return null
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
