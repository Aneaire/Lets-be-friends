import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { AppText } from './Typography'

export function ActionButton({
  label,
  onPress,
  intent = 'social',
  secondary = false,
  disabled = false,
  accessibilityHint,
  style,
}: {
  label: string
  onPress: () => void
  intent?: 'social' | 'self'
  secondary?: boolean
  disabled?: boolean
  accessibilityHint?: string
  style?: ViewStyle
}) {
  const theme = useAppTheme()
  const accent = theme.colors[intent]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: secondary ? theme.colors.background : accent, borderColor: accent },
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      <View>
        <AppText variant="bodyStrong" color={secondary ? accent : theme.colors.accentText}>{label}</AppText>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.76 },
})
