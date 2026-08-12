import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import type { DiscoveryHostViewModel } from '@/data/hostViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'
import { Avatar } from './Avatar'
import { AppText } from './Typography'

export function HostCard({ host }: { host: DiscoveryHostViewModel }) {
  const theme = useAppTheme()
  const metadata = [host.distanceLabel, host.source !== 'convex' ? 'Example profile' : undefined]
    .filter(Boolean)
    .join(' · ')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${host.name}, Friend Host in ${host.location}`}
      onPress={() => router.push({ pathname: '/host/[id]', params: { id: host.id, source: host.source } })}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.topRow}>
        <Avatar uri={host.imageUrl} name={host.name} size={72} />
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <AppText variant="heading" numberOfLines={1}>{host.name}</AppText>
            {host.verified && (
              <View accessibilityLabel="Identity verified" style={[styles.verifiedDot, { backgroundColor: theme.colors.self }]} />
            )}
          </View>
          <AppText variant="caption" color={theme.colors.textMuted}>{host.location}</AppText>
          {metadata ? <AppText variant="caption" color={theme.colors.textMuted}>{metadata}</AppText> : null}
        </View>
      </View>

      <AppText variant="bodyStrong" style={styles.tagline}>{host.intro}</AppText>

      <View style={[styles.threadRow, { borderTopColor: theme.colors.border }]}>
        <View style={[styles.thread, { backgroundColor: theme.colors.social }]} />
        <View style={styles.threadCopy}>
          <AppText variant="label" color={theme.colors.social}>STRENGTHS</AppText>
          <AppText variant="caption" numberOfLines={2}>{host.strengths.slice(0, 2).join(' · ')}</AppText>
        </View>
      </View>

      <View style={styles.footer}>
        <AppText variant="caption">
          {typeof host.rating === 'number' ? `★ ${host.rating} (${host.reviewCount ?? 0})` : 'No reviews yet'}
        </AppText>
        <AppText variant="label" color={theme.colors.social}>
          {host.source === 'convex' ? (host.rateLabel ?? (host.bookable ? 'VIEW PROFILE' : 'NOT BOOKABLE')) : 'DEMO - NOT BOOKABLE'}
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
