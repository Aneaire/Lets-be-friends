import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { StyleSheet, View, type NativeSyntheticEvent, type TextInputContentSizeChangeEventData } from 'react-native'

import { TextField } from '@/design-system/atoms/Field'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import { COMPOSER_MAX_HEIGHT, COMPOSER_MIN_HEIGHT, clampComposerHeight } from '@/data/messageViewModels'

export function CompactComposer({
  value,
  placeholder = 'Write a message',
  maxLength = 2_000,
  sending = false,
  disabled = false,
  canSubmit,
  preparing = false,
  contextBanner,
  attachments,
  showAttach = false,
  attachDisabled = false,
  attachLoading = false,
  submitLabel = 'Send',
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
  contextBanner?: ReactNode
  attachments?: ReactNode
  showAttach?: boolean
  attachDisabled?: boolean
  attachLoading?: boolean
  submitLabel?: string
  hint?: string
  onChange: (value: string) => void
  onSubmit: () => void
  onAttachPress?: () => void
}) {
  const theme = useAppTheme()
  const busy = sending || preparing
  const submitDisabled = canSubmit !== undefined ? !canSubmit : (disabled || !value.trim())
  const showAttachButton = showAttach && onAttachPress !== undefined
  const [inputHeight, setInputHeight] = useState(COMPOSER_MIN_HEIGHT)

  useEffect(() => {
    if (!value) setInputHeight(COMPOSER_MIN_HEIGHT)
  }, [value])

  function handleContentSizeChange(event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) {
    const next = clampComposerHeight(event.nativeEvent.contentSize.height)
    setInputHeight((current) => (current === next ? current : next))
  }

  return (
    <View style={styles.column}>
      {contextBanner}
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
            style={styles.iconButton}
          />
        ) : null}
        <TextField
          accessibilityLabel="Message"
          accessibilityState={{ disabled: sending }}
          aria-disabled={sending || undefined}
          value={value}
          onChangeText={onChange}
          onContentSizeChange={handleContentSizeChange}
          placeholder={placeholder}
          multiline
          numberOfLines={1}
          maxLength={maxLength}
          editable={!sending}
          scrollEnabled={inputHeight >= COMPOSER_MAX_HEIGHT}
          style={[styles.input, { height: inputHeight }]}
        />
        <IconButton
          label={preparing ? 'Preparing' : submitLabel}
          icon="send"
          tone="social"
          disabled={submitDisabled || busy}
          loading={sending || preparing}
          onPress={onSubmit}
          style={styles.iconButton}
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
  iconButton: {
    width: 44,
    height: 44,
  },
  input: {
    flex: 1,
    minHeight: COMPOSER_MIN_HEIGHT,
    maxHeight: COMPOSER_MAX_HEIGHT,
  },
})
