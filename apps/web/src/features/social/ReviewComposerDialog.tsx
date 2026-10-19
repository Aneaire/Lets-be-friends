import { useEffect, useId, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { ImagePlus, X } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Dialog } from '../../design-system/molecules/Dialog'
import { describeConvexError } from '../../lib/convexErrors'
import { PostActionBar } from './PostActionBar'
import { PostCard } from './PostCard'
import { ReviewStarPicker } from './ReviewStarPicker'

const MAX_REVIEW_PHOTOS = 4
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const noop = () => undefined

type DraftPhoto = { key: string; file: File; url: string }
export type DraftPhotoView = { key: string; url: string; name: string }

export function ReviewComposerView({
  authorName,
  authorImageUrl,
  companionName,
  rating,
  body,
  photos,
  busy,
  dragging,
  error,
  onRate,
  onBodyChange,
  onChooseFiles,
  onRemovePhoto,
  onDraggingChange,
}: {
  authorName: string
  authorImageUrl?: string | null
  companionName?: string
  rating?: number
  body: string
  photos: readonly DraftPhotoView[]
  busy: boolean
  dragging: boolean
  error: string
  onRate: (rating: number) => void
  onBodyChange: (body: string) => void
  onChooseFiles: (files: File[]) => void
  onRemovePhoto: (key: string) => void
  onDraggingChange: (dragging: boolean) => void
}) {
  const inputId = useId()
  const dragDepth = useRef(0)

  const fileInput = (
    <input
      id={inputId}
      type="file"
      multiple
      accept="image/jpeg,image/png,image/webp"
      className="sr-only"
      disabled={busy}
      onChange={(event) => {
        onChooseFiles(Array.from(event.currentTarget.files ?? []))
        event.currentTarget.value = ''
      }}
    />
  )

  return (
    <div
      className="review-editor"
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
        if (busy) return
        onChooseFiles(Array.from(event.dataTransfer.files))
      }}
    >
      {fileInput}
      <PostCard
        author={authorName}
        imageUrl={authorImageUrl}
        timestamp="Just now"
        className="social-review-card review-editor-card"
        aria-label="Write your review"
        meta={companionName ? (
          <>
            <span aria-hidden="true" className="ds-post-meta-separator">·</span>
            <span className="social-review-companion">Shared an experience with {companionName}</span>
          </>
        ) : undefined}
      >
        <ReviewStarPicker value={rating} onChange={onRate} disabled={busy} />
        {rating ? null : <p className="review-editor-hint">Tap a star to rate the experience.</p>}

        <label className="review-editor-note-field">
          <span className="sr-only">Your note</span>
          <textarea
            className="review-editor-note"
            value={body}
            onChange={(event) => onBodyChange(event.currentTarget.value)}
            placeholder="Say a little about the experience. This is what members read."
            maxLength={1000}
            rows={3}
            disabled={busy}
          />
        </label>

        {photos.length > 0 && (
          <ul
            className="social-review-image-grid review-editor-photos"
            data-count={Math.min(photos.length, 4)}
            aria-label="Selected photos"
          >
            {photos.map((photo, index) => (
              <li key={photo.key} className="review-editor-photo">
                <img src={photo.url} alt={`Selected photo ${index + 1}: ${photo.name}`} />
                <button
                  type="button"
                  className="review-photo-thumb-remove"
                  aria-label={`Remove ${photo.name}`}
                  disabled={busy}
                  onClick={() => onRemovePhoto(photo.key)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {photos.length < MAX_REVIEW_PHOTOS && (
          <label
            htmlFor={inputId}
            className="review-editor-drop"
            data-compact={photos.length > 0 ? 'true' : undefined}
          >
            <ImagePlus size={photos.length > 0 ? 16 : 20} aria-hidden="true" />
            <span className="review-editor-drop-title">
              {dragging
                ? 'Drop to add photos'
                : photos.length > 0
                  ? 'Add more photos'
                  : 'Drag photos here, or choose files'}
            </span>
            {photos.length === 0 && (
              <span className="text-meta">JPEG, PNG, or WebP, up to 10 MB each. Up to {MAX_REVIEW_PHOTOS} photos.</span>
            )}
          </label>
        )}

        {error && <p className="review-editor-error" role="alert">{error}</p>}

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
 * The composer is the review card: the stars, the note, and the photos are
 * edited where they will be read, and the dialog publishes from its footer.
 */
export function ReviewComposerDialog({
  open,
  onClose,
  onSubmit,
  authorName,
  authorImageUrl,
  companionName,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (rating: number, body: string | undefined, imageUploadIds: Id<'reviewMediaUploads'>[]) => Promise<void>
  authorName: string
  authorImageUrl?: string | null
  // Present only when the review can reach the feed.
  companionName?: string
}) {
  const generateUploadUrl = useMutation(api.reviews.generateImageUploadUrl)
  const registerUpload = useMutation(api.reviews.registerImageUpload)
  const discardUpload = useMutation(api.reviews.discardImageUpload)
  const [rating, setRating] = useState<number | undefined>(undefined)
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState<DraftPhoto[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const photosRef = useRef(photos)
  photosRef.current = photos

  // Object URLs belong to this draft, so release them when the dialog closes.
  useEffect(() => {
    if (open) return
    return () => {
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.url)
      photosRef.current = []
      setPhotos([])
    }
  }, [open])

  function addFiles(incoming: File[]) {
    setError('')
    const accepted: DraftPhoto[] = []
    const rejected: string[] = []
    for (const file of incoming) {
      if (photos.length + accepted.length >= MAX_REVIEW_PHOTOS) {
        rejected.push(`Reviews can include up to ${MAX_REVIEW_PHOTOS} photos.`)
        break
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        rejected.push(`${file.name} is not a JPEG, PNG, or WebP image.`)
        continue
      }
      if (file.size > MAX_PHOTO_BYTES) {
        rejected.push(`${file.name} is larger than 10 MB.`)
        continue
      }
      accepted.push({ key: `${file.name}-${file.lastModified}-${accepted.length}`, file, url: URL.createObjectURL(file) })
    }
    if (accepted.length > 0) setPhotos((current) => [...current, ...accepted])
    if (rejected.length > 0) setError(rejected[0])
  }

  function removePhoto(key: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.key === key)
      if (target) URL.revokeObjectURL(target.url)
      return current.filter((photo) => photo.key !== key)
    })
  }

  async function publish() {
    if (!rating) {
      setError('Pick a star rating first.')
      return
    }
    setBusy(true)
    setError('')
    const uploads: { uploadId: Id<'reviewMediaUploads'>; storageId?: Id<'_storage'> }[] = []
    try {
      for (const photo of photos) {
        const grant = await generateUploadUrl({})
        const tracked: { uploadId: Id<'reviewMediaUploads'>; storageId?: Id<'_storage'> } = { uploadId: grant.uploadId }
        uploads.push(tracked)
        const response = await fetch(grant.uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': photo.file.type },
          body: photo.file,
        })
        if (!response.ok) throw new Error(`${photo.file.name} could not be uploaded.`)
        const result = await response.json() as { storageId: Id<'_storage'> }
        tracked.storageId = result.storageId
        await registerUpload({ uploadId: tracked.uploadId, storageId: result.storageId })
      }
      await onSubmit(rating, body.trim() || undefined, uploads.map((upload) => upload.uploadId))
      for (const photo of photos) URL.revokeObjectURL(photo.url)
      setRating(undefined)
      setBody('')
      setPhotos([])
      onClose()
    } catch (cause) {
      for (const upload of uploads) {
        await discardUpload({ uploadId: upload.uploadId, storageId: upload.storageId }).catch(() => undefined)
      }
      setError(cause instanceof Error ? describeConvexError(cause) : 'Review could not be published.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Leave a review"
      description={companionName
        ? `Write it here. This is how your review will appear in the feed. A rating on its own stays on ${companionName}'s profile.`
        : 'Write it here. Your review is shared with the other person once you publish it.'}
      size="large"
      className="review-composer-dialog"
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-neutral" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-social" onClick={() => void publish()} disabled={busy || !rating}>
            {busy ? 'Publishing…' : 'Publish review'}
          </button>
        </>
      )}
    >
      <ReviewComposerView
        authorName={authorName}
        authorImageUrl={authorImageUrl}
        companionName={companionName}
        rating={rating}
        body={body}
        photos={photos.map((photo) => ({ key: photo.key, url: photo.url, name: photo.file.name }))}
        busy={busy}
        dragging={dragging}
        error={error}
        onRate={setRating}
        onBodyChange={setBody}
        onChooseFiles={addFiles}
        onRemovePhoto={removePhoto}
        onDraggingChange={setDragging}
      />
    </Dialog>
  )
}
