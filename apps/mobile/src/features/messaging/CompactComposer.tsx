import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function CompactComposer({
  value,
  placeholder = 'Write a message',
  maxLength = 2_000,
  sending = false,
  disabled = false,
  canSubmit,
  preparing = false,
  attachments,
  showAttach = false,
  attachDisabled = false,
  attachLoading = false,
  hint,
  onChange,
  onSubmit,
  onAttachPress,
}: {
  value: string
  placeholder?: string
  maxLength?: number
  sending?: boolean
  disabled?: boolean
  canSubmit?: boolean
  preparing?: boolean
  attachments?: ReactNode
  showAttach?: boolean
  attachDisabled?: boolean
  attachLoading?: boolean
  hint?: string
  onChange: (value: string) => void
  onSubmit: () => void
  onAttachPress?: () => void
}) {
  const theme = useAppTheme()
  const busy = sending || preparing
  const submitDisabled = canSubmit !== undefined ? !canSubmit : (disabled || !value.trim())
  const showAttachButton = showAttach && onAttachPress !== undefined

  return (
    <View style={styles.column}>
      {attachments ? <View accessibilityLabel="Selected files" style={styles.tray}>{attachments}</View> : null}
      <View style={styles.row}>
        {showAttachButton ? (
          <IconButton
            label="Attach files"
            icon="attach-outline"
            tone="neutral"
            disabled={attachDisabled || busy}
            loading={attachLoading}
            onPress={onAttachPress}
            style={styles.attach}
          />
        ) : null}
        <TextField
          accessibilityLabel="Message"
          accessibilityState={{ disabled: sending }}
          aria-disabled={sending || undefined}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          multiline
          maxLength={maxLength}
          editable={!sending}
          style={styles.input}
        />
        <ActionButton
          label={preparing ? 'Preparing' : 'Send'}
          onPress={onSubmit}
          disabled={submitDisabled || busy}
          loading={sending || preparing}
          compact
          style={styles.send}
        />
      </View>
      {hint ? <AppText variant="caption" color={theme.colors.textMuted}>{hint}</AppText> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  column: {
    gap: density.textStackGap,
  },
  tray: {
    gap: density.textStackGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: density.cardGap,
  },
  attach: {
    width: density.compactControlHeight,
    height: density.compactControlHeight,
  },
  input: {
    flex: 1,
    maxHeight: 112,
  },
  send: {
    minHeight: density.compactControlHeight,
  },
})
