import { StyleSheet, View } from 'react-native'

/**
 * The web build has no native video surface for a paused first frame, so the
 * tile shows its play badge over a neutral surface. Tapping opens the video.
 */
export function VideoThumbnail({ label }: { uri: string; label: string; onRatio?: (ratio: number) => void }) {
  return <View accessible accessibilityLabel={label} accessibilityRole="image" style={styles.thumbnail} />
}

const styles = StyleSheet.create({
  thumbnail: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
})
