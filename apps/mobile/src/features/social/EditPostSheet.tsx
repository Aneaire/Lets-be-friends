import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import {
  BottomSheet,
  BottomSheetPresentation,
} from '@/design-system/molecules/BottomSheet'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

type EditPostSheetContentProps = {
  body: string
  busy?: boolean
  allowEmpty?: boolean
  onBodyChange: (body: string) => void
  onSave: () => void
  onClose: () => void
}

export type EditPostSheetProps = EditPostSheetContentProps & {
  visible: boolean
}

export type EditPostSheetPresentationProps = EditPostSheetContentProps

function EditPostBody({ body, onBodyChange }: Pick<EditPostSheetContentProps, 'body' | 'onBodyChange'>) {
  const theme = useAppTheme()
  const tooLong = body.length > 1_000

  return (
    <View style={styles.body}>
      <TextField
        accessibilityLabel="Post text"
        value={body}
        onChangeText={onBodyChange}
        multiline
        maxLength={1_001}
        invalid={tooLong}
        style={styles.editor}
      />
      <AppText
        accessibilityRole={tooLong ? 'alert' : undefined}
        variant="caption"
        color={tooLong ? theme.colors.danger : theme.colors.textMuted}
      >
        {tooLong ? `${body.length}/1,000. Shorten the post to save.` : `${body.length}/1,000`}
      </AppText>
    </View>
  )
}

function EditPostActions({ body, busy = false, allowEmpty = false, onSave, onClose }: Omit<EditPostSheetContentProps, 'onBodyChange'>) {
  const saveDisabled = busy || body.length > 1_000 || (!body.trim() && !allowEmpty)

  return (
    <View style={styles.actions}>
      <ActionButton
        label={busy ? 'Saving' : 'Save changes'}
        intent="social"
        disabled={saveDisabled}
        onPress={onSave}
      />
      <ActionButton
        label="Cancel"
        intent="neutral"
        secondary
        disabled={busy}
        onPress={onClose}
      />
    </View>
  )
}

export function EditPostSheetPresentation({
  body,
  busy = false,
  allowEmpty = false,
  onBodyChange,
  onSave,
  onClose,
}: EditPostSheetPresentationProps) {
  return (
    <BottomSheetPresentation
      title="Edit post"
      closeLabel="Close editor"
      busy={busy}
      onClose={onClose}
      footer={(
        <EditPostActions
          body={body}
          busy={busy}
          allowEmpty={allowEmpty}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    >
      <EditPostBody body={body} onBodyChange={onBodyChange} />
    </BottomSheetPresentation>
  )
}

export function EditPostSheet({
  visible,
  body,
  busy = false,
  allowEmpty = false,
  onBodyChange,
  onSave,
  onClose,
}: EditPostSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title="Edit post"
      closeLabel="Close editor"
      busy={busy}
      onClose={onClose}
      footer={(
        <EditPostActions
          body={body}
          busy={busy}
          allowEmpty={allowEmpty}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    >
      <EditPostBody body={body} onBodyChange={onBodyChange} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: {
    gap: density.textPairGap,
  },
  editor: {
    minHeight: 150,
  },
  actions: {
    gap: density.cardGap,
  },
})
