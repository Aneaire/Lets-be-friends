import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import { CircleMarker } from './CircleMarker'

export function CircleCard({ circle }: { circle: {
  _id: string
  name: string
  purpose: string
  category: string
  memberCount: number
  mode: 'online' | 'in_person' | 'both'
  approximateArea?: string
  circleState?: string
  role?: string
  joinPolicy?: 'approval_required' | 'open'
  membershipState?: string
  iconUrl?: string
} }) {
  const theme = useAppTheme()
  const location = circle.approximateArea ?? (circle.mode === 'online' ? 'Online' : 'Area shared in Circle')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${circle.name} Circle`}
      onPress={() => router.push({ pathname: '/circles/[id]', params: { id: circle._id } } as never)}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }, pressed && styles.pressed]}>
      <View style={styles.titleRow}>
        <CircleMarker iconUrl={circle.iconUrl} name={circle.name} joined={circle.membershipState === 'active'} />
        <AppText variant="bodyStrong" style={styles.title}>{circle.name}</AppText>
        {circle.role && circle.role !== 'member' ? <AppText variant="caption" color={theme.colors.socialText}>{circle.role}</AppText> : null}
        {circle.circleState === 'archived' ? <AppText variant="caption" color={theme.colors.textMuted}>Archived</AppText> : null}
        {circle.joinPolicy === 'open' ? <AppText variant="caption" color={theme.colors.socialText}>Open join</AppText> : null}
      </View>
      <AppText color={theme.colors.textMuted} numberOfLines={2}>{circle.purpose}</AppText>
      <AppText variant="caption" color={theme.colors.textMuted}>{circle.category} · {circle.memberCount} members · {location}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  pressed: { opacity: 0.72 },
})
