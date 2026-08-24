import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type SearchFieldProps = Omit<TextInputProps, 'value' | 'onChange' | 'onChangeText'> & {
  label: string
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  loading?: boolean
  clearLabel?: string
  containerStyle?: StyleProp<ViewStyle>
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField({
  label,
  value,
  onChange,
  onClear,
  loading = false,
  clearLabel = 'Clear search',
  editable = true,
  autoCapitalize = 'none',
  autoCorrect = false,
  returnKeyType = 'search',
  onFocus,
  onBlur,
  style,
  containerStyle,
  accessibilityState,
  ...props
}, forwardedRef) {
  const theme = useAppTheme()
  const inputRef = useRef<TextInput>(null)
  const [focused, setFocused] = useState(false)
  const disabled = editable === false

  useImperativeHandle(forwardedRef, () => inputRef.current as TextInput)

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: focused ? theme.colors.borderStrong : theme.colors.border,
          backgroundColor: theme.colors.surfaceRaised,
        },
        disabled && styles.disabled,
        containerStyle,
      ]}>
      <View style={styles.leadingIcon}>
        <AppIcon name="search" size={19} color={theme.colors.textMuted} />
      </View>
      <TextInput
        {...props}
        ref={inputRef}
        allowFontScaling
        maxFontSizeMultiplier={2}
        accessibilityLabel={label}
        accessibilityState={{ ...accessibilityState, busy: loading, disabled }}
        aria-busy={loading || undefined}
        aria-disabled={disabled || undefined}
        value={value}
        editable={editable}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        returnKeyType={returnKeyType}
        clearButtonMode="never"
        placeholderTextColor={theme.colors.textMuted}
        onChangeText={onChange}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        style={[styles.input, theme.typography.body, { color: theme.colors.text }, style]}
      />
      {loading ? (
        <View style={styles.trailing}>
          <ActivityIndicator accessibilityLabel={`${label} loading`} color={theme.colors.textMuted} size="small" />
        </View>
      ) : value && !disabled ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          onPress={() => {
            onChange('')
            onClear?.()
            inputRef.current?.focus()
          }}
          style={({ pressed }) => [styles.trailing, pressed && styles.pressed]}>
          <AppIcon name="close" size={19} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minWidth: 0,
    minHeight: density.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: density.controlRadius,
    overflow: 'hidden',
  },
  leadingIcon: {
    width: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  input: {
    minWidth: 0,
    minHeight: density.controlHeight,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  trailing: {
    width: density.compactControlHeight,
    height: density.compactControlHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: density.compactControlHeight / 2,
  },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.62 },
})
