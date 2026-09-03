import {
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  type SyntheticEvent,
} from 'react'
import { X } from 'lucide-react'
import { OpenableImage } from '../../design-system/molecules/OpenableImage'

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

type PortraitAspectStyle = CSSProperties & {
  '--social-media-aspect'?: number
}

export function PostMediaGrid(props: PostMediaGridProps) {
  const [portraitAspects, setPortraitAspects] = useState<Record<string, number>>({})
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
        : props.media.map((item, index) => {
          const portraitAspect = portraitAspects[item.storageId]
          const portraitStyle: PortraitAspectStyle | undefined = portraitAspect
            ? { '--social-media-aspect': portraitAspect }
            : undefined

          return (
            <div
              key={item.storageId}
              className="social-media-item"
              data-layout={portraitAspect ? 'portrait' : undefined}
              style={portraitStyle}
            >
              {item.url && item.kind === 'image' && (
                <OpenableImage
                  src={item.url}
                  alt={`Image ${index + 1} shared in this post`}
                  openLabel={`Open post image ${index + 1}`}
                  viewerTitle={`Post image ${index + 1}`}
                  loading="lazy"
                  onLoad={(event) => rememberPortraitAspect(event, item.storageId, setPortraitAspects)}
                />
              )}
              {item.url && item.kind === 'video' && <video src={item.url} controls playsInline preload="metadata" />}
            </div>
          )
        })}
    </div>
  )
}

function rememberPortraitAspect(
  event: SyntheticEvent<HTMLImageElement>,
  storageId: string,
  setPortraitAspects: Dispatch<SetStateAction<Record<string, number>>>,
) {
  const { naturalHeight, naturalWidth } = event.currentTarget
  if (naturalWidth <= 0 || naturalHeight <= 0 || naturalWidth >= naturalHeight) return

  const aspect = naturalWidth / naturalHeight
  setPortraitAspects((current) => current[storageId] === aspect ? current : { ...current, [storageId]: aspect })
}
