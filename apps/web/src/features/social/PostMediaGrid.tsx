import {
  useRef,
  useEffect,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
  type SyntheticEvent,
} from 'react'
import { Volume2, VolumeX, X } from 'lucide-react'
import { OpenableImage } from '../../design-system/molecules/OpenableImage'
import { Dialog } from '../../design-system/molecules/Dialog'

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

type VideoProgressStyle = CSSProperties & {
  '--video-progress': string
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
              {item.url && item.kind === 'video' && (
                <PostVideo src={item.url} label={`Video ${index + 1} shared in this post`} />
              )}
            </div>
          )
        })}
    </div>
  )
}

function PostVideo({ label, src }: { label: string; src: string }) {
  const inlineStageRef = useRef<HTMLDivElement>(null)
  const inlineVideoRef = useRef<HTMLVideoElement>(null)
  const dialogVideoRef = useRef<HTMLVideoElement>(null)
  const inlineVisibleRef = useRef(true)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [muted, setMuted] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const stage = inlineStageRef.current
    const video = inlineVideoRef.current
    if (!stage || !video || !('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6
      inlineVisibleRef.current = visible
      if (open) return
      if (visible) void video.play()
      else video.pause()
    }, { threshold: [0, 0.6] })

    observer.observe(stage)
    return () => observer.disconnect()
  }, [open])

  function openViewer() {
    const video = inlineVideoRef.current
    if (video) video.pause()
    setOpen(true)
  }

  function handleVideoKeyDown(event: KeyboardEvent<HTMLVideoElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openViewer()
  }

  function closeViewer() {
    const dialogVideo = dialogVideoRef.current
    if (dialogVideo) setCurrentTime(dialogVideo.currentTime)
    setOpen(false)
    window.requestAnimationFrame(() => {
      const video = inlineVideoRef.current
      if (!video) return
      video.currentTime = dialogVideo?.currentTime ?? video.currentTime
      if (inlineVisibleRef.current) void video.play()
    })
  }

  function toggleMuted() {
    setMuted((value) => !value)
  }

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
  const progressStyle: VideoProgressStyle = { '--video-progress': `${progress * 100}%` }

  return (
    <>
      <div ref={inlineStageRef} className="social-post-video">
        <video
          ref={inlineVideoRef}
          src={src}
          autoPlay
          loop
          muted={muted}
          playsInline
          preload="metadata"
          role="button"
          tabIndex={0}
          aria-label={label}
          onClick={openViewer}
          onKeyDown={handleVideoKeyDown}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        />
        <div className="social-post-video-controls">
          <button
            type="button"
            className="social-post-video-mute"
            aria-label={muted ? 'Unmute video' : 'Mute video'}
            aria-pressed={!muted}
            onClick={toggleMuted}
          >
            {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </button>
        </div>
        <div className="social-post-video-progress" style={progressStyle} aria-hidden="true" />
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
          <video
            ref={dialogVideoRef}
            src={src}
            autoPlay
            loop
            muted={muted}
            playsInline
            preload="metadata"
            aria-label={`${label}, expanded`}
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = currentTime
              setDuration(event.currentTarget.duration)
            }}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          />
          <div className="social-post-video-controls">
            <button
              type="button"
              className="social-post-video-mute"
              aria-label={muted ? 'Unmute video' : 'Mute video'}
              aria-pressed={!muted}
              onClick={toggleMuted}
            >
              {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
            </button>
          </div>
          <div className="social-post-video-progress" style={progressStyle} aria-hidden="true" />
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
