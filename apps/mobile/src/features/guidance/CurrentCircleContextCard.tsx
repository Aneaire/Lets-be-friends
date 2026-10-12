import { useQuery } from 'convex/react'
import { router } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import { mobileApi } from '@/backend/client'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import {
  guidanceCircleDestination,
  guidanceCircleMeta,
  selectGuidanceCircles,
  type GuidanceCircle,
} from './friendayGuidance'

export function CurrentCircleContextPresentation({ mine }: { mine: GuidanceCircle[] | undefined }) {
  const theme = useAppTheme()

  if (mine === undefined) {
    return (
      <View accessibilityLabel="Your current circle" style={[styles.card, { borderColor: theme.colors.border }]}>
        <AppText accessibilityRole="alert" variant="caption" color={theme.colors.textMuted}>
          Loading your circles...
        </AppText>
      </View>
    )
  }

  const { top, rest, totalActive } = selectGuidanceCircles(mine)

  if (!top) {
    return (
      <View accessibilityLabel="Your current circle" style={[styles.card, { borderColor: theme.colors.border }]}>
        <AppText variant="label" color={theme.colors.socialText}>
          CIRCLES
        </AppText>
        <AppText variant="bodyStrong">Your current circle</AppText>
        <AppText color={theme.colors.textMuted}>
          Circles are small groups that share interests, plans, and conversations. Your most recent Circle will sit at the top here.
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discover circles"
          hitSlop={8}
          onPress={() => router.push('/circles' as never)}
        >
          <AppText variant="caption" color={theme.colors.socialText}>
            Discover circles
          </AppText>
        </Pressable>
      </View>
    )
  }

  return (
    <View accessibilityLabel="Your current circle" style={[styles.card, { borderColor: theme.colors.border }]}>
      <View style={styles.titleRow}>
        <AppText variant="label" color={theme.colors.socialText}>
          CIRCLES
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="See all circles" hitSlop={8} onPress={() => router.push('/circles' as never)}>
          <AppText variant="caption" color={theme.colors.socialText}>
            {totalActive === 1 ? 'See all (1)' : `See all (${totalActive})`}
          </AppText>
        </Pressable>
      </View>
      <AppText variant="bodyStrong">Your current circle</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${top.name} Circle`}
        onPress={() => router.push(guidanceCircleDestination(top._id) as never)}
        style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
      >
        <View style={[styles.marker, { backgroundColor: theme.colors.socialControl }]} />
        <View style={styles.copy}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {top.name}
          </AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {guidanceCircleMeta(top)}
          </AppText>
        </View>
      </Pressable>
      {rest.map((circle) => (
        <Pressable
          key={circle._id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${circle.name} Circle`}
          onPress={() => router.push(guidanceCircleDestination(circle._id) as never)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={[styles.marker, { backgroundColor: theme.colors.socialControl }]} />
          <View style={styles.copy}>
            <AppText numberOfLines={1}>{circle.name}</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>
              {guidanceCircleMeta(circle)}
            </AppText>
          </View>
        </Pressable>
      ))}
    </View>
  )
}

/**
 * Home entry point using the existing, permission-aware circles.mine query.
 */
export function CurrentCircleContextCard() {
  const mine = useQuery(mobileApi.circles.mine)
  return <CurrentCircleContextPresentation mine={mine as GuidanceCircle[] | undefined} />
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, gap: 7, marginVertical: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  marker: { width: 9, height: 9, borderRadius: 5 },
  copy: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.72 },
})
