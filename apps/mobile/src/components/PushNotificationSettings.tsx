import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/components/ActionButton'
import { AppText } from '@/components/Typography'
import { usePushNotifications } from '@/notifications/PushNotifications'
import { pushSettingsAction } from '@/notifications/logic'
import { useAppTheme } from '@/theme/ThemeProvider'

export function PushNotificationSettings() {
  const theme = useAppTheme()
  const push = usePushNotifications()
  const action = pushSettingsAction(push.state.status)

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <AppText variant="bodyStrong">Push notifications</AppText>
      <AppText variant="caption" color={theme.colors.textMuted}>{push.state.message}</AppText>
      {action === 'enable' ? (
        <ActionButton
          label="Enable push notifications"
          onPress={() => void push.enable()}
          intent="self"
          secondary
          style={styles.action}
        />
      ) : null}
      {action === 'retry_availability' ? (
        <ActionButton
          label="Check notification availability again"
          onPress={() => void push.retryAvailability()}
          intent="self"
          secondary
          style={styles.action}
        />
      ) : null}
      {action === 'disable' ? (
        <ActionButton
          label="Turn off push notifications"
          onPress={() => void push.disable()}
          intent="self"
          secondary
          style={styles.action}
        />
      ) : null}
      {action === 'retry_disable' ? (
        <ActionButton
          label="Retry turning off"
          onPress={() => void push.retryDisable()}
          intent="self"
          secondary
          style={styles.action}
        />
      ) : null}
      {action === 'open_settings' ? (
        <ActionButton
          label="Open device settings"
          onPress={() => void push.openSettings()}
          intent="self"
          secondary
          style={styles.action}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 17, marginTop: 14, gap: 4 },
  action: { marginTop: 12 },
})
