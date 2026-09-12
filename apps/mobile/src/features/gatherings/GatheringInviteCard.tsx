import { useQuery } from 'convex/react'
import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi, type GatheringId } from '@/backend/client'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { formatGatheringWhen, gatheringSeatLabel } from './gatheringPresentation'

export function GatheringInviteCard({ gatheringId }: { gatheringId: GatheringId | string }) {
  const theme = useAppTheme()
  const gathering = useQuery(mobileApi.gatherings.get, { gatheringId: gatheringId as GatheringId })
  const title = gathering ? `${gathering.category} with ${gathering.companionDisplayName}` : 'Gathering invite'
  const detail = gathering
    ? `${formatGatheringWhen(gathering.startsAt)} · ${gatheringSeatLabel(gathering.confirmedCount, gathering.capacity)}`
    : 'Open to see the details'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint="Open the Gathering to request a seat"
      onPress={() => router.push({ pathname: '/gatherings/[id]', params: { id: String(gatheringId) } } as never)}
      style={({ pressed }) => [styles.card, { borderColor: theme.colors.socialText, backgroundColor: theme.colors.surfaceRaised }, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <AppText variant="bodyStrong" numberOfLines={1}>{title}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={2}>{detail}</AppText>
      </View>
      <AppText variant="caption" color={theme.colors.socialText}>View Gathering</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { gap: 4, borderWidth: 1, borderRadius: density.controlRadius, padding: density.compactCardPadding, marginTop: 6 },
  copy: { gap: 2 },
  pressed: { opacity: 0.72 },
})
