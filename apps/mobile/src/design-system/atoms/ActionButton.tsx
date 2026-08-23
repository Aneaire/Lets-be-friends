import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import { AppText } from '@/design-system/atoms/Typography'
import { AppIcon, type AppIconName } from '@/design-system/atoms/AppIcon'

export function ActionButton({
  label,
  onPress,
  intent = 'social',
  secondary = false,
  disabled = false,
  accessibilityHint,
  style,
  icon,
  compact = false,
  loading = false,
}: {
  label: string
  onPress: () => void
  intent?: 'social' | 'self' | 'danger'
  secondary?: boolean
  disabled?: boolean
  accessibilityHint?: string
  style?: ViewStyle
  icon?: AppIconName
  compact?: boolean
  loading?: boolean
}) {
  const theme = useAppTheme()
  const accent = intent === 'self' ? theme.colors.selfControl : intent === 'social' ? theme.colors.socialControl : theme.colors.danger

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor: secondary ? theme.colors.background : accent, borderColor: accent },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      <View style={styles.content}>
        {loading ? <AppIcon name="hourglass-outline" size={18} color={secondary ? accent : theme.colors.accentText} /> : icon ? <AppIcon name={icon} size={20} color={secondary ? accent : theme.colors.accentText} /> : null}
        <AppText variant="bodyStrong" color={secondary ? accent : theme.colors.accentText}>{loading ? `${label}…` : label}</AppText>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { minHeight: density.controlHeight, borderWidth: 1, borderRadius: density.controlRadius, paddingHorizontal: density.screenGutter, alignItems: 'center', justifyContent: 'center' },
  compact: { minHeight: density.compactControlHeight, paddingHorizontal: density.compactCardPadding },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  disabled: { opacity: 0.52 },
  pressed: { opacity: 0.76 },
})
