import { Modal, StyleSheet, TextInput, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { SettingsRow } from '@/design-system/molecules/SettingsRow'
import { useAppTheme } from '@/theme/ThemeProvider'

import {
  ACCOUNT_DELETION_CONFIRMATION,
  accountDeletionRow,
  type AccountDeletionSummary,
} from './accountDeletionModel'

export type AccountDeletionPresentationState = {
  summary: AccountDeletionSummary | null
  confirming: boolean
  confirmation: string
  busy: boolean
  error: string | null
}

export function AccountDeletionSettingsPresentation({
  state,
  onChangeConfirmation,
  onStart,
  onCancel,
  onConfirm,
}: {
  state: AccountDeletionPresentationState
  onChangeConfirmation: (value: string) => void
  onStart: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const theme = useAppTheme()
  const row = accountDeletionRow(state.summary)
  const canConfirm = state.confirmation.trim().toUpperCase() === ACCOUNT_DELETION_CONFIRMATION

  return (
    <>
      <SettingsRow
        icon="trash-outline"
        label={row.label}
        detail={row.detail}
        danger
        onPress={row.disabled ? undefined : onStart}
      />
      {state.summary && !state.summary.canDelete && state.summary.blockers.length > 0 ? (
        <View style={styles.blockers}>
          {state.summary.blockers.map((blocker) => (
            <AppText key={blocker.code} variant="caption" color={theme.colors.textMuted}>
              {`• ${blocker.description}`}
            </AppText>
          ))}
        </View>
      ) : null}

      <Modal
        visible={state.confirming}
        animationType="fade"
        transparent
        onRequestClose={onCancel}
      >
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <AppText variant="title">Delete your account?</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>
              This cannot be undone. Your profile, photos, posts, saved items, bank details, and identity
              images are removed. Ratings, bookings, and payment records stay without your personal details.
            </AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>
              {`Type ${ACCOUNT_DELETION_CONFIRMATION} to confirm.`}
            </AppText>
            <TextInput
              accessibilityLabel="Type DELETE to confirm account deletion"
              autoCapitalize="characters"
              autoCorrect={false}
              value={state.confirmation}
              onChangeText={onChangeConfirmation}
              editable={!state.busy}
              style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder={ACCOUNT_DELETION_CONFIRMATION}
              placeholderTextColor={theme.colors.textMuted}
            />
            {state.error ? (
              <AppText variant="caption" color={theme.colors.danger} accessibilityRole="alert">{state.error}</AppText>
            ) : null}
            <View style={styles.actions}>
              <ActionButton label="Cancel" intent="neutral" secondary onPress={onCancel} disabled={state.busy} style={styles.action} />
              <ActionButton
                label="Delete account"
                intent="danger"
                onPress={onConfirm}
                disabled={!canConfirm}
                loading={state.busy}
                loadingLabel="Deleting"
                style={styles.action}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  blockers: { gap: 4, paddingBottom: 8 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  sheet: { gap: 12, padding: 20, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  action: { flex: 1 },
})
