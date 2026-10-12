import { useEvent } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, BackHandler, StyleSheet } from 'react-native'

import { VideoViewerShell } from './VideoViewerShell'
import {
  VIDEO_VIEWER_ERROR_MESSAGE,
  VIDEO_VIEWER_UNAVAILABLE_MESSAGE,
  isVideoViewerOpen,
  nextVideoRetryToken,
  normalizeVideoUrl,
  pauseVideoPlayerBestEffort,
  resolveVideoViewerTitle,
  shouldPauseVideoForAppState,
  shouldReplaceVideoSource,
  type NativeVideoViewerProps,
} from './videoPresentation'

export type { NativeVideoViewerProps }

/**
 * Outer gate: while no URL is open this returns null without creating a
 * player or registering listeners, so closing releases everything. The active
 * viewer (valid playback or invalid error state) mounts only while open.
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

  const player = useVideoPlayer(url, (created) => {
    created.loop = false
    created.staysActiveInBackground = false
  })

  const { status } = useEvent(player, 'statusChange', { status: player.status })

  const sourceRef = useRef({ url, retryToken })
  useEffect(() => {
    const next = { url, retryToken }
    const previous = sourceRef.current
    sourceRef.current = next
    if (shouldReplaceVideoSource(previous, next)) {
      void player.replaceAsync(url).catch(() => undefined)
    }
  }, [player, url, retryToken])

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (shouldPauseVideoForAppState(nextState)) {
        pauseVideoPlayerBestEffort(player)
      }
    })
    return () => appStateSubscription.remove()
  }, [player])

  useFocusEffect(
    useCallback(() => {
      return () => {
        pauseVideoPlayerBestEffort(player)
      }
    }, [player]),
  )

  useEffect(() => {
    return () => {
      pauseVideoPlayerBestEffort(player)
    }
  }, [player])

  const handleClose = useCallback(() => {
    pauseVideoPlayerBestEffort(player)
    onClose()
  }, [onClose, player])

  const handleRetry = useCallback(() => {
    setRetryToken(nextVideoRetryToken)
  }, [])

  return (
    <>
      <VideoBackHandler onClose={handleClose} />
      <VideoViewerShell
        title={viewerTitle}
        error={status === 'error' ? VIDEO_VIEWER_ERROR_MESSAGE : null}
        onClose={handleClose}
        onRetry={handleRetry}
      >
        <VideoView
          player={player}
          nativeControls
          contentFit="contain"
          fullscreenOptions={{ enable: true }}
          accessibilityLabel={`${viewerTitle} video`}
          style={styles.video}
        />
      </VideoViewerShell>
    </>
  )
}

const styles = StyleSheet.create({
  video: { flex: 1, width: '100%', backgroundColor: '#000' },
})
