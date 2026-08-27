import { StyleSheet, View, type ViewStyle } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: ViewStyle['width']; height?: number; radius?: number; style?: ViewStyle }) {
  const theme = useAppTheme()
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.base, { width, height, borderRadius: radius, backgroundColor: theme.colors.border }, style]} />
}

export function HomeHeaderActionsSkeleton() {
  return (
    <View accessibilityLabel="Loading account actions" style={styles.headerActions}>
      <Skeleton width={44} height={44} radius={16} />
      <Skeleton width={38} height={38} radius={19} />
    </View>
  )
}

export function PostComposerSkeleton() {
  const theme = useAppTheme()
  return (
    <View accessibilityLabel="Loading post composer" style={[styles.composer, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
      <View style={[styles.composerPrompt, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <Skeleton width="72%" height={16} />
      </View>
      <View style={[styles.composerMedia, { borderColor: theme.colors.border }]}>
        <Skeleton width={22} height={22} radius={5} />
      </View>
    </View>
  )
}

export function FeedSkeleton() {
  const theme = useAppTheme()
  return (
    <View accessibilityLabel="Loading community update" style={[styles.card, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}>
      <View style={styles.row}>
        <Skeleton width={44} height={44} radius={22} />
        <View style={styles.copy}>
          <Skeleton width="48%" />
          <Skeleton width="30%" height={12} />
        </View>
        <Skeleton width={24} height={12} radius={6} />
      </View>
      <View style={styles.body}>
        <Skeleton height={18} />
        <Skeleton width="84%" height={18} />
      </View>
      <View style={styles.postActions}>
        <Skeleton width={54} height={24} radius={12} />
        <Skeleton width={54} height={24} radius={12} />
        <Skeleton width={24} height={24} radius={6} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: { opacity: 0.72 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  composer: { minHeight: 54, marginTop: 4, padding: 6, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
  composerPrompt: { minHeight: 40, flex: 1, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, justifyContent: 'center' },
  composerMedia: { width: 44, height: 44, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  card: { gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, gap: 8 },
  body: { gap: 6 },
  postActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 2 },
})
