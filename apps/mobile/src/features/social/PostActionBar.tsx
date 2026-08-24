import { Pressable, StyleSheet, View } from 'react-native'

import { AppIcon, type AppIconName } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type PostActionBarProps = {
  liked: boolean
  likeCount: number
  saved: boolean
  commentCount: number
  disabled?: boolean
  onLike: () => void
  onComment: () => void
  onSave: () => void
}

export function PostActionBar({
  liked,
  likeCount,
  saved,
  commentCount,
  disabled = false,
  onLike,
  onComment,
  onSave,
}: PostActionBarProps) {
  return (
    <View style={styles.actions}>
      <PostAction
        label={liked ? 'Unlike post' : 'Like post'}
        icon={liked ? 'heart' : 'heart-outline'}
        count={likeCount}
        active={liked}
        disabled={disabled}
        onPress={onLike}
      />
      <PostAction
        label="Comment on post"
        icon="chatbubble-outline"
        count={commentCount}
        onPress={onComment}
      />
      <PostAction
        label={saved ? 'Remove post from saved' : 'Save post'}
        icon={saved ? 'bookmark' : 'bookmark-outline'}
        active={saved}
        disabled={disabled}
        onPress={onSave}
      />
    </View>
  )
}

function PostAction({
  label,
  icon,
  count = 0,
  active = false,
  disabled = false,
  onPress,
}: {
  label: string
  icon: AppIconName
  count?: number
  active?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const theme = useAppTheme()
  const color = disabled ? theme.colors.textMuted : theme.colors.text

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <AppIcon name={icon} color={color} size={20} />
      {count > 0 ? (
        <AppText variant="caption" color={color}>
          {count}
        </AppText>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  actions: {
    maxWidth: 280,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  action: {
    minWidth: density.compactControlHeight,
    minHeight: density.compactControlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginVertical: -4,
    paddingHorizontal: 8,
  },
  pressed: {
    opacity: 0.68,
  },
})
