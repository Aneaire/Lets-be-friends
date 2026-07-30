import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { Bookmark, Flag, Heart, ImagePlus, MessageCircle, Pencil, Send, Trash2, UserPlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/social')({ component: SocialPage })

type FeedPost = NonNullable<ReturnType<typeof useQuery<typeof api.social.feed>>>[number]
type PostComment = NonNullable<ReturnType<typeof useQuery<typeof api.social.commentsForPost>>>[number]
type FeedFilter = 'all' | 'following' | 'saved'
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

export function SocialPage() {
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer)
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')
  const posts = useQuery(api.social.feed, { filter: viewer ? feedFilter : 'all' }) as FeedPost[] | undefined
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
  const toggleFollow = useMutation(api.social.toggleFollow)
  const report = useMutation(api.reports.create)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedMediaRef = useRef<SelectedMedia[]>([])
  const fallbackName = viewer?.displayName ?? 'New friend'
  const mediaLimit = mediaUsage?.limit ?? 5
  const remainingUploads = mediaUsage?.remaining ?? mediaLimit

  selectedMediaRef.current = selectedMedia

  useEffect(() => () => {
    selectedMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
  }, [])

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
            <p className="eyebrow">Community</p>
            <h1 className="text-h2 mt-1">Home</h1>
          </div>
          <Link to="/discover" className="btn btn-neutral btn-sm">Find Friend Hosts</Link>
        </header>

        <div className="social-feed-tabs" role="tablist" aria-label="Social feed">
          {(['all', 'following', 'saved'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={feedFilter === filter}
              className="social-feed-tab"
              data-active={feedFilter === filter}
              disabled={filter !== 'all' && !viewer}
              title={filter !== 'all' && !viewer ? 'Sign in to use this feed' : undefined}
              onClick={() => {
                setError('')
                setFeedFilter(filter)
              }}
            >
              {filter[0].toUpperCase() + filter.slice(1)}
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
              <textarea
                name="body"
                className="social-composer-input"
                maxLength={1000}
                placeholder="What would you like to share?"
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

        {posts === undefined && <SocialTimelineSkeleton />}
        {posts && posts.length === 0 && (
          <div className="empty-state social-feed-empty">
            <p className="empty-state-title">No {feedFilter === 'all' ? 'posts' : `${feedFilter} posts`} yet.</p>
            <p className="text-meta">{feedFilter === 'all' ? 'Share the first community update.' : `Posts in your ${feedFilter} feed will appear here.`}</p>
          </div>
        )}
        {posts && posts.length > 0 && (
          <div className="social-feed">
            {posts.map((post) => (
              <PostRow
                key={post._id}
                post={post}
                viewerReady={Boolean(viewer)}
                onComment={async (body) => {
                    await createComment({ postId: post._id, body })
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
                }}
                onSave={async () => {
                  await toggleSave({ postId: post._id })
                  setNotice(post.saved ? 'Post removed from saved.' : 'Post saved.')
                }}
                onFollow={async () => {
                  await toggleFollow({ userId: post.authorId })
                  setNotice(post.followingAuthor ? 'Member unfollowed.' : 'Member followed.')
                }}
                onReport={async () => {
                  await report({ targetType: 'post', targetId: post._id, reason: 'Post needs safety review' })
                  setNotice('Report sent to safety review.')
                }}
                onReportComment={async (commentId) => {
                  await report({ targetType: 'comment', targetId: commentId, reason: 'Comment needs safety review' })
                  setNotice('Comment report sent to safety review.')
                }}
              />
            ))}
          </div>
        )}
      </section>
    </main>
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
  viewerReady,
  onComment,
  onEdit,
  onDelete,
  onLike,
  onSave,
  onFollow,
  onReport,
  onReportComment,
}: {
  post: FeedPost
  viewerReady: boolean
  onComment: (body: string) => Promise<void>
  onEdit: (body: string) => Promise<void>
  onDelete: () => Promise<void>
  onLike: () => Promise<void>
  onSave: () => Promise<void>
  onFollow: () => Promise<void>
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

  return (
    <article className="social-post">
      <span className="avatar avatar-lg social-post-avatar" aria-hidden="true">{initials(post.authorDisplayName)}</span>
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
              <>
                <button type="button" onClick={onFollow} className="btn btn-social-quiet btn-sm">
                  <UserPlus size={14} />
                  {post.followingAuthor ? 'Following' : 'Follow'}
                </button>
                <button type="button" onClick={onReport} className="social-icon-button social-danger-button" aria-label="Report post" title="Report post">
                  <Flag size={15} />
                </button>
              </>
            ) : null}
          </div>
        </div>
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
            <span>{post.likeCount}</span>
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
