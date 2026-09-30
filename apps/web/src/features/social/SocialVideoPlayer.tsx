import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react'

export function formatVideoTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const total = Math.floor(totalSeconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const paddedSeconds = String(seconds).padStart(2, '0')
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
  return `${minutes}:${paddedSeconds}`
}

function playOptionalVideo(video: HTMLVideoElement) {
  try {
    const playback = video.play() as Promise<void> | undefined
    void playback?.catch(() => undefined)
  } catch {
    // jsdom and blocked autoplay have no playback; controls still work.
  }
}

/**
 * Facebook-style video player: play/pause, back/forward 10 seconds,
 * a seekable progress bar with elapsed/total time, volume, and expand.
 * Clicking the video surface toggles playback and reveals the controls.
 */
export function SocialVideoPlayer({
  src,
  label,
  autoPlay = false,
  loop = false,
  startAt = 0,
  initialMuted = true,
  muted,
  onMutedChange,
  onExpand,
  expandLabel,
  pauseWhenHidden = false,
  onSurfaceClick,
  onCurrentTimeChange,
  className = '',
}: {
  src: string
  label: string
  autoPlay?: boolean
  loop?: boolean
  startAt?: number
  initialMuted?: boolean
  muted?: boolean
  onMutedChange?: (muted: boolean) => void
  onExpand?: () => void
  expandLabel?: string
  pauseWhenHidden?: boolean
  onSurfaceClick?: () => void
  onCurrentTimeChange?: (currentTime: number) => void
  className?: string
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const hideControlsTimer = useRef<number | null>(null)
  const progressRafRef = useRef<number | null>(null)
  const userPausedRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(startAt)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [uncontrolledMuted, setUncontrolledMuted] = useState(initialMuted)
  const isMuted = muted ?? uncontrolledMuted

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideControlsTimer.current !== null) {
      window.clearTimeout(hideControlsTimer.current)
      hideControlsTimer.current = null
    }
  }, [])

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current !== null) window.clearTimeout(hideControlsTimer.current)
    hideControlsTimer.current = window.setTimeout(() => setControlsVisible(false), 2500)
  }, [])

  useEffect(() => () => {
    if (hideControlsTimer.current !== null) window.clearTimeout(hideControlsTimer.current)
    if (progressRafRef.current !== null) window.cancelAnimationFrame(progressRafRef.current)
  }, [])

  // The bar paints every animation frame while playing so it glides instead
  // of jumping between timeupdate events. Direct DOM writes avoid re-renders.
  const paintProgress = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const extent = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
    const percent = extent > 0 ? Math.min(100, Math.max(0, (video.currentTime / extent) * 100)) : 0
    if (fillRef.current) fillRef.current.style.width = `${percent}%`
    if (thumbRef.current) thumbRef.current.style.left = `${percent}%`
  }, [])

  useEffect(() => {
    if (!playing) {
      if (progressRafRef.current !== null) {
        window.cancelAnimationFrame(progressRafRef.current)
        progressRafRef.current = null
      }
      paintProgress()
      return
    }
    const tick = () => {
      paintProgress()
      progressRafRef.current = window.requestAnimationFrame(tick)
    }
    progressRafRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (progressRafRef.current !== null) {
        window.cancelAnimationFrame(progressRafRef.current)
        progressRafRef.current = null
      }
    }
  }, [paintProgress, playing])

  useEffect(() => {
    if (playing) scheduleHideControls()
    else showControls()
  }, [playing, scheduleHideControls, showControls])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !autoPlay) return
    if (startAt > 0) {
      try {
        video.currentTime = startAt
      } catch {
        // Seek before metadata loads; the loadedmetadata handler covers it.
      }
    }
    // When the feed observer drives playback, it handles the initial play so
    // offscreen videos never start. Without an observer, play on mount.
    if (pauseWhenHidden && 'IntersectionObserver' in window) return
    playOptionalVideo(video)
  }, [autoPlay, pauseWhenHidden, startAt])

  useEffect(() => {
    if (!pauseWhenHidden) return
    const stage = stageRef.current
    const video = videoRef.current
    if (!stage || !video || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6
      if (visible) {
        if (!video.paused || (!userPausedRef.current && autoPlay)) playOptionalVideo(video)
      } else {
        video.pause()
      }
    }, { threshold: [0, 0.6] })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [autoPlay, pauseWhenHidden])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.muted = isMuted
  }, [isMuted])

  function setMuted(next: boolean) {
    const video = videoRef.current
    if (video) video.muted = next
    if (onMutedChange) onMutedChange(next)
    else setUncontrolledMuted(next)
    showControls()
  }

  function togglePlayback() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      userPausedRef.current = false
      playOptionalVideo(video)
    } else {
      userPausedRef.current = true
      video.pause()
    }
    showControls()
  }

  function seekTo(next: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = next
    setCurrentTime(next)
    paintProgress()
    showControls()
  }

  function handleLoadedMetadata(event: React.SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget
    setDuration(video.duration)
    if (startAt > 0 && video.currentTime < startAt) {
      try {
        video.currentTime = startAt
        setCurrentTime(startAt)
      } catch {
        // Ignore seeks the browser rejects before data loads.
      }
    }
  }

  const seekMax = Number.isFinite(duration) && duration > 0 ? duration : 0
  const seekValue = Math.min(currentTime, seekMax)
  const seekPercent = seekMax > 0 ? Math.min(100, Math.max(0, (seekValue / seekMax) * 100)) : 0

  function handleSurfaceClick() {
    if (onSurfaceClick) {
      showControls()
      onSurfaceClick()
      return
    }
    togglePlayback()
  }

  return (
    <div
      ref={stageRef}
      className={`social-video-player ${className}`.trim()}
      data-controls-visible={controlsVisible || !playing}
      onMouseEnter={showControls}
      onMouseLeave={() => {
        if (playing) scheduleHideControls()
      }}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        loop={loop}
        muted={isMuted}
        playsInline
        preload="metadata"
        aria-label={label}
        onClick={handleSurfaceClick}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(event) => {
          const next = event.currentTarget.currentTime
          setCurrentTime(next)
          paintProgress()
          onCurrentTimeChange?.(next)
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          if (!loop) setPlaying(false)
        }}
      />
      <button
        type="button"
        className="social-video-mute-float"
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
        aria-pressed={!isMuted}
        onClick={() => setMuted(!isMuted)}
      >
        {isMuted ? <VolumeX size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
      </button>
      {!playing && !onSurfaceClick && (
        <button
          type="button"
          className="social-video-center-play"
          aria-label={`Play ${label}`}
          onClick={togglePlayback}
        >
          <Play size={30} aria-hidden="true" />
        </button>
      )}
      <div className="social-video-controls" role="group" aria-label={`Video controls for ${label}`}>
        <div className="social-video-main-row">
          <button
            type="button"
            className="social-video-button social-video-play"
            aria-label={playing ? `Pause ${label}` : `Play ${label}`}
            onClick={togglePlayback}
          >
            {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
          </button>
          <span className="social-video-live-time tabular" role="status">
            {formatVideoTime(currentTime)} of {formatVideoTime(duration)}
          </span>
          {onExpand && (
            <button
              type="button"
              className="social-video-button social-post-video-open"
              aria-label={expandLabel ?? `Open ${label}`}
              onClick={onExpand}
            >
              <Maximize size={14} aria-hidden="true" />
              <span aria-hidden="true">Expand</span>
            </button>
          )}
        </div>
        <div className="social-video-scrub">
          <div className="social-video-scrub-track" aria-hidden="true">
            <div ref={fillRef} className="social-video-scrub-fill" style={{ width: `${seekPercent}%` }} />
            <div ref={thumbRef} className="social-video-scrub-thumb" style={{ left: `${seekPercent}%` }} />
          </div>
          <input
            type="range"
            className="social-video-scrub-input"
            aria-label={`Seek ${label}`}
            min={0}
            max={seekMax}
            step={0.1}
            value={seekValue}
            onChange={(event) => seekTo(Number(event.currentTarget.value))}
          />
        </div>
      </div>
    </div>
  )
}
