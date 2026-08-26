import { Pressable, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Avatar } from '@/design-system/atoms/Avatar'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

export type CompanionRecommendationView = {
  reason: string
  displayName: string
  mode: 'online' | 'in_person' | 'both'
  intro: string
  strengths: string[]
  reviewCount: number
  rating: number
}

export function CompanionRecommendationCard({ companion, onPress }: { companion: CompanionRecommendationView; onPress: () => void }) {
  const theme = useAppTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open Companion profile for ${companion.displayName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }, pressed && styles.pressed]}>
      <AppText variant="caption" color={theme.colors.socialText}>{companion.reason}</AppText>
      <View style={styles.identity}>
        <Avatar name={companion.displayName} size={48} />
        <View style={styles.identityCopy}>
          <AppText variant="bodyStrong">{companion.displayName}</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>{companion.mode === 'both' ? 'Online and in person' : companion.mode === 'online' ? 'Online sessions' : 'In-person sessions'}</AppText>
        </View>
      </View>
      <AppText>{companion.intro}</AppText>
      <AppText variant="caption" color={theme.colors.socialText}>{companion.strengths.join(' · ')}</AppText>
      <AppText variant="caption" color={theme.colors.textMuted}>{companion.reviewCount ? `★ ${companion.rating.toFixed(1)} from ${companion.reviewCount} reviews` : 'New Companion'}</AppText>
    </Pressable>
  )
}

export function GuidanceFeedCard({ reason, title, body, actionLabel, onPress }: { reason: string; title: string; body: string; actionLabel: string; onPress: () => void }) {
  const theme = useAppTheme()
  return (
    <View style={[styles.card, styles.guidanceCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <AppText variant="caption" color={theme.colors.socialText}>{reason}</AppText>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText color={theme.colors.textMuted}>{body}</AppText>
      <ActionButton label={actionLabel} onPress={onPress} secondary style={styles.guidanceAction} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 7 },
  guidanceCard: { gap: 6 },
  guidanceAction: { minHeight: 44, marginTop: 2 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identityCopy: { flex: 1, gap: 1 },
  pressed: { opacity: 0.68 },
})
