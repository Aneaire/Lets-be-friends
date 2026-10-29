import { useEvent } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'

/**
 * Shows the first frame of a video so the composer tray and message bubble
 * preview the clip instead of a generic file row. The player stays paused and
 * muted; playback starts only in the full-screen viewer.
 */
export function VideoThumbnail({ uri, label, onRatio }: { uri: string; label: string; onRatio?: (ratio: number) => void }) {
  const player = useVideoPlayer(uri, (created) => {
    created.muted = true
    created.pause()
  })
  const { videoTrack } = useEvent(player, 'videoTrackChange', { videoTrack: player.videoTrack })

  useEffect(() => {
    const size = videoTrack?.size
    if (size && size.width > 0 && size.height > 0) onRatio?.(size.width / size.height)
  }, [onRatio, videoTrack])

  return (
    <VideoView
      accessibilityLabel={label}
      accessibilityRole="image"
      contentFit="cover"
      nativeControls={false}
      player={player}
      style={styles.thumbnail}
    />
  )
}

const styles = StyleSheet.create({
  thumbnail: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
  },
})
