import { useState, type ImgHTMLAttributes, type KeyboardEvent } from 'react'
import { Dialog } from './Dialog'

type OpenableImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'onClick' | 'onKeyDown' | 'role' | 'tabIndex'> & {
  alt: string
  fullSrc?: string
  openLabel?: string
  viewerTitle?: string
}

export function OpenableImage({
  alt,
  className = '',
  fullSrc,
  openLabel,
  src,
  viewerTitle,
  ...imageProps
}: OpenableImageProps) {
  const [open, setOpen] = useState(false)
  const label = openLabel ?? (alt ? `Open image: ${alt}` : 'Open image')
  const title = viewerTitle ?? (alt || 'Image')

  function handleKeyDown(event: KeyboardEvent<HTMLImageElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setOpen(true)
  }

  return (
    <>
      <img
        {...imageProps}
        src={src}
        alt={alt}
        className={`ds-openable-image ${className}`.trim()}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {src ? (
        <ImageViewerDialog
          open={open}
          src={fullSrc ?? src}
          alt={alt}
          title={title}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

export function ImageViewerDialog({
  alt,
  onClose,
  open,
  src,
  title,
}: {
  alt: string
  onClose: () => void
  open: boolean
  src: string
  title: string
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      closeLabel="Close image"
      size="large"
      className="direct-image-viewer"
      bodyClassName="direct-image-viewer-stage"
    >
      <img src={src} alt={alt} />
    </Dialog>
  )
}
