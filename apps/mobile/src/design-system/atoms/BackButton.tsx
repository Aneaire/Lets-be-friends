import { Pressable, StyleSheet } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { AppIcon } from './AppIcon'

export function BackButton({
  label = 'Go back',
  onPress,
}: {
  label?: string
  onPress: () => void
}) {
  const theme = useAppTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? theme.colors.surfaceRaised : theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}>
      <AppIcon name="chevron-back" size={20} color={theme.colors.text} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
