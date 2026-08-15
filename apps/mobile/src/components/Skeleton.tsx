import { StyleSheet, View, type ViewStyle } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: ViewStyle['width']; height?: number; radius?: number; style?: ViewStyle }) {
  const theme = useAppTheme()
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.base, { width, height, borderRadius: radius, backgroundColor: theme.colors.border }, style]} />
}

export function FeedSkeleton() {
  return <View accessibilityLabel="Loading community updates" style={styles.card}><View style={styles.row}><Skeleton width={44} height={44} radius={22} /><View style={styles.copy}><Skeleton width="48%" /><Skeleton width="32%" height={12} /></View></View><Skeleton height={18} /><Skeleton width="82%" height={18} /><Skeleton height={180} radius={12} /></View>
}

const styles = StyleSheet.create({
  base: { opacity: 0.72 },
  card: { gap: 12, paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, gap: 8 },
})
