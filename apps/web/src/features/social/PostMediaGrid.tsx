import {
  useRef,
  useState,
  type SyntheticEvent,
} from 'react'
import { X } from 'lucide-react'
import { OpenableImage } from '../../design-system/molecules/OpenableImage'
import { Dialog } from '../../design-system/molecules/Dialog'
import { SocialVideoPlayer } from './SocialVideoPlayer'
import { mediaAspectStyle, rememberMediaAspect } from './fluidMedia'

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

export function PostMediaGrid(props: PostMediaGridProps) {
  const [mediaAspects, setMediaAspects] = useState<Record<string, number>>({})
  const preview = props.mode === 'preview'
  const gridClassName = [preview ? 'social-media-preview-grid' : 'social-media-grid', props.className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={gridClassName} data-count={props.media.length}>
      {preview
        ? props.media.map((item, index) => {
            const aspect = mediaAspects[item.previewUrl]
            const aspectStyle = mediaAspectStyle(aspect, '--social-media-aspect')
            const rememberAspect = (width: number, height: number) => (
              rememberMediaAspect(setMediaAspects, item.previewUrl, width, height)
            )

            return (
              <div
                className="social-media-preview"
                key={item.previewUrl}
                data-layout={aspect !== undefined && aspect < 1 ? 'portrait' : undefined}
                style={aspectStyle}
              >
                {item.kind === 'image' ? (
                  <img
                    src={item.previewUrl}
                    alt=""
                    onLoad={(event) => rememberMediaAspect(
                      setMediaAspects,
                      item.previewUrl,
                      event.currentTarget.naturalWidth,
                      event.currentTarget.naturalHeight,
                    )}
                  />
                ) : (
                  <video
                    src={item.previewUrl}
                    muted
                    playsInline
                    onLoadedMetadata={(event) => rememberAspect(event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
                  />
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
            )
          })
        : props.media.map((item, index) => {
          const aspect = mediaAspects[item.storageId]
          const aspectStyle = mediaAspectStyle(aspect, '--social-media-aspect')
          const openViewer = props.onOpenAt ? () => props.onOpenAt?.(index) : undefined
          const rememberAspect = (width: number, height: number) => (
            rememberMediaAspect(setMediaAspects, item.storageId, width, height)
          )

          return (
            <div
              key={item.storageId}
              className="social-media-item"
              data-layout={aspect !== undefined && aspect < 1 ? 'portrait' : undefined}
              style={aspectStyle}
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
                    onLoad={(event) => rememberImageAspect(event, rememberAspect)}
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
                  onLoad={(event) => rememberImageAspect(event, rememberAspect)}
                />
              )}
              {item.url && item.kind === 'video' && (
                <PostVideo
                  src={item.url}
                  label={`Video ${index + 1} shared in this post`}
                  onOpen={openViewer}
                  onSize={rememberAspect}
                />
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

function PostVideo({ label, src, onOpen, onSize }: {
  label: string
  src: string
  onOpen?: () => void
  onSize?: (width: number, height: number) => void
}) {
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
          onSize={onSize}
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

function rememberImageAspect(
  event: SyntheticEvent<HTMLImageElement>,
  remember: (width: number, height: number) => void,
) {
  const { naturalHeight, naturalWidth } = event.currentTarget
  remember(naturalWidth, naturalHeight)
}
