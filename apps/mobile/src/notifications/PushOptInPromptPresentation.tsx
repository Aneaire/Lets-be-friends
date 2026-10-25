import { ConfirmationDialog, ConfirmationDialogPresentation } from '@/design-system/molecules/ConfirmationDialog'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { density } from '@/theme/tokens'
import { StyleSheet, View } from 'react-native'

export const PUSH_OPT_IN_TITLE = 'Enable push notifications'
export const PUSH_OPT_IN_DESCRIPTION =
  'Get booking, conversation, safety, and account updates on this device. You can turn them off anytime in Profile settings.'
export const PUSH_OPT_IN_FAILURE_MESSAGE =
  'Check your connection and try again. You can also enable them later in Profile settings.'

export function PushOptInPromptPresentation({
  busy = false,
  failed = false,
  onEnable,
  onDismiss,
}: {
  busy?: boolean
  failed?: boolean
  onEnable: () => void | Promise<void>
  onDismiss: () => void
}) {
  return (
    <ConfirmationDialogPresentation
      onClose={onDismiss}
      onConfirm={() => { void onEnable() }}
      title={PUSH_OPT_IN_TITLE}
      description={PUSH_OPT_IN_DESCRIPTION}
      confirmLabel="Enable notifications"
      cancelLabel="Not now"
      busyLabel="Enabling notifications"
      intent="self"
      busy={busy}>
      {failed && !busy ? (
        <View style={styles.error}>
          <InlineNotice title="Push notifications could not be enabled" tone="danger">
            {PUSH_OPT_IN_FAILURE_MESSAGE}
          </InlineNotice>
        </View>
      ) : null}
    </ConfirmationDialogPresentation>
  )
}

export function PushOptInPrompt({
  visible,
  busy = false,
  failed = false,
  onEnable,
  onDismiss,
}: {
  visible: boolean
  busy?: boolean
  failed?: boolean
  onEnable: () => void | Promise<void>
  onDismiss: () => void
}) {
  return (
    <ConfirmationDialog
      visible={visible}
      onClose={onDismiss}
      onConfirm={() => { void onEnable() }}
      title={PUSH_OPT_IN_TITLE}
      description={PUSH_OPT_IN_DESCRIPTION}
      confirmLabel="Enable notifications"
      cancelLabel="Not now"
      busyLabel="Enabling notifications"
      intent="self"
      busy={busy}>
      {failed && !busy ? (
        <View style={styles.error}>
          <InlineNotice title="Push notifications could not be enabled" tone="danger">
            {PUSH_OPT_IN_FAILURE_MESSAGE}
          </InlineNotice>
        </View>
      ) : null}
    </ConfirmationDialog>
  )
}

const styles = StyleSheet.create({
  error: { paddingTop: density.textStackGap },
})
