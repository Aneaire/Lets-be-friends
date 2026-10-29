import { Pressable, StyleSheet } from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density, radii } from '@/theme/tokens'

export function NewMessagesPill({ count, onPress }: {
  count: number
  onPress: () => void
}) {
  const theme = useAppTheme()
  const label = count === 1 ? 'New message' : `${count} new messages`

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Scroll to ${count === 1 ? 'the new message' : `${count} new messages`}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: theme.colors.socialControl, borderColor: theme.colors.socialControl },
        pressed && styles.pressed,
      ]}>
      <AppIcon name="arrow-down" size={16} color={theme.colors.accentText} />
      <AppText variant="bodyStrong" color={theme.colors.accentText}>{label}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: density.textSectionGap,
    paddingHorizontal: density.cardPadding,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  pressed: { opacity: 0.76 },
})
