import { useEffect, useMemo, useState } from 'react'

import { ImageViewerDialog } from '../../design-system/molecules/OpenableImage'

// Owns the object URL for a chosen File or a captured Blob and revokes it when
// the source changes or the preview unmounts.
export function useIdentityPhotoUrl(value: Blob | null) {
  const url = useMemo(() => (value ? URL.createObjectURL(value) : null), [value])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return url
}

// Renders one selected or captured photo so the member can confirm the exact
// image before it leaves their device. The photo opens at full size, because a
// legible ID and a clear selfie are part of the check. Pass an empty alt when
// the visible caption already names the photo.
export function IdentityPhotoFigure({ className, alt, label, name, detail, url }: { className: string; alt: string; label: string; name?: string; detail?: string; url: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <figure className={className}>
        <button type="button" className="identity-photo-open" aria-label={`Open ${label} larger`} onClick={() => setOpen(true)}>
          <img src={url} alt={alt} />
        </button>
        {(name || detail) && <figcaption><strong>{name}</strong>{detail && <small>{detail}</small>}</figcaption>}
      </figure>
      <ImageViewerDialog open={open} onClose={() => setOpen(false)} src={url} alt={alt} title={label} />
    </>
  )
}

// Shows the exact photos that will be sent for review, so the member checks the
// images and the details together. Renders nothing when only stored images
// remain, because those are not readable from the member session.
export function IdentityPhotoSummary({ front, back, selfie }: { front: File | null; back: File | null; selfie: Blob | null }) {
  if (!front && !back && !selfie) return null
  return (
    <div className="identity-photo-summary">
      <span className="label">Photos for review</span>
      <ul className="identity-photo-summary-grid">
        {front && <IdentityPhotoSummaryItem label="Front of ID" value={front} />}
        {back && <IdentityPhotoSummaryItem label="Back of ID" value={back} />}
        {selfie && <IdentityPhotoSummaryItem label="Current selfie" value={selfie} />}
      </ul>
      <p className="text-meta">These are the photos the safety team will see with your details. Open one to check it at full size.</p>
    </div>
  )
}

function IdentityPhotoSummaryItem({ label, value }: { label: string; value: Blob }) {
  const url = useIdentityPhotoUrl(value)
  if (!url) return null
  // The caption names the photo, so the image itself stays decorative and the
  // button carries the accessible name.
  return <li><IdentityPhotoFigure className="identity-photo-summary-item" alt="" label={label} name={label} url={url} /></li>
}
