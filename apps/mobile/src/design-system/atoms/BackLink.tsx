import { Pressable, StyleSheet } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { AppIcon } from './AppIcon'
import { AppText } from './Typography'

export function BackLink({
  label = 'Wallet',
  onPress,
}: {
  label?: string
  onPress: () => void
}) {
  const theme = useAppTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <AppIcon name="chevron-back" size={18} color={theme.colors.textMuted} />
      <AppText variant="bodyStrong" color={theme.colors.textMuted}>{label}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 8,
  },
  pressed: { opacity: 0.6 },
})
