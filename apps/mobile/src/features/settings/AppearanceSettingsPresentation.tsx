import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import { appearanceOptions, type AppearanceState, type ThemePreference } from '@/theme/appearance'

export function AppearanceSettingsPresentation({
  state,
  onSelect,
  onRetry,
}: {
  state: AppearanceState
  onSelect: (preference: ThemePreference) => void
  onRetry: () => void
}) {
  const theme = useAppTheme()
  const isLoading = state.status === 'loading'
  const isError = state.status === 'error' || state.status === 'unavailable'

  return (
    <View accessibilityLabel="Appearance settings" style={[styles.section, { borderTopColor: theme.colors.border }]}>
      <View style={styles.copy}>
        <AppText variant="bodyStrong">Appearance</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          Choose Light, Dark, or System. This choice is saved on this device only.
        </AppText>
      </View>

      {isLoading ? (
        <ActivityIndicator
          accessibilityLabel="Loading appearance choice"
          color={theme.colors.selfText}
          style={styles.indicator}
        />
      ) : (
        <SegmentedControl
          label="Color theme"
          value={state.preference}
          onChange={onSelect}
          tone="self"
          options={appearanceOptions.map((option) => ({ value: option.value, label: option.label }))}
        />
      )}

      {!isLoading ? (
        <AppText variant="caption" color={theme.colors.textMuted}>
          {appearanceOptions.find((option) => option.value === state.preference)?.description ?? ''}
        </AppText>
      ) : null}

      {isError && state.message ? (
        <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>
          {state.message}
        </AppText>
      ) : null}

      {state.status === 'error' ? (
        <ActionButton
          label="Load appearance choice again"
          onPress={onRetry}
          intent="self"
          secondary
          compact
          style={styles.action}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: density.cardGap,
    marginTop: density.cardGap,
    gap: density.cardGap,
  },
  copy: { gap: density.textStackGap },
  indicator: { alignSelf: 'flex-start' },
  action: { alignSelf: 'flex-start' },
})
