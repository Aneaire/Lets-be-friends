import { Pressable, StyleSheet } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { AppText } from './Typography'

export function Chip({ label, selected = false, onPress, accent = 'social' }: { label: string; selected?: boolean; onPress?: () => void; accent?: 'social' | 'self' }) {
  const theme = useAppTheme()
  const accentColor = theme.colors[accent]

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
      accessibilityLabel={`Filter by ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        { borderColor: selected ? accentColor : theme.colors.border, backgroundColor: selected ? accentColor : theme.colors.surface },
        pressed && styles.pressed,
      ]}>
      <AppText variant="label" color={selected ? theme.colors.accentText : theme.colors.text}>{label}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: { overflow: 'hidden', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  pressable: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 15 },
  pressed: { opacity: 0.75 },
})
