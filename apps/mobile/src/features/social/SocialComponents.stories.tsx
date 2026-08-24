import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon, type AppIconName } from '@/design-system/atoms/AppIcon'
import { Avatar } from '@/design-system/atoms/Avatar'
import { TextField } from '@/design-system/atoms/Field'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import { ActionSheetPresentation, type ActionSheetItem } from '@/design-system/molecules/ActionSheet'
import { BottomSheetPresentation } from '@/design-system/molecules/BottomSheet'

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

function PostOptionsComposition() {
  const [open, setOpen] = useState(false)
  const items: ActionSheetItem[] = [
    { label: 'Edit post', icon: 'create-outline', tone: 'self', onPress: () => setOpen(false) },
    { label: 'Delete post', icon: 'trash-outline', tone: 'danger', onPress: () => setOpen(false) },
  ]

  return (
    <View style={styles.composition}>
      <PostCard
        author="Alexandria Montgomery-Santos"
        timestamp="Yesterday at 11:48 PM"
        headerAction={<IconButton label="Post options" icon="ellipsis-horizontal" onPress={() => setOpen(true)} />}>
        <AppText>Sharing a longer update to verify the post header and options remain usable at the narrowest supported width.</AppText>
      </PostCard>
      {open ? (
        <View style={StyleSheet.absoluteFill}>
          <ActionSheetPresentation title="Your post" items={items} onClose={() => setOpen(false)} />
        </View>
      ) : null}
    </View>
  )
}

function LinkedIdentityPost() {
  const theme = useAppTheme()
  const [following, setFollowing] = useState(false)
  const author = 'María Alexandra de la Cruz-Santos'

  return (
    <PostCard
      author={author}
      timestamp="Yesterday at 11:48 PM"
      avatarAction={(
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${author}'s profile`} style={styles.profileAction}>
          <Avatar name={author} size={38} />
        </Pressable>
      )}
      authorAction={(
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${author}'s profile`} style={styles.authorAction}>
          <AppText variant="bodyStrong" numberOfLines={1}>{author}</AppText>
        </Pressable>
      )}
      meta={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={following ? `Unfollow ${author}` : `Follow ${author}`}
          onPress={() => setFollowing((current) => !current)}
          style={styles.followAction}
        >
          <AppText variant="caption" color={theme.colors.socialText}>{following ? 'Following' : 'Follow'}</AppText>
        </Pressable>
      )}
      headerAction={<IconButton label="Post options" icon="ellipsis-horizontal" onPress={() => undefined} />}
    >
      <AppText>Long member identity, time, follow state, and post options stay usable at 320 pixels.</AppText>
    </PostCard>
  )
}

const storyComments = [
  { id: 'one', author: 'Alex Rivera', time: '9:28 PM', body: 'I am available on Saturday morning.' },
  { id: 'two', author: 'María Alexandra de la Cruz-Santos', time: '9:34 PM', body: 'A quiet café near the library works well for conversation practice.' },
  { id: 'three', author: 'Jordan Lee', time: '9:41 PM', body: 'Online also works if travel becomes difficult.' },
]

function CommentsSheetComposition() {
  const [visible, setVisible] = useState(true)
  const [body, setBody] = useState('')

  if (!visible) return <ActionButton label="Open comments" onPress={() => setVisible(true)} />

  return (
    <BottomSheetPresentation
      title="Comments"
      closeLabel="Close comments"
      scrollable={false}
      onClose={() => setVisible(false)}
      footer={(
        <View style={styles.commentComposer}>
          <TextField
            accessibilityLabel="Write a comment"
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="Write a respectful comment"
          />
          <AppText variant="caption">{body.length}/500</AppText>
          <ActionButton label="Post comment" disabled={!body.trim()} onPress={() => setBody('')} />
        </View>
      )}
    >
      <FlatList
        style={styles.commentList}
        data={storyComments}
        keyExtractor={(comment) => comment.id}
        renderItem={({ item: comment }) => (
          <CommentBubble
            author={comment.author}
            timestamp={comment.time}
            authorAction={(
              <Pressable accessibilityRole="button" accessibilityLabel={`View ${comment.author}'s profile`} style={styles.commentAuthorAction}>
                <AppText variant="bodyStrong" numberOfLines={1}>{comment.author}</AppText>
              </Pressable>
            )}
            action={comment.id === 'one' ? <IconButton label="Report comment" icon="flag-outline" tone="danger" onPress={() => undefined} /> : undefined}
          >
            <AppText>{comment.body}</AppText>
          </CommentBubble>
        )}
      />
    </BottomSheetPresentation>
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

export const PostOptionsNarrow320: Story = {
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  render: () => <PostOptionsComposition />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Post options' }))
    await expect(canvas.getByRole('dialog', { name: 'Your post' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Delete post' })).toBeInTheDocument()
  },
}

export const LinkedIdentityNarrow320: Story = {
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  render: () => <LinkedIdentityPost />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('button', { name: /View María Alexandra/ })).toHaveLength(2)
    await userEvent.click(canvas.getByRole('button', { name: `Follow María Alexandra de la Cruz-Santos` }))
    await expect(canvas.getByRole('button', { name: `Unfollow María Alexandra de la Cruz-Santos` })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Post options' })).toBeInTheDocument()
  },
}

export const CommentsSheetNarrow320: Story = {
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  render: () => <CommentsSheetComposition />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('dialog', { name: 'Comments' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Report comment' })).toBeInTheDocument()
    const commentInput = canvas.getByRole('textbox', { name: 'Write a comment' })
    await userEvent.type(commentInput, 'Count me in')
    await expect(canvas.getByRole('button', { name: 'Post comment' })).toBeEnabled()
    await userEvent.click(canvas.getByRole('button', { name: 'Close comments' }))
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}

export const Comment: Story = {
  render: () => (
    <CommentBubble
      author="Alex Rivera"
      timestamp="9:28 PM"
      authorAction={(
        <Pressable accessibilityRole="button" accessibilityLabel="View Alex Rivera's profile" style={styles.authorAction}>
          <AppText variant="bodyStrong" numberOfLines={1}>Alex Rivera</AppText>
        </Pressable>
      )}
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
  composition: { flex: 1 },
  profileAction: {
    width: density.compactControlHeight,
    minHeight: density.compactControlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAction: {
    maxWidth: '48%',
    flexShrink: 1,
    minHeight: density.compactControlHeight,
    justifyContent: 'center',
    marginVertical: -11,
  },
  followAction: {
    minHeight: density.compactControlHeight,
    justifyContent: 'center',
    marginVertical: -11,
    paddingHorizontal: 3,
  },
  commentList: {
    flexShrink: 1,
  },
  commentComposer: {
    gap: density.cardGap,
  },
  commentAuthorAction: {
    maxWidth: '45%',
    flexShrink: 1,
    minHeight: density.compactControlHeight,
    justifyContent: 'center',
    marginVertical: -11,
  },
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
