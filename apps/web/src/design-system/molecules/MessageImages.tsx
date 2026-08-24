import { Dialog } from './Dialog'

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
    <Dialog
      open
      onClose={onClose}
      title={image.fileName}
      closeLabel="Close image"
      size="large"
      className="direct-image-viewer"
      bodyClassName="direct-image-viewer-stage"
    >
      <img src={image.url} alt={image.fileName} />
    </Dialog>
  )
}
