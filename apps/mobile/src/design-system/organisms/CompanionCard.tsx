import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { discoveryResultIntro } from '@lets-be-friends/shared'

import type { DiscoveryCompanionViewModel } from '@/data/companionViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { Avatar } from '@/design-system/atoms/Avatar'
import { AppText } from '@/design-system/atoms/Typography'

export function CompanionCard({ companion }: { companion: DiscoveryCompanionViewModel }) {
  const theme = useAppTheme()
  const format = companion.sessionModes.map((mode) => mode === 'in_person' ? 'In person' : 'Online').join(' + ')

  const isCompanion = companion.kind !== 'member'
  const intro = discoveryResultIntro(companion.kind, companion.intro)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isCompanion ? `View ${companion.name}, Companion in ${companion.location}` : `View ${companion.name}, member`}
      onPress={() => router.push((isCompanion
        ? { pathname: '/companion-profile/[id]', params: { id: companion.id } }
        : { pathname: '/member-profile/[id]', params: { id: companion.userId ?? companion.id } }) as never)}
      style={({ pressed }) => [styles.row, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }, pressed && styles.pressed]}>
      <Avatar uri={companion.imageUrl} name={companion.name} size={48} />
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <AppText variant="bodyStrong" numberOfLines={1}>{companion.name}</AppText>
          {companion.verified ? <View accessibilityLabel="Identity verified" style={[styles.verified, { backgroundColor: theme.colors.textMuted }]} /> : null}
        </View>
        <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{isCompanion ? [companion.location, format, companion.distanceLabel].filter(Boolean).join(' · ') : 'Member'}</AppText>
        {intro ? <AppText numberOfLines={1} style={styles.intro}>{intro}</AppText> : null}
        {isCompanion ? (
          <View style={styles.meta}>
            <AppText variant="caption" color={theme.colors.textMuted}>{typeof companion.rating === 'number' && companion.reviewCount ? `★ ${companion.rating.toFixed(1)} (${companion.reviewCount})` : 'New Companion'}</AppText>
            {companion.rateLabel ? <AppText variant="caption" color={theme.colors.socialText} style={styles.rate}>{companion.rateLabel}</AppText> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  content: { flex: 1, gap: density.textPairGap },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  verified: { width: 8, height: 8, borderRadius: 4 },
  intro: { fontSize: 14, lineHeight: 19 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: density.textPairGap },
  rate: { fontWeight: '700' },
  pressed: { opacity: 0.68 },
})
