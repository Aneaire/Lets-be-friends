import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ImagePlus } from 'lucide-react'
import { pollValidationError } from '@lets-be-friends/shared'
import { Dialog } from '../../design-system/molecules/Dialog'
import { describeConvexError } from '../../lib/convexErrors'
import { MentionField } from './MentionField'
import { PollComposer, emptyPollDraft, type PollDraft } from './PollComposer'
import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { PostMediaGrid } from './PostMediaGrid'
import { mediaKind, type SelectedMedia } from './postMediaUpload'

const noop = () => undefined

export type PostComposerMode = 'media' | 'poll'

export function PostComposerView({
  authorName,
  authorImageUrl,
  body,
  onBodyChange,
  media,
  onChooseMedia,
  onRemoveMedia,
  poll,
  onPollChange,
  dragging,
  onDraggingChange,
  busy,
  error,
  uploadsHint,
  bodyField,
}: {
  authorName: string
  authorImageUrl?: string | null
  body: string
  onBodyChange: (body: string) => void
  // The mention-aware field needs Convex, so the dialog supplies it and the
  // presentational view can render without a provider.
  bodyField: ReactNode
  media: readonly SelectedMedia[]
  onChooseMedia: (files: File[]) => void
  onRemoveMedia: (index: number) => void
  poll?: PollDraft
  onPollChange?: (next: PollDraft) => void
  dragging: boolean
  onDraggingChange: (dragging: boolean) => void
  busy: boolean
  error: string
  uploadsHint: string
}) {
  const inputId = useId()
  const dragDepth = useRef(0)

  return (
    <div
      className="post-editor"
      data-mode={poll ? 'poll' : 'media'}
      data-dragging={dragging ? 'true' : undefined}
      onDragEnter={(event) => {
        event.preventDefault()
        dragDepth.current += 1
        onDraggingChange(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) onDraggingChange(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        dragDepth.current = 0
        onDraggingChange(false)
        if (busy || poll) return
        onChooseMedia(Array.from(event.dataTransfer.files))
      }}
    >
      <input
        id={inputId}
        type="file"
        accept="image/*,video/*"
        multiple
        className="sr-only"
        aria-label="Add photos or video"
        disabled={busy}
        onChange={(event) => {
          onChooseMedia(Array.from(event.currentTarget.files ?? []))
          event.currentTarget.value = ''
        }}
      />
      <PostCard
        author={authorName}
        imageUrl={authorImageUrl}
        timestamp="Just now"
        className="social-post post-editor-card"
        aria-label="Write your post"
      >
        {bodyField}

        {poll ? (
          <PollComposer value={poll} onChange={onPollChange ?? noop} disabled={busy} />
        ) : (
          <>
            {media.length > 0 && (
              <PostMediaGrid mode="preview" media={media} onRemove={onRemoveMedia} className="post-editor-media" />
            )}
            <label
              htmlFor={inputId}
              className="post-editor-drop"
              data-compact={media.length > 0 ? 'true' : undefined}
            >
              <ImagePlus size={media.length > 0 ? 16 : 20} aria-hidden="true" />
              <span className="post-editor-drop-title">
                {dragging
                  ? 'Drop to add photos or video'
                  : media.length > 0
                    ? 'Add more photos or video'
                    : 'Drag photos or video here, or choose files'}
              </span>
              {media.length === 0 && <span className="text-meta">{uploadsHint}</span>}
            </label>
          </>
        )}

        {error && <p className="post-editor-error" role="alert">{error}</p>}

        <PostActionBar
          liked={false}
          likeCount={0}
          commentCount={0}
          saved={false}
          commentsOpen={false}
          likeDisabled
          commentsDisabled
          showSave
          onLike={noop}
          onToggleComments={noop}
          onSave={noop}
          onShare={noop}
        />
      </PostCard>
    </div>
  )
}

/**
 * The media and poll buttons open this dialog, which composes on the post card
 * itself so the author reads what members will.
 */
export function PostComposerDialog({
  open,
  mode,
  onClose,
  body,
  onBodyChange,
  authorName,
  authorImageUrl,
  mediaLimit,
  remainingUploads,
  onPost,
}: {
  open: boolean
  mode: PostComposerMode
  onClose: () => void
  body: string
  onBodyChange: (body: string) => void
  authorName: string
  authorImageUrl?: string | null
  mediaLimit: number
  remainingUploads: number
  onPost: (input: { body: string; media: SelectedMedia[]; poll?: PollDraft }) => Promise<void>
}) {
  const [media, setMedia] = useState<SelectedMedia[]>([])
  const [poll, setPoll] = useState<PollDraft | undefined>(undefined)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mediaRef = useRef(media)
  mediaRef.current = media

  function releaseMedia(items: readonly SelectedMedia[]) {
    for (const item of items) URL.revokeObjectURL(item.previewUrl)
  }

  // Each opening starts a fresh draft, and closing releases every preview URL.
  useEffect(() => {
    if (!open) return
    setPoll(mode === 'poll' ? emptyPollDraft() : undefined)
    setError('')
    return () => {
      releaseMedia(mediaRef.current)
      mediaRef.current = []
      setMedia([])
    }
  }, [open, mode])

  function chooseMedia(files: File[]) {
    setError('')
    const accepted: SelectedMedia[] = []
    const rejected: string[] = []
    for (const file of files) {
      if (media.length + accepted.length >= remainingUploads) {
        rejected.push(remainingUploads === 0
          ? 'You have used today\'s media uploads.'
          : `You can add ${remainingUploads} more ${remainingUploads === 1 ? 'item' : 'items'} today.`)
        break
      }
      const kind = mediaKind(file)
      if (!kind) {
        rejected.push(`${file.name} is not a photo or video.`)
        continue
      }
      accepted.push({ file, kind, previewUrl: URL.createObjectURL(file) })
    }
    if (accepted.length > 0) setMedia((current) => [...current, ...accepted])
    if (rejected.length > 0) setError(rejected[0])
  }

  function removeMedia(index: number) {
    setMedia((current) => {
      const target = current[index]
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((_, position) => position !== index)
    })
  }

  async function post() {
    setError('')
    // The poll fields carry their own validation message, so an invalid poll
    // simply does not publish.
    if (poll && pollValidationError(poll)) return
    if (!body.trim() && media.length === 0 && !poll) {
      setError('Write something, or add a photo, a video, or a poll first.')
      return
    }
    setBusy(true)
    try {
      await onPost({ body, media, poll })
      releaseMedia(media)
      setMedia([])
      setPoll(undefined)
      onClose()
    } catch (postError) {
      setError(postError instanceof Error ? describeConvexError(postError) : 'Post could not be shared.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={mode === 'poll' ? 'Add a poll' : 'Share an update'}
      description="Write it here. This is how your post will appear in the feed."
      size="large"
      className="post-composer-dialog"
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-neutral" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-social" onClick={() => void post()} disabled={busy}>
            {busy ? 'Posting…' : 'Post'}
          </button>
        </>
      )}
    >
      <PostComposerView
        authorName={authorName}
        authorImageUrl={authorImageUrl}
        body={body}
        onBodyChange={onBodyChange}
        media={media}
        onChooseMedia={chooseMedia}
        onRemoveMedia={removeMedia}
        poll={poll}
        onPollChange={setPoll}
        dragging={dragging}
        onDraggingChange={setDragging}
        busy={busy}
        error={error}
        uploadsHint={`${remainingUploads} of ${mediaLimit} daily media uploads left`}
        bodyField={(
          <MentionField
            value={body}
            onChange={onBodyChange}
            name="body"
            className="post-editor-body"
            maxLength={1000}
            placeholder="What could feel easier or better together?"
            ariaLabel="Post text"
            multiline
          />
        )}
      />
    </Dialog>
  )
}
