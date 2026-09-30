import { router } from 'expo-router'
import { Image, Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import { circlePreviewCardSummary, type CirclePreviewCardView } from './circlePresentation'

export function CirclePreviewCard({ circle }: { circle: CirclePreviewCardView }) {
  const theme = useAppTheme()
  const summary = circlePreviewCardSummary(circle)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Preview ${circle.name} Circle`}
      accessibilityHint="Read the Circle preview before joining"
      onPress={() => router.push({ pathname: '/circles/[id]', params: { id: circle._id } } as never)}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }, pressed && styles.pressed]}>
      <View style={styles.titleRow}>
        <View style={[styles.marker, { backgroundColor: theme.colors.socialControl }]} />
        <AppText variant="bodyStrong" style={styles.title}>{circle.name}</AppText>
        {summary.openJoin ? <AppText variant="caption" color={theme.colors.socialText}>Open join</AppText> : null}
        {summary.archived ? <AppText variant="caption" color={theme.colors.textMuted}>Archived</AppText> : null}
      </View>
      <AppText color={theme.colors.textMuted} numberOfLines={2}>{circle.purpose}</AppText>
      <AppText variant="caption" color={theme.colors.textMuted}>{summary.meta}</AppText>
      <AppText variant="caption" color={theme.colors.socialText}>{summary.hostLine}</AppText>
    </Pressable>
  )
}

export function CirclePreviewCover({ uri, label }: { uri?: string; label: string }) {
  if (!uri) return null
  return <Image source={{ uri }} style={styles.cover} accessibilityLabel={label} />
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marker: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1 },
  cover: { width: '100%', aspectRatio: 4, borderRadius: 12 },
  pressed: { opacity: 0.72 },
})
