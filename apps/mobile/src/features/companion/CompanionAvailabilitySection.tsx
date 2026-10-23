import { StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import { summarizeWeeklyAvailability } from '@/data/companionAvailability'

export function CompanionAvailabilitySection({ availability }: { availability: unknown }) {
  const theme = useAppTheme()
  if (availability === undefined) return null
  const windows = Array.isArray(availability) ? availability : []
  const summary = summarizeWeeklyAvailability(windows)

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Weekly availability: ${summary}`}
      style={[styles.panel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <AppText variant="label" color={theme.colors.socialText}>WEEKLY AVAILABILITY</AppText>
      <AppText variant="bodyStrong">Manila time</AppText>
      <AppText color={theme.colors.textMuted}>{summary}</AppText>
      {windows.length === 0 ? (
        <AppText variant="caption" color={theme.colors.textMuted}>
          Requests still go through. The server checks the requested time when no schedule is shared.
        </AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: density.controlRadius,
    padding: density.cardPadding,
    gap: density.textStackGap,
  },
})
