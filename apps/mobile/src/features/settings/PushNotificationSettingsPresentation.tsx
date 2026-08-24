import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import type { PushUiState } from '@/notifications/logic'
import { pushSettingsAction } from '@/notifications/logic'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function PushNotificationSettingsPresentation({
  state,
  onEnable,
  onDisable,
  onOpenSettings,
  onRetryDisable,
  onRetryAvailability,
}: {
  state: PushUiState
  onEnable: () => void | Promise<void>
  onDisable: () => void | Promise<void>
  onOpenSettings: () => void | Promise<void>
  onRetryDisable: () => void | Promise<void>
  onRetryAvailability: () => void | Promise<void>
}) {
  const theme = useAppTheme()
  const action = pushSettingsAction(state.status)
  const isLoading = state.status === 'loading'
  const isError = state.status === 'availability_error'
    || state.status === 'error'
    || state.status === 'pending_disable'

  return (
    <View
      accessibilityLabel="Push notification settings"
      style={[styles.section, { borderTopColor: theme.colors.border }]}>
      <View style={styles.copy}>
        <AppText variant="bodyStrong">Push notifications</AppText>
        <AppText
          accessibilityRole={isError ? 'alert' : 'text'}
          accessibilityLiveRegion={isError ? 'assertive' : 'polite'}
          variant="caption"
          color={isError ? theme.colors.danger : theme.colors.textMuted}>
          {state.message}
        </AppText>
      </View>

      {isLoading ? (
        <ActivityIndicator
          accessibilityLabel="Checking notification availability"
          color={theme.colors.selfText}
          style={styles.indicator}
        />
      ) : null}

      {action === 'enable' ? (
        <ActionButton
          label="Enable push notifications"
          onPress={() => void onEnable()}
          intent="self"
          secondary
          style={styles.action}
        />
      ) : null}
      {action === 'retry_availability' ? (
        <ActionButton
          label="Check notification availability again"
          onPress={() => void onRetryAvailability()}
          intent="self"
          secondary
          style={styles.action}
        />
      ) : null}
      {action === 'disable' ? (
        <ActionButton
          label="Turn off push notifications"
          onPress={() => void onDisable()}
          intent="self"
          secondary
          style={styles.action}
        />
      ) : null}
      {action === 'retry_disable' ? (
        <ActionButton
          label="Retry turning off"
          onPress={() => void onRetryDisable()}
          intent="self"
          secondary
          style={styles.action}
        />
      ) : null}
      {action === 'open_settings' ? (
        <ActionButton
          label="Open device settings"
          onPress={() => void onOpenSettings()}
          intent="self"
          secondary
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
  },
  copy: { gap: density.textStackGap },
  indicator: { alignSelf: 'flex-start', marginTop: density.cardGap },
  action: { marginTop: density.cardGap },
})
