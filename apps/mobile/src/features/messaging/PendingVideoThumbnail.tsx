import { StyleSheet, View } from 'react-native'

/**
 * The web build has no native video surface for a paused first frame, so the
 * tray shows its play badge over a neutral tile. The clip still previews with
 * its file name and opens after sending.
 */
export function PendingVideoThumbnail({ label }: { uri: string; label: string }) {
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
