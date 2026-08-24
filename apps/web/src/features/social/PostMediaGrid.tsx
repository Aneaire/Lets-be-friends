import { X } from 'lucide-react'

type MediaKind = 'image' | 'video'

export type DisplayPostMediaItem = {
  storageId: string
  kind: MediaKind
  url: string | null
}

export type PreviewPostMediaItem = {
  previewUrl: string
  kind: MediaKind
}

type DisplayPostMediaGridProps = {
  media: readonly DisplayPostMediaItem[]
  mode?: 'display'
  className?: string
}

type PreviewPostMediaGridProps = {
  media: readonly PreviewPostMediaItem[]
  mode: 'preview'
  className?: string
  onRemove: (index: number) => void
}

export type PostMediaGridProps = DisplayPostMediaGridProps | PreviewPostMediaGridProps

export function PostMediaGrid(props: PostMediaGridProps) {
  const preview = props.mode === 'preview'
  const gridClassName = [preview ? 'social-media-preview-grid' : 'social-media-grid', props.className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={gridClassName} data-count={props.media.length}>
      {preview
        ? props.media.map((item, index) => (
            <div className="social-media-preview" key={item.previewUrl}>
              {item.kind === 'image' ? (
                <img src={item.previewUrl} alt="" />
              ) : (
                <video src={item.previewUrl} muted playsInline />
              )}
              <button
                type="button"
                className="social-media-remove"
                onClick={() => props.onRemove(index)}
                aria-label="Remove media"
              >
                <X size={14} />
              </button>
            </div>
          ))
        : props.media.map((item) => (
            <div key={item.storageId} className="social-media-item">
              {item.url && item.kind === 'image' && <img src={item.url} alt="" loading="lazy" />}
              {item.url && item.kind === 'video' && <video src={item.url} controls playsInline preload="metadata" />}
            </div>
          ))}
    </div>
  )
}
