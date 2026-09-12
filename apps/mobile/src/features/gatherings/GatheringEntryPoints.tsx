import { useQuery } from 'convex/react'
import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import { formatGatheringWhen, gatheringIndexPresentation, gatheringSeatLabel } from './gatheringPresentation'

export function MyGatheringsModule() {
  const theme = useAppTheme()
  const mine = useQuery(mobileApi.gatherings.mine)
  const index = gatheringIndexPresentation(mine)
  const active = [...index.hosting, ...index.joined].filter((row) => row.state !== 'cancelled').slice(0, 3)
  return (
    <View style={[styles.module, { borderColor: theme.colors.border }]} accessibilityLabel="My Gatherings">
      <View style={styles.titleRow}>
        <AppText variant="bodyStrong">My Gatherings</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="See all Gatherings" hitSlop={8} onPress={() => router.push('/gatherings' as never)}><AppText variant="caption" color={theme.colors.socialText}>See all</AppText></Pressable>
      </View>
      {mine === undefined
        ? <AppText variant="caption" color={theme.colors.textMuted}>Loading Gatherings...</AppText>
        : active.length === 0
          ? <AppText variant="caption" color={theme.colors.textMuted}>Host or join a Gathering to see it here.</AppText>
          : active.map((gathering) => (
            <Pressable
              key={gathering._id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${gathering.category} Gathering`}
              onPress={() => router.push({ pathname: '/gatherings/[id]', params: { id: gathering._id } } as never)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.marker, { backgroundColor: theme.colors.socialControl }]} />
              <View style={styles.copy}>
                <AppText variant="bodyStrong" numberOfLines={1}>{gathering.category}</AppText>
                <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{formatGatheringWhen(gathering.startsAt)} · {gatheringSeatLabel(gathering.confirmedCount, gathering.capacity)}</AppText>
              </View>
            </Pressable>
          ))}
    </View>
  )
}

export function DiscoverGatheringsEntry() {
  const theme = useAppTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Discover Gatherings"
      accessibilityHint="Host or join a Companion experience with other members"
      onPress={() => router.push('/gatherings' as never)}
      style={({ pressed }) => [styles.discovery, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }, pressed && styles.pressed]}
    >
      <View style={[styles.bigMarker, { backgroundColor: theme.colors.socialSoft, borderColor: theme.colors.socialText }]} />
      <View style={styles.copy}>
        <AppText variant="bodyStrong">Gatherings</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Host a Companion experience and invite others, or join one.</AppText>
      </View>
      <AppText variant="heading">›</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  module: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, gap: 7, marginVertical: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  marker: { width: 9, height: 9, borderRadius: 5 },
  copy: { flex: 1, minWidth: 0 },
  discovery: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bigMarker: { width: 38, height: 38, borderRadius: 19, borderWidth: 1 },
  pressed: { opacity: 0.72 },
})
