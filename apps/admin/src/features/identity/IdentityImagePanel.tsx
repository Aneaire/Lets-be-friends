import { useAction } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../../web/convex/_generated/api'
import { describeConvexError } from '../../../../web/src/lib/convexErrors'

export type IdentityImageKind = 'id_front' | 'id_back' | 'selfie'

const imageLabels: Record<IdentityImageKind, string> = {
  id_front: 'Front of ID',
  id_back: 'Back of ID',
  selfie: 'Current selfie',
}

export type IdentityEvidenceImage = {
  kind: IdentityImageKind
  label: string
  url: string | null
  error: string | null
}

export function imageKindLabel(kind: IdentityImageKind) {
  return imageLabels[kind]
}

export function formatImageAccessTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function accessSummary({ expired, loading, hasImages, expiresAt }: { expired: boolean; loading: boolean; hasImages: boolean; expiresAt: number | null }) {
  if (expired) return 'Image access expired. Reload to view them again.'
  if (loading && !hasImages) return 'Loading identity images...'
  if (expiresAt) return `Images are visible until ${formatImageAccessTime(expiresAt)}.`
  return 'Identity images'
}

// Presentational: every retained image is rendered as a thumbnail that opens
// larger. Shared by the review dialog and its stories. The optional callbacks
// keep it renderable with nothing wired up, which is what the stories do.
export function IdentityEvidenceGrid({
  images = [],
  expectedKinds = [],
  expiresAt = null,
  loading = false,
  expired = false,
  onReload = () => undefined,
  onOpenImage = () => undefined,
}: {
  images?: IdentityEvidenceImage[]
  /** Placeholders to draw while the first batch loads, so the grid never collapses. */
  expectedKinds?: IdentityImageKind[]
  expiresAt?: number | null
  loading?: boolean
  expired?: boolean
  onReload?: () => void
  onOpenImage?: (kind: IdentityImageKind) => void
}) {
  const placeholders = loading && images.length === 0 ? expectedKinds : []
  return (
    <div className="identity-image-review">
      <div className="identity-image-review-head">
        <p className="text-meta">{accessSummary({ expired, loading, hasImages: images.length > 0, expiresAt })}</p>
        <button type="button" className="btn btn-neutral btn-sm" onClick={onReload} disabled={loading}>
          {loading ? 'Loading...' : 'Reload images'}
        </button>
      </div>
      <ul className="identity-image-grid" aria-busy={loading || undefined}>
        {images.map((image) => (
          <li key={image.kind}>
            <button
              type="button"
              className="identity-image-thumb"
              onClick={() => onOpenImage(image.kind)}
              disabled={!image.url}
              aria-label={image.url ? `Open ${image.label} larger` : undefined}
            >
              {image.url
                ? <img src={image.url} alt="" />
                : <span className="identity-image-unavailable">{image.error ?? 'Not available'}</span>}
              <span className="identity-image-caption">{image.label}</span>
            </button>
          </li>
        ))}
        {placeholders.map((kind) => (
          // Decorative: the summary line already announces that images are loading.
          <li key={`skeleton-${kind}`} className="identity-image-skeleton" aria-hidden="true">
            <span className="identity-image-skeleton-media" />
            <span className="identity-image-skeleton-caption" />
          </li>
        ))}
        {images.length === 0 && placeholders.length === 0 && !loading && <li><p className="text-meta">Images will appear here.</p></li>}
      </ul>
    </div>
  )
}

// Presentational modal. It owns its own Escape handling and scroll lock so it
// behaves the same wherever it is rendered.
export function IdentityImageLightbox({ label, url, onClose }: { label: string; url: string; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="identity-image-lightbox" role="dialog" aria-modal="true" aria-label={`${label} at full size`}>
      <div className="identity-image-lightbox-bar">
        <strong className="text-h3">{label}</strong>
        <div className="identity-image-lightbox-actions">
          <a className="btn btn-neutral btn-sm" href={url} target="_blank" rel="noreferrer">Open in new tab</a>
          <button type="button" className="btn btn-neutral btn-sm" onClick={onClose} autoFocus>Close</button>
        </div>
      </div>
      <div className="identity-image-lightbox-stage" onClick={onClose} role="presentation">
        <img src={url} alt="" />
      </div>
    </div>
  )
}

// Every kind the app can store, used when the caller does not know which images
// exist yet. That happens between a frontend deploy and the backend deploy that
// adds the retained-kinds field, and trying all three degrades safely: a kind
// that is not retained comes back as an unavailable thumbnail.
const allImageKinds: IdentityImageKind[] = ['id_front', 'id_back', 'selfie']

// Fetches every retained image for one submission as soon as the review dialog
// opens, so a reviewer never has to click to see the evidence. Image bytes stay
// in this tab as object URLs and are released on unmount, on reload, and when the
// access grant expires.
export function IdentityImagePanel({ verificationRequestId, imageKinds }: { verificationRequestId: any; imageKinds?: IdentityImageKind[] }) {
  const readImage = useAction(api.identityRecords.readReviewImage)
  const readImageRef = useRef(readImage)
  readImageRef.current = readImage

  const [images, setImages] = useState<IdentityEvidenceImage[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<IdentityImageKind | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [expired, setExpired] = useState(false)
  const objectUrls = useRef<string[]>([])
  const kinds = imageKinds ?? allImageKinds
  const kindKey = kinds.join(',')

  const releaseImages = useCallback(() => {
    for (const url of objectUrls.current) URL.revokeObjectURL(url)
    objectUrls.current = []
  }, [])

  const load = useCallback(async () => {
    const requested = kindKey ? (kindKey.split(',') as IdentityImageKind[]) : []
    if (requested.length === 0) {
      setImages([])
      return
    }
    setLoading(true)
    setExpired(false)
    // New bytes are collected before the previous ones are released, so a reload
    // never blanks the images the reviewer is already looking at.
    const alreadyHeld = objectUrls.current.length
    const loaded = await Promise.all(requested.map(async (kind): Promise<IdentityEvidenceImage & { displayUntil: number | null }> => {
      const label = imageKindLabel(kind)
      try {
        const result = await readImageRef.current({ verificationRequestId, kind })
        const url = URL.createObjectURL(new Blob([result.bytes], { type: result.contentType }))
        objectUrls.current.push(url)
        return { kind, label, url, error: null, displayUntil: result.displayUntil }
      } catch (caught) {
        return { kind, label, url: null, error: describeConvexError(caught), displayUntil: null }
      }
    }))
    for (const url of objectUrls.current.slice(0, alreadyHeld)) URL.revokeObjectURL(url)
    objectUrls.current = objectUrls.current.slice(alreadyHeld)
    setImages(loaded.map(({ kind, label, url, error }) => ({ kind, label, url, error })))
    const grants = loaded.map((image) => image.displayUntil).filter((value): value is number => typeof value === 'number')
    setExpiresAt(grants.length > 0 ? Math.min(...grants) : null)
    setLoading(false)
  }, [kindKey, verificationRequestId])

  useEffect(() => {
    void load()
    return releaseImages
  }, [load, releaseImages])

  // The access grant is deliberately short lived. When it lapses the images are
  // released and the reviewer reloads them, which records a fresh access.
  useEffect(() => {
    if (expiresAt === null) return
    const timer = window.setTimeout(() => {
      releaseImages()
      setImages([])
      setExpanded(null)
      setExpiresAt(null)
      setExpired(true)
    }, Math.max(0, expiresAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [expiresAt, releaseImages])

  const closeExpanded = useCallback(() => setExpanded(null), [])

  if (kindKey === '') {
    return <p className="text-meta mt-3">No identity images are retained for this attempt.</p>
  }

  const expandedImage = images.find((image) => image.kind === expanded) ?? null

  return (
    <div className="mt-3">
      <IdentityEvidenceGrid
        images={images}
        expectedKinds={kinds}
        expiresAt={expiresAt}
        loading={loading}
        expired={expired}
        onReload={() => void load()}
        onOpenImage={setExpanded}
      />
      {expandedImage?.url && (
        <IdentityImageLightbox label={expandedImage.label} url={expandedImage.url} onClose={closeExpanded} />
      )}
    </div>
  )
}
