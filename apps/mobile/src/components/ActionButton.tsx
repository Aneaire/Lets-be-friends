import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { AppText } from './Typography'
import { AppIcon, type AppIconName } from './AppIcon'

export function ActionButton({
  label,
  onPress,
  intent = 'social',
  secondary = false,
  disabled = false,
  accessibilityHint,
  style,
  icon,
}: {
  label: string
  onPress: () => void
  intent?: 'social' | 'self' | 'danger'
  secondary?: boolean
  disabled?: boolean
  accessibilityHint?: string
  style?: ViewStyle
  icon?: AppIconName
}) {
  const theme = useAppTheme()
  const accent = intent === 'self' ? theme.colors.selfControl : intent === 'social' ? theme.colors.socialControl : theme.colors.danger

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
      <View style={styles.content}>
        {icon ? <AppIcon name={icon} size={20} color={secondary ? accent : theme.colors.accentText} /> : null}
        <AppText variant="bodyStrong" color={secondary ? accent : theme.colors.accentText}>{label}</AppText>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.76 },
})
