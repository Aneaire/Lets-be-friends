import { Pressable, StyleSheet, type ViewStyle } from 'react-native'
import { AppIcon, type AppIconName } from './AppIcon'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function IconButton({ label, icon, tone = 'neutral', disabled = false, loading = false, onPress, style }: {
  label: string
  icon: AppIconName
  tone?: 'neutral' | 'self' | 'social' | 'danger'
  disabled?: boolean
  loading?: boolean
  onPress: () => void
  style?: ViewStyle
}) {
  const theme = useAppTheme()
  const inactive = disabled || loading
  const color = tone === 'self' ? theme.colors.selfText : tone === 'social' ? theme.colors.socialText : tone === 'danger' ? theme.colors.danger : theme.colors.textMuted

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      aria-busy={loading || undefined}
      disabled={inactive}
      onPress={onPress}
      hitSlop={2}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? theme.colors.surface : 'transparent' },
        inactive && styles.disabled,
        style,
      ]}>
      <AppIcon name={loading ? 'hourglass-outline' : icon} size={20} color={color} />
    </Pressable>
  )
}

const styles = StyleSheet.create({ button: { width: density.controlHeight, height: density.controlHeight, borderRadius: density.controlRadius, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.5 } })
