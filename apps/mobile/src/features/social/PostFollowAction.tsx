import { Pressable, StyleSheet } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function PostFollowAction({
  author,
  following,
  busy = false,
  onPress,
}: {
  author: string
  following: boolean
  busy?: boolean
  onPress: () => void
}) {
  const theme = useAppTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={following ? `Unfollow ${author}` : `Follow ${author}`}
      accessibilityState={{ disabled: busy, busy }}
      aria-busy={busy || undefined}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        busy && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <AppText
        variant="caption"
        color={busy ? theme.colors.textMuted : theme.colors.socialText}
      >
        {following ? 'Following' : 'Follow'}
      </AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  action: {
    minHeight: density.compactControlHeight,
    justifyContent: 'center',
    marginVertical: -11,
    paddingHorizontal: 3,
  },
  pressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.5,
  },
})
