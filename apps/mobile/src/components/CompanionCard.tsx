import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import type { DiscoveryCompanionViewModel } from '@/data/companionViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'
import { Avatar } from './Avatar'
import { AppText } from './Typography'

export function CompanionCard({ companion }: { companion: DiscoveryCompanionViewModel }) {
  const theme = useAppTheme()
  const metadata = [companion.distanceLabel, companion.source !== 'convex' ? 'Example profile' : undefined]
    .filter(Boolean)
    .join(' · ')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${companion.name}, Companion in ${companion.location}`}
      onPress={() => router.push({ pathname: '/companion-profile/[id]', params: { id: companion.id, source: companion.source } })}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.topRow}>
        <Avatar uri={companion.imageUrl} name={companion.name} size={72} />
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <AppText variant="heading" numberOfLines={1}>{companion.name}</AppText>
            {companion.verified && (
              <View accessibilityLabel="Identity verified" style={[styles.verifiedDot, { backgroundColor: theme.colors.self }]} />
            )}
          </View>
          <AppText variant="caption" color={theme.colors.textMuted}>{companion.location}</AppText>
          {metadata ? <AppText variant="caption" color={theme.colors.textMuted}>{metadata}</AppText> : null}
        </View>
      </View>

      <AppText variant="bodyStrong" style={styles.tagline}>{companion.intro}</AppText>

      <View style={[styles.threadRow, { borderTopColor: theme.colors.border }]}>
        <View style={[styles.thread, { backgroundColor: theme.colors.social }]} />
        <View style={styles.threadCopy}>
          <AppText variant="label" color={theme.colors.social}>STRENGTHS</AppText>
          <AppText variant="caption" numberOfLines={2}>{companion.strengths.slice(0, 2).join(' · ')}</AppText>
        </View>
      </View>

      <View style={styles.footer}>
        <AppText variant="caption">
          {typeof companion.rating === 'number' ? `★ ${companion.rating} (${companion.reviewCount ?? 0})` : 'No reviews yet'}
        </AppText>
        <AppText variant="label" color={theme.colors.social}>
          {companion.source === 'convex' ? (companion.rateLabel ?? (companion.bookable ? 'VIEW PROFILE' : 'NOT BOOKABLE')) : 'DEMO - NOT BOOKABLE'}
        </AppText>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 16 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.995 }] },
  topRow: { flexDirection: 'row', gap: 14 },
  identity: { flex: 1, justifyContent: 'center', gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedDot: { width: 9, height: 9, borderRadius: 5 },
  tagline: { maxWidth: 330 },
  threadRow: { minHeight: 46, flexDirection: 'row', borderTopWidth: 1, paddingTop: 14, gap: 12 },
  thread: { width: 3, borderRadius: 2 },
  threadCopy: { flex: 1, gap: 3 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
})
