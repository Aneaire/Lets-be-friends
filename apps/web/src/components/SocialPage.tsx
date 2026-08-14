import type { FeedInstrumentationAction } from '@lets-be-friends/shared'
import { Link, useNavigate } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { Bookmark, Flag, Heart, ImagePlus, MessageCircle, Pencil, Send, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { MeetingSeam } from './AppNavigation'

type FeedItem = NonNullable<ReturnType<typeof useQuery<typeof api.social.feed>>>[number]
type FeedPostItem = Extract<FeedItem, { kind: 'post' }>
type FeedPost = FeedPostItem['post']
type PostComment = NonNullable<ReturnType<typeof useQuery<typeof api.social.commentsForPost>>>[number]
type FeedFilter = 'for_you' | 'following' | 'saved'
type PostMediaItem = {
  storageId: Id<'_storage'>
  kind: 'image' | 'video'
  contentType: string
  size: number
  url: string | null
}
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
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
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
            <p className="text-meta">Useful updates and people worth planning with.</p>
          </div>
          <Link to="/discover" className="btn btn-social-quiet btn-sm">Explore people</Link>
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

        {notice && (
          <div className="notice notice-success social-notice" role="status" aria-live="polite">
            <span className="notice-icon">✓</span>
            <span>{notice}</span>
          </div>
        )}
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
              setNotice('')
              let mediaUploadIds: Id<'postMediaUploads'>[] = []
              try {
                const form = event.currentTarget
                const data = new FormData(form)
                const body = String(data.get('body') ?? '').trim()
                if (!body && selectedMedia.length === 0) return
                mediaUploadIds = await uploadPostMedia(
                  selectedMedia,
                  generatePostMediaUploadUrl,
                  registerPostMediaUpload,
                  discardPostMediaUpload,
                )
                await createPost({ body, mediaUploadIds: mediaUploadIds.length > 0 ? mediaUploadIds : undefined })
                form.reset()
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
                <Link to="/discover">Find a shared plan</Link>
              </div>
              <textarea
                name="body"
                className="social-composer-input"
                maxLength={1000}
                placeholder="What would feel better with company?"
                aria-label="Create a post"
              />
              {selectedMedia.length > 0 && (
                <div className="social-media-preview-grid" data-count={selectedMedia.length}>
                  {selectedMedia.map((item, index) => (
                    <div className="social-media-preview" key={item.previewUrl}>
                      {item.kind === 'image' ? (
                        <img src={item.previewUrl} alt="" />
                      ) : (
                        <video src={item.previewUrl} muted playsInline />
                      )}
                      <button type="button" className="social-media-remove" onClick={() => removeSelectedMedia(index)} aria-label="Remove media">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
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
                  reason={item.reason}
                  focusComments={postId === String(post._id)}
                  viewerReady={Boolean(viewer)}
                  onComment={async (body) => {
                    await createComment({ postId: post._id, body })
                    recordAction(item, 'comment')
                    setNotice('Comment added.')
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
      <div className="social-reserve-planline"><MeetingSeam /><span>From a good fit to a shared plan</span></div>
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
  reason,
  focusComments,
  viewerReady,
  onComment,
  onEdit,
  onDelete,
  onLike,
  onSave,
  onReport,
  onReportComment,
}: {
  post: FeedPost
  reason: string
  focusComments: boolean
  viewerReady: boolean
  onComment: (body: string) => Promise<void>
  onEdit: (body: string) => Promise<void>
  onDelete: () => Promise<void>
  onLike: () => Promise<void>
  onSave: () => Promise<void>
  onReport: () => Promise<void>
  onReportComment: (commentId: Id<'postComments'>) => Promise<void>
}) {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commenting, setCommenting] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [editing, setEditing] = useState(false)
  const [actionPending, setActionPending] = useState('')
  const [actionError, setActionError] = useState('')
  const comments = useQuery(api.social.commentsForPost, commentsOpen ? { postId: post._id } : 'skip') as PostComment[] | undefined
  const rowRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!focusComments) return
    setCommentsOpen(true)
    requestAnimationFrame(() => rowRef.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }, [focusComments])

  return (
    <article ref={rowRef} id={`post-${post._id}`} className="social-post" tabIndex={focusComments ? -1 : undefined}>
      {post.ownPost ? (
        <Link
          to="/profile"
          className="avatar avatar-lg social-post-avatar social-post-avatar-link"
          aria-label="View your profile"
        >
          {post.authorProfileImageUrl
            ? <img src={post.authorProfileImageUrl} alt="" />
            : initials(post.authorDisplayName)}
        </Link>
      ) : post.authorCompanionProfileId ? (
        <Link
          to="/companion-profile"
          search={{ companionProfileId: post.authorCompanionProfileId }}
          className="avatar avatar-lg social-post-avatar social-post-avatar-link"
          aria-label={`View ${post.authorDisplayName}'s profile`}
        >
          {post.authorProfileImageUrl
            ? <img src={post.authorProfileImageUrl} alt="" />
            : initials(post.authorDisplayName)}
        </Link>
      ) : (
        <span className="avatar avatar-lg social-post-avatar" aria-hidden="true">
          {post.authorProfileImageUrl
            ? <img src={post.authorProfileImageUrl} alt="" />
            : initials(post.authorDisplayName)}
        </span>
      )}
      <div className="social-post-body">
        <div className="social-post-head">
          <div className="social-post-author">
            <h2 className="text-h3">{post.authorDisplayName}</h2>
            <div className="social-post-meta">
              <span className="tabular">{formatTime(post.createdAt)}</span>
              {post.experienceBookingId && (
                <>
                  <span className="dot" aria-hidden="true" />
                  <span>Experience post</span>
                </>
              )}
            </div>
          </div>
          <div className="social-post-actions-top">
            {post.ownPost ? (
              <>
                <button type="button" onClick={() => setEditing((value) => !value)} className="social-icon-button" aria-label="Edit post" title="Edit post">
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  disabled={Boolean(actionPending)}
                  onClick={async () => {
                    if (!window.confirm('Delete this post and its comments?')) return
                    setActionPending('delete')
                    setActionError('')
                    try {
                      await onDelete()
                    } catch (deleteError) {
                      setActionError(deleteError instanceof Error ? deleteError.message : 'Post could not be deleted.')
                    } finally {
                      setActionPending('')
                    }
                  }}
                  className="social-icon-button social-danger-button"
                  aria-label="Delete post"
                  title="Delete post"
                >
                  <Trash2 size={15} />
                </button>
              </>
            ) : viewerReady ? (
              <button type="button" onClick={onReport} className="social-icon-button social-danger-button" aria-label="Report post" title="Report post">
                <Flag size={15} />
              </button>
            ) : null}
          </div>
        </div>
        <p className="social-feed-reason" aria-label={`Why you are seeing this: ${reason}`}>Because you might like: {reason}</p>
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
        ) : post.body ? <p className="social-post-copy">{post.body}</p> : null}
        {actionError && <p className="text-meta social-comment-error mt-2">{actionError}</p>}
        {post.media.length > 0 && <PostMediaGrid media={post.media} />}
        <div className="social-action-bar" aria-label="Post actions">
          <button
            type="button"
            disabled={!viewerReady || actionPending === 'like'}
            className="social-action"
            data-active={post.liked}
            onClick={async () => {
              setActionPending('like')
              setActionError('')
              try {
                await onLike()
              } catch (likeError) {
                setActionError(likeError instanceof Error ? likeError.message : 'Like could not be updated.')
              } finally {
                setActionPending('')
              }
            }}
          >
            <Heart size={17} fill={post.liked ? 'currentColor' : 'none'} />
            <span>{post.liked ? 'Appreciated' : 'Appreciate'}{post.likeCount > 0 ? ` · ${post.likeCount}` : ''}</span>
          </button>
          <button type="button" className="social-action" onClick={() => setCommentsOpen((open) => !open)}>
            <MessageCircle size={17} />
            <span>{post.commentCount}</span>
          </button>
          {viewerReady && (
            <button type="button" onClick={onSave} className="social-action" data-active={post.saved}>
              <Bookmark size={17} />
              <span>{post.saved ? 'Saved' : 'Save'}</span>
            </button>
          )}
        </div>
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
                    const form = event.currentTarget
                    const body = String(new FormData(form).get('comment') ?? '').trim()
                    if (!body) return
                    await onComment(body)
                    form.reset()
                  } catch (error) {
                    setCommentError(error instanceof Error ? error.message : 'Comment could not be added.')
                  } finally {
                    setCommenting(false)
                  }
                }}
              >
                <input className="field" name="comment" maxLength={500} placeholder="Post your comment" aria-label="Comment" />
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
                {comments.map((comment) => (
                  <CommentRow key={comment._id} comment={comment} canReport={viewerReady} onReport={() => onReportComment(comment._id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function CommentRow({ comment, canReport, onReport }: { comment: PostComment; canReport: boolean; onReport: () => Promise<void> }) {
  const [reporting, setReporting] = useState(false)
  const [reportError, setReportError] = useState('')
  return (
    <article className="social-comment">
      <span className="avatar" aria-hidden="true">{initials(comment.authorDisplayName)}</span>
      <div className="min-w-0">
        <div className="social-comment-head">
          <strong>{comment.authorDisplayName}</strong>
          <span className="tabular">{formatTime(comment.createdAt)}</span>
          {canReport && (
            <button
              type="button"
              disabled={reporting}
              className="social-comment-report"
              onClick={async () => {
                setReporting(true)
                setReportError('')
                try {
                  await onReport()
                } catch (error) {
                  setReportError(error instanceof Error ? error.message : 'Comment could not be reported.')
                } finally {
                  setReporting(false)
                }
              }}
            >
              {reporting ? 'Reporting...' : 'Report'}
            </button>
          )}
        </div>
        <p>{comment.body}</p>
        {reportError && <p className="social-comment-error">{reportError}</p>}
      </div>
    </article>
  )
}

function PostMediaGrid({ media }: { media: PostMediaItem[] }) {
  return (
    <div className="social-media-grid" data-count={media.length}>
      {media.map((item) => (
        <div key={item.storageId} className="social-media-item">
          {item.url && item.kind === 'image' && <img src={item.url} alt="" loading="lazy" />}
          {item.url && item.kind === 'video' && <video src={item.url} controls playsInline preload="metadata" />}
        </div>
      ))}
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
