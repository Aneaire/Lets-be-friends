import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { TextField } from '@/design-system/atoms/Field'
import { density } from '@/theme/tokens'

export function CompactComposer({
  value,
  placeholder = 'Write a message',
  maxLength = 2_000,
  sending = false,
  disabled = false,
  onChange,
  onSubmit,
}: {
  value: string
  placeholder?: string
  maxLength?: number
  sending?: boolean
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <View style={styles.row}>
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
        label="Send"
        onPress={onSubmit}
        disabled={disabled || !value.trim()}
        loading={sending}
        compact
        style={styles.send}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: density.cardGap,
  },
  input: {
    flex: 1,
    maxHeight: 112,
  },
  send: {
    minHeight: density.compactControlHeight,
  },
})
