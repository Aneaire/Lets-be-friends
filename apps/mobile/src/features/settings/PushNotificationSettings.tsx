import { usePushNotifications } from '@/notifications/PushNotifications'

import { PushNotificationSettingsPresentation } from './PushNotificationSettingsPresentation'

export function PushNotificationSettings() {
  const push = usePushNotifications()

  return (
    <PushNotificationSettingsPresentation
      state={push.state}
      onEnable={push.enable}
      onDisable={push.disable}
      onOpenSettings={push.openSettings}
      onRetryDisable={push.retryDisable}
      onRetryAvailability={push.retryAvailability}
    />
  )
}
