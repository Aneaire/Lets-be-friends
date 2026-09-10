import { useQuery } from 'convex/react'
import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { circleIndexPresentation } from './circlePresentation'

export function MyCirclesModule() {
  const theme = useAppTheme()
  const mine = useQuery(mobileApi.circles.mine)
  const active = circleIndexPresentation(mine, []).activeHome
  return <View style={[styles.module, { borderColor: theme.colors.border }]} accessibilityLabel="My circles">
    <View style={styles.titleRow}><AppText variant="bodyStrong">My circles</AppText><EntryLink label="See all" onPress={() => router.push('/circles' as never)} /></View>
    {mine === undefined ? <AppText variant="caption" color={theme.colors.textMuted}>Loading circles...</AppText> : active.length === 0 ? <AppText variant="caption" color={theme.colors.textMuted}>Join a Circle to see its active conversations here.</AppText> : active.map((circle) => <Pressable key={circle._id} accessibilityRole="button" accessibilityLabel={`Open ${circle.name} Circle`} onPress={() => router.push({ pathname: '/circles/[id]', params: { id: circle._id } } as never)} style={({ pressed }) => [styles.circleRow, pressed && styles.pressed]}><View style={[styles.marker, { backgroundColor: theme.colors.socialControl }]} /><View style={styles.copy}><AppText variant="bodyStrong" numberOfLines={1}>{circle.name}</AppText><AppText variant="caption" color={theme.colors.textMuted}>{circle.memberCount} members</AppText></View></Pressable>)}
  </View>
}

export function DiscoverCirclesEntry() {
  const theme = useAppTheme()
  return <Pressable accessibilityRole="button" accessibilityLabel="Discover circles" accessibilityHint="Browse groups built around shared interests" onPress={() => router.push('/circles' as never)} style={({ pressed }) => [styles.discovery, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }, pressed && styles.pressed]}><View style={[styles.bigMarker, { backgroundColor: theme.colors.socialSoft, borderColor: theme.colors.socialText }]} /><View style={styles.copy}><AppText variant="bodyStrong">Discover circles</AppText><AppText variant="caption" color={theme.colors.textMuted}>Find familiar groups around shared interests.</AppText></View><AppText variant="heading">›</AppText></Pressable>
}

function EntryLink({ label, onPress }: { label: string; onPress: () => void }) { const theme = useAppTheme(); return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress}><AppText variant="caption" color={theme.colors.socialText}>{label}</AppText></Pressable> }

const styles = StyleSheet.create({
  module: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, gap: 7, marginVertical: 10 }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, circleRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, marker: { width: 9, height: 9, borderRadius: 5 }, copy: { flex: 1, minWidth: 0 }, discovery: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 }, bigMarker: { width: 38, height: 38, borderRadius: 19, borderWidth: 1 }, pressed: { opacity: 0.72 },
})
