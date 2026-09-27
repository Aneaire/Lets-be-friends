import {
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  type SyntheticEvent,
} from 'react'
import { X } from 'lucide-react'
import { OpenableImage } from '../../design-system/molecules/OpenableImage'
import { Dialog } from '../../design-system/molecules/Dialog'
import { SocialVideoPlayer } from './SocialVideoPlayer'

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
  onOpenAt?: (index: number) => void
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
          const openViewer = props.onOpenAt ? () => props.onOpenAt?.(index) : undefined

          return (
            <div
              key={item.storageId}
              className="social-media-item"
              data-layout={portraitAspect ? 'portrait' : undefined}
              style={portraitStyle}
            >
              {item.url && item.kind === 'image' && openViewer && (
                <button
                  type="button"
                  className="social-media-open"
                  onClick={openViewer}
                  aria-label={`Open post image ${index + 1} with description and comments`}
                >
                  <img
                    src={item.url}
                    alt={`Image ${index + 1} shared in this post`}
                    loading="lazy"
                    onLoad={(event) => rememberPortraitAspect(event, item.storageId, setPortraitAspects)}
                  />
                </button>
              )}
              {item.url && item.kind === 'image' && !openViewer && (
                <OpenableImage
                  src={item.url}
                  alt={`Image ${index + 1} shared in this post`}
                  openLabel={`Open post image ${index + 1}`}
                  viewerTitle={`Post image ${index + 1}`}
                  loading="lazy"
                  onLoad={(event) => rememberPortraitAspect(event, item.storageId, setPortraitAspects)}
                />
              )}
              {item.url && item.kind === 'video' && (
                <PostVideo src={item.url} label={`Video ${index + 1} shared in this post`} onOpen={openViewer} />
              )}
            </div>
          )
        })}
    </div>
  )
}

function playOptionalVideo(video: HTMLVideoElement) {
  const playback = video.play() as Promise<void> | undefined
  void playback?.catch(() => undefined)
}

function PostVideo({ label, src, onOpen }: { label: string; src: string; onOpen?: () => void }) {
  const inlineStageRef = useRef<HTMLDivElement>(null)
  const dialogTimeRef = useRef(0)
  const [muted, setMuted] = useState(true)
  const [startAt, setStartAt] = useState(0)
  const [open, setOpen] = useState(false)

  function openViewer() {
    const video = inlineStageRef.current?.querySelector('video')
    if (video) {
      video.pause()
      if (Number.isFinite(video.currentTime)) setStartAt(video.currentTime)
    }
    if (onOpen) {
      onOpen()
      return
    }
    setOpen(true)
  }

  function closeViewer() {
    setOpen(false)
    const video = inlineStageRef.current?.querySelector('video')
    if (video && Number.isFinite(dialogTimeRef.current)) {
      try {
        video.currentTime = dialogTimeRef.current
      } catch {
        // Ignore seeks the browser rejects before data loads.
      }
    }
  }

  return (
    <>
      <div ref={inlineStageRef} className="social-post-video">
        <SocialVideoPlayer
          src={src}
          label={label}
          autoPlay
          loop
          muted={muted}
          onMutedChange={setMuted}
          onExpand={openViewer}
          onSurfaceClick={openViewer}
          pauseWhenHidden
        />
      </div>
      <Dialog
        open={open}
        onClose={closeViewer}
        title={label}
        closeLabel="Close video"
        size="large"
        className="social-video-viewer"
        bodyClassName="social-video-viewer-stage"
        dismissOnBodyPointerDown
      >
        <div className="social-post-video social-post-video-expanded">
          <SocialVideoPlayer
            src={src}
            label={`${label}, expanded`}
            autoPlay
            loop
            startAt={startAt}
            initialMuted={muted}
            onMutedChange={setMuted}
            onCurrentTimeChange={(next) => {
              dialogTimeRef.current = next
            }}
          />
        </div>
      </Dialog>
    </>
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
