import { Pressable, StyleSheet, type ViewStyle } from 'react-native'
import { AppIcon, type AppIconName } from './AppIcon'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function IconButton({ label, icon, tone = 'neutral', disabled = false, onPress, style }: {
  label: string
  icon: AppIconName
  tone?: 'neutral' | 'self' | 'social' | 'danger'
  disabled?: boolean
  onPress: () => void
  style?: ViewStyle
}) {
  const theme = useAppTheme()
  const color = tone === 'self' ? theme.colors.selfText : tone === 'social' ? theme.colors.socialText : tone === 'danger' ? theme.colors.danger : theme.colors.textMuted
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={2} style={({ pressed }) => [styles.button, { backgroundColor: pressed ? theme.colors.surface : 'transparent' }, disabled && styles.disabled, style]}><AppIcon name={icon} size={20} color={color} /></Pressable>
}

const styles = StyleSheet.create({ button: { width: density.compactControlHeight, height: density.compactControlHeight, borderRadius: density.controlRadius, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.5 } })
