import { useState } from 'react'
import { useMutation } from 'convex/react'
import { ImagePlus, X } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export function ReviewForm({
  onReview,
}: {
  onReview: (rating: number, body?: string, imageUploadId?: Id<'reviewMediaUploads'>) => Promise<void>
}) {
  const generateUploadUrl = useMutation(api.reviews.generateImageUploadUrl)
  const registerUpload = useMutation(api.reviews.registerImageUpload)
  const discardUpload = useMutation(api.reviews.discardImageUpload)
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  return (
    <form
      className="review-form"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
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
            Number(data.get('rating')),
            String(data.get('body') || '') || undefined,
            uploadId,
          )
          published = true
          form.reset()
          setPhoto(null)
        } catch (reviewError) {
          setError(reviewError instanceof Error ? reviewError.message : 'Review could not be published.')
        } finally {
          if (uploadId && !published) await discardUpload({ uploadId, storageId }).catch(() => undefined)
          setBusy(false)
        }
      }}
    >
      <select name="rating" className="field review-form-rating" defaultValue="5" aria-label="Review rating">
        <option value="5">5 stars</option>
        <option value="4">4 stars</option>
        <option value="3">3 stars</option>
        <option value="2">2 stars</option>
        <option value="1">1 star</option>
      </select>
      <input name="body" className="field review-form-note" placeholder="Write about the experience" maxLength={1000} />
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
      <button className="btn btn-social-quiet btn-sm" disabled={busy}>{busy ? 'Publishing...' : 'Leave review'}</button>
      {error && <p className="review-form-error" role="alert">{error}</p>}
    </form>
  )
}
