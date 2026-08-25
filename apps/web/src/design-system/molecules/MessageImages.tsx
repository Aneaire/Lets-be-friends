import { ImageViewerDialog } from './OpenableImage'

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
  return (
    <ImageViewerDialog
      open
      onClose={onClose}
      title={image.fileName}
      src={image.url}
      alt={image.fileName}
    />
  )
}
