import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { BottomSheet } from '@/design-system/molecules/BottomSheet'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { commentEditError } from './commentActions'

export function EditCommentSheet({ visible, body, busy, error, onBodyChange, onSave, onClose }: {
  visible: boolean
  body: string
  busy: boolean
  error: string
  onBodyChange: (body: string) => void
  onSave: () => void
  onClose: () => void
}) {
  const theme = useAppTheme()
  const validationError = commentEditError(body)

  return (
    <BottomSheet
      visible={visible}
      title="Edit comment"
      description="Update what you wrote in this conversation."
      closeLabel="Close comment editor"
      busy={busy}
      onClose={onClose}
      footer={(
        <View style={styles.actions}>
          <ActionButton
            label={busy ? 'Saving' : 'Save changes'}
            intent="social"
            loading={busy}
            disabled={busy || Boolean(validationError)}
            onPress={onSave}
          />
          <ActionButton label="Cancel" intent="neutral" secondary disabled={busy} onPress={onClose} />
        </View>
      )}
    >
      <View style={styles.body}>
        <TextField
          accessibilityLabel="Edit comment"
          value={body}
          onChangeText={onBodyChange}
          placeholder="Update your comment"
          multiline
          maxLength={501}
          editable={!busy}
          invalid={Boolean(validationError)}
          style={styles.editor}
        />
        <AppText
          accessibilityRole={validationError ? 'alert' : undefined}
          variant="caption"
          color={validationError ? theme.colors.danger : theme.colors.textMuted}
        >
          {validationError || `${body.length}/500`}
        </AppText>
        {error ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{error}</AppText> : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: density.textPairGap },
  editor: { minHeight: 132 },
  actions: { gap: density.cardGap },
})
