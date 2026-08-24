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
  intent?: 'neutral' | 'social' | 'self' | 'danger'
  secondary?: boolean
  disabled?: boolean
  accessibilityHint?: string
  style?: ViewStyle
  icon?: AppIconName
  compact?: boolean
  loading?: boolean
}) {
  const theme = useAppTheme()
  const control = intent === 'neutral'
    ? theme.colors.inverse
    : intent === 'self'
      ? theme.colors.selfControl
      : intent === 'social'
        ? theme.colors.socialControl
        : theme.colors.danger
  const outline = intent === 'neutral'
    ? theme.colors.inverse
    : intent === 'self'
      ? theme.colors.selfText
      : intent === 'social'
        ? theme.colors.socialText
        : theme.colors.danger
  const foreground = intent === 'neutral' ? theme.colors.inverseText : theme.colors.accentText

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor: secondary ? theme.colors.background : control, borderColor: secondary ? outline : control },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      <View style={styles.content}>
        {loading ? <AppIcon name="hourglass-outline" size={18} color={secondary ? outline : foreground} /> : icon ? <AppIcon name={icon} size={20} color={secondary ? outline : foreground} /> : null}
        <AppText variant="bodyStrong" color={secondary ? outline : foreground}>{loading ? `${label}…` : label}</AppText>
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
