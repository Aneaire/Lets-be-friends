import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Eye, ImagePlus, X } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel';
import { describeConvexError } from '../../lib/convexErrors'
import { ReviewPreviewDialog } from '../social/ReviewPreviewDialog'

export function ReviewForm({
  onReview,
  preview,
}: {
  onReview: (rating: number, body?: string, imageUploadId?: Id<'reviewMediaUploads'>) => Promise<void>
  // Only the member's review of a Companion reaches the feed, so only that
  // surface offers the preview and names the Companion on the card.
  preview?: { companionName: string }
}) {
  const generateUploadUrl = useMutation(api.reviews.generateImageUploadUrl)
  const registerUpload = useMutation(api.reviews.registerImageUpload)
  const discardUpload = useMutation(api.reviews.discardImageUpload)
  const viewer = useQuery(api.users.viewer)
  const [rating, setRating] = useState('5')
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | undefined>(undefined)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // One object URL per selected photo, released as soon as it is replaced.
  useEffect(() => {
    if (!photo || typeof URL.createObjectURL !== 'function') {
      setPhotoPreviewUrl(undefined)
      return
    }
    const url = URL.createObjectURL(photo)
    setPhotoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  return (
    <form
      className="review-form"
      onSubmit={async (event) => {
        event.preventDefault()
        let uploadId: Id<'reviewMediaUploads'> | undefined
        let storageId: Id<'_storage'> | undefined
        let published = false
        setBusy(true)
        setError('')
        try {
          if (photo) {
            const grant = await generateUploadUrl({})
            uploadId = grant.uploadId
            const response = await fetch(grant.uploadUrl, {
              method: 'POST',
              headers: { 'Content-Type': photo.type },
              body: photo,
            })
            if (!response.ok) throw new Error('Review photo could not be uploaded.')
            const result = await response.json() as { storageId: Id<'_storage'> }
            storageId = result.storageId
            await registerUpload({ uploadId, storageId })
          }
          await onReview(
            Number(rating),
            body.trim() || undefined,
            uploadId,
          )
          published = true
          setRating('5')
          setBody('')
          setPhoto(null)
        } catch (reviewError) {
          setError(reviewError instanceof Error ? describeConvexError(reviewError) : 'Review could not be published.')
        } finally {
          if (uploadId && !published) await discardUpload({ uploadId, storageId }).catch(() => undefined)
          setBusy(false)
        }
      }}
    >
      <select
        name="rating"
        className="field review-form-rating"
        value={rating}
        onChange={(event) => setRating(event.currentTarget.value)}
        aria-label="Review rating"
      >
        <option value="5">5 stars</option>
        <option value="4">4 stars</option>
        <option value="3">3 stars</option>
        <option value="2">2 stars</option>
        <option value="1">1 star</option>
      </select>
      <input
        name="body"
        className="field review-form-note"
        value={body}
        onChange={(event) => setBody(event.currentTarget.value)}
        placeholder="Write about the experience"
        maxLength={1000}
      />
      <label className="btn btn-neutral btn-sm review-photo-button">
        <ImagePlus size={16} aria-hidden="true" />
        {photo ? 'Change photo' : 'Add photo'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
        />
      </label>
      {photo && (
        <span className="review-photo-selection">
          <span>{photo.name}</span>
          <button type="button" onClick={() => setPhoto(null)} aria-label="Remove review photo"><X size={14} /></button>
        </span>
      )}
      {preview && (
        <button
          type="button"
          className="btn btn-neutral btn-sm"
          onClick={() => setPreviewOpen(true)}
        >
          <Eye size={16} aria-hidden="true" />
          Preview
        </button>
      )}
      <button className="btn btn-social-quiet btn-sm" disabled={busy}>{busy ? 'Publishing...' : 'Leave review'}</button>
      {error && <p className="review-form-error" role="alert">{error}</p>}
      {preview && (
        <ReviewPreviewDialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          authorName={viewer?.displayName ?? 'You'}
          authorImageUrl={viewer?.profileImageUrl}
          companionName={preview.companionName}
          rating={Number(rating)}
          body={body.trim() || undefined}
          imageUrl={photoPreviewUrl}
        />
      )}
    </form>
  )
}
