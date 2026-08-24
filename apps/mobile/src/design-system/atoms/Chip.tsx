import { Pressable, StyleSheet } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { AppText } from '@/design-system/atoms/Typography'

export function Chip({ label, selected = false, onPress, accent = 'social', accessibilityLabel }: { label: string; selected?: boolean; onPress?: () => void; accent?: 'social' | 'self'; accessibilityLabel?: string }) {
  const theme = useAppTheme()
  const accentColor = accent === 'self' ? theme.colors.selfControl : theme.colors.socialControl

  if (!onPress) {
    return (
      <AppText variant="caption" style={[styles.chip, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        {label}
      </AppText>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      aria-pressed={selected}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pressable,
        { borderColor: selected ? accentColor : theme.colors.border, backgroundColor: selected ? accentColor : theme.colors.surface },
        pressed && styles.pressed,
      ]}>
      <AppText variant="caption" color={selected ? theme.colors.accentText : theme.colors.text}>{label}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: { height: 26, overflow: 'hidden', borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, textAlignVertical: 'center' },
  pressable: { height: 32, justifyContent: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12 },
  pressed: { opacity: 0.75 },
})
