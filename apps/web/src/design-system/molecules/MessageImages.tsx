import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export type MessageImage = {
  storageId: string
  url: string
  fileName: string
}

export function MessageImageGallery({ images, onOpen }: { images: MessageImage[]; onOpen: (image: MessageImage) => void }) {
  return (
    <div className="direct-message-images" data-count={images.length}>
      {images.map((image) => (
        <button
          key={image.storageId}
          type="button"
          className="direct-message-image"
          aria-label={`Open ${image.fileName}`}
          onClick={() => onOpen(image)}
        >
          <img src={image.url} alt={image.fileName} loading="lazy" />
        </button>
      ))}
    </div>
  )
}

export function MessageImageViewer({ image, onClose }: { image: MessageImage; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  return (
    <div className="direct-image-viewer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="direct-image-viewer" role="dialog" aria-modal="true" aria-labelledby="direct-image-viewer-title">
        <header className="direct-image-viewer-header">
          <h2 id="direct-image-viewer-title">{image.fileName}</h2>
          <button ref={closeRef} type="button" className="direct-image-viewer-close" aria-label="Close image" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="direct-image-viewer-stage">
          <img src={image.url} alt={image.fileName} />
        </div>
      </section>
    </div>
  )
}
