import { useEffect, useId, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { ImagePlus, X } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Dialog } from '../../design-system/molecules/Dialog'
import { describeConvexError } from '../../lib/convexErrors'
import { ReviewPostPreview } from './ReviewPostCard'
import { ReviewStarPicker } from './ReviewStarPicker'

const MAX_REVIEW_PHOTOS = 4
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type DraftPhoto = { key: string; file: File; url: string }

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
  // Present only when the review can reach the feed, which is also the only
  // case where the live card is shown.
  companionName?: string
}) {
  const generateUploadUrl = useMutation(api.reviews.generateImageUploadUrl)
  const registerUpload = useMutation(api.reviews.registerImageUpload)
  const discardUpload = useMutation(api.reviews.discardImageUpload)
  const inputId = useId()
  const [rating, setRating] = useState<number | undefined>(undefined)
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState<DraftPhoto[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dragDepth = useRef(0)
  const photosRef = useRef(photos)
  photosRef.current = photos

  // Object URLs are owned by this draft, so drop them when the dialogs closes.
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

  const previewPhotos = photos.map((photo) => photo.url)

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Leave a review"
      description={companionName
        ? `This is how your review will appear in the feed. A rating on its own stays on ${companionName}'s profile.`
        : 'Your review is shared with the other person once you publish it.'}
      size="large"
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
      <div className="review-composer" data-has-preview={companionName ? 'true' : undefined}>
        <div className="review-composer-form">
          <ReviewStarPicker value={rating} onChange={setRating} disabled={busy} />

          <label className="review-composer-field">
            <span className="review-composer-label">Your note</span>
            <textarea
              className="field review-composer-note"
              value={body}
              onChange={(event) => setBody(event.currentTarget.value)}
              placeholder="What stood out about the experience?"
              maxLength={1000}
              rows={4}
              disabled={busy}
            />
            <span className="text-meta">{body.length}/1000</span>
          </label>

          <div
            className="review-drop-zone"
            data-dragging={dragging ? 'true' : undefined}
            data-disabled={busy ? 'true' : undefined}
            onDragEnter={(event) => {
              event.preventDefault()
              dragDepth.current += 1
              setDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault()
              dragDepth.current = Math.max(0, dragDepth.current - 1)
              if (dragDepth.current === 0) setDragging(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              dragDepth.current = 0
              setDragging(false)
              if (busy) return
              addFiles(Array.from(event.dataTransfer.files))
            }}
          >
            <input
              id={inputId}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                addFiles(Array.from(event.currentTarget.files ?? []))
                event.currentTarget.value = ''
              }}
            />
            <label htmlFor={inputId} className="review-drop-zone-target">
              <ImagePlus size={20} aria-hidden="true" />
              <span className="review-drop-zone-title">Drag photos here, or choose files</span>
              <span className="text-meta">JPEG, PNG, or WebP, up to 10 MB each. Up to {MAX_REVIEW_PHOTOS} photos.</span>
            </label>
            {photos.length > 0 && (
              <ul className="review-drop-zone-thumbs" aria-label="Selected photos">
                {photos.map((photo, index) => (
                  <li key={photo.key} className="review-photo-thumb">
                    <img src={photo.url} alt={`Selected photo ${index + 1}: ${photo.file.name}`} />
                    <button
                      type="button"
                      className="review-photo-thumb-remove"
                      aria-label={`Remove ${photo.file.name}`}
                      disabled={busy}
                      onClick={() => removePhoto(photo.key)}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="review-composer-error" role="alert">{error}</p>}
        </div>

        {companionName && (
          <div className="review-composer-preview">
            <span className="review-composer-label">How it will look</span>
            <ReviewPostPreview
              authorName={authorName}
              authorImageUrl={authorImageUrl}
              companionName={companionName}
              rating={rating ?? 0}
              body={body.trim() || undefined}
              imageUrls={previewPhotos}
            />
          </div>
        )}
      </div>
    </Dialog>
  )
}
