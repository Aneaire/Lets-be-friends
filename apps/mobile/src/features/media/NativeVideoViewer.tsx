import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, StyleSheet } from 'react-native'

import { VideoViewerShell } from './VideoViewerShell'
import {
  VIDEO_VIEWER_ERROR_MESSAGE,
  VIDEO_VIEWER_UNAVAILABLE_MESSAGE,
  isVideoViewerOpen,
  nextVideoRetryToken,
  normalizeVideoUrl,
  pauseVideoPlayerBestEffort,
  resolveVideoViewerAccessibilityLabel,
  resolveVideoViewerTitle,
  type NativeVideoViewerProps,
} from './videoPresentation'

export type { NativeVideoViewerProps }

/**
 * Outer gate: while no URL is open this returns null without registering
 * listeners, so closing releases everything. The active viewer (valid
 * playback or invalid error state) mounts only while open.
 */
export function NativeVideoViewer({ url, title, onClose }: NativeVideoViewerProps) {
  if (!isVideoViewerOpen(url)) return null
  const safeUrl = normalizeVideoUrl(url)
  if (!safeUrl) {
    return (
      <>
        <VideoBackHandler onClose={onClose} />
        <VideoViewerShell
          title={resolveVideoViewerTitle(title)}
          error={VIDEO_VIEWER_UNAVAILABLE_MESSAGE}
          onClose={onClose}
          onRetry={onClose}
        >
          <></>
        </VideoViewerShell>
      </>
    )
  }
  return <ActiveVideoPlayer url={safeUrl} title={title} onClose={onClose} />
}

function VideoBackHandler({ onClose }: { onClose: () => void }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRef.current()
      return true
    })
    return () => backSubscription.remove()
  }, [])

  return null
}

function ActiveVideoPlayer({ url, title, onClose }: { url: string; title?: string | null; onClose: () => void }) {
  const viewerTitle = resolveVideoViewerTitle(title)
  const [retryToken, setRetryToken] = useState(0)
  const [failed, setFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    setFailed(false)
  }, [url, retryToken])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        pauseVideoPlayerBestEffort(videoRef.current)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useFocusEffect(
    useCallback(() => {
      return () => {
        pauseVideoPlayerBestEffort(videoRef.current)
      }
    }, []),
  )

  useEffect(() => {
    return () => {
      pauseVideoPlayerBestEffort(videoRef.current)
    }
  }, [])

  const handleClose = useCallback(() => {
    pauseVideoPlayerBestEffort(videoRef.current)
    onClose()
  }, [onClose])

  const handleRetry = useCallback(() => {
    setFailed(false)
    setRetryToken(nextVideoRetryToken)
  }, [])

  return (
    <>
      <VideoBackHandler onClose={handleClose} />
      <VideoViewerShell
        title={viewerTitle}
        error={failed ? VIDEO_VIEWER_ERROR_MESSAGE : null}
        onClose={handleClose}
        onRetry={handleRetry}
      >
        {/* Web playback uses the browser video element with built-in controls. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          key={retryToken}
          ref={videoRef}
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={resolveVideoViewerAccessibilityLabel(title)}
          onError={() => setFailed(true)}
          style={styles.video}
        />
      </VideoViewerShell>
    </>
  )
}

const styles = StyleSheet.create({
  video: { width: '100%', height: '100%', backgroundColor: '#000' },
})
