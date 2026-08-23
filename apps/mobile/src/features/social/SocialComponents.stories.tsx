import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { Pressable, StyleSheet, View } from 'react-native'

import { AppIcon, type AppIconName } from '@/design-system/atoms/AppIcon'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { CommentBubble } from './CommentBubble'
import { PostCard } from './PostCard'

function StoryAction({
  label,
  icon,
  count,
}: {
  label: string
  icon: AppIconName
  count?: number
}) {
  const theme = useAppTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => undefined}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <AppIcon name={icon} size={19} color={theme.colors.textMuted} />
      {count ? <AppText variant="caption" color={theme.colors.textMuted}>{count}</AppText> : null}
    </Pressable>
  )
}

function SocialPost({ owner }: { owner: boolean }) {
  return (
    <PostCard
      author="Gelo Santiago"
      timestamp="Aug 14, 9:22 PM"
      headerAction={(
        <IconButton
          label="Post options"
          icon="ellipsis-horizontal"
          onPress={() => undefined}
        />
      )}
      footer={(
        <View style={styles.actions}>
          <StoryAction label="Remove appreciation" icon="heart" count={3} />
          <StoryAction label="Show 2 comments" icon="chatbubble-outline" count={2} />
          <StoryAction label="Save post" icon="bookmark-outline" />
        </View>
      )}
    >
      <AppText>
        {owner
          ? 'This is your post. Owner options include edit and delete.'
          : 'Looking for someone to practice conversational English with this weekend.'}
      </AppText>
    </PostCard>
  )
}

const meta = {
  title: 'Mobile/Organisms/Social content',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const ViewerPost: Story = {
  render: () => <SocialPost owner={false} />,
}

export const OwnerPost: Story = {
  render: () => <SocialPost owner />,
}

export const Comment: Story = {
  render: () => (
    <CommentBubble
      author="Alex Rivera"
      timestamp="9:28 PM"
      action={(
        <IconButton
          label="Report comment"
          icon="flag-outline"
          tone="danger"
          onPress={() => undefined}
        />
      )}
    >
      <AppText>I am available on Saturday morning.</AppText>
    </CommentBubble>
  ),
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 260,
  },
  action: {
    minWidth: density.compactControlHeight,
    minHeight: density.compactControlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  pressed: {
    opacity: 0.68,
  },
})
