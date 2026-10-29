import { useVideoPlayer, VideoView } from 'expo-video'
import { StyleSheet } from 'react-native'

/**
 * Shows the first frame of a video the member picked so the composer tray
 * previews the clip instead of a generic file row. The player stays paused and
 * muted; playback begins only after the message is sent.
 */
export function PendingVideoThumbnail({ uri, label }: { uri: string; label: string }) {
  const player = useVideoPlayer(uri, (created) => {
    created.muted = true
    created.pause()
  })

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
