import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { SocialFeedCard } from './SocialFeedCard'

const recordAction = fn()

const postItem = {
  kind: 'post',
  itemKey: 'post:story-post',
  source: 'followed',
  reason: 'From someone you follow',
  post: {
    _id: 'story-post',
    authorId: 'story-author',
    authorDisplayName: 'Alex Rivera',
    authorUsername: 'alex_rivera',
    authorProfileImageUrl: undefined,
    authorCompanionProfileId: undefined,
    createdAt: Date.UTC(2026, 7, 14, 13, 22),
    body: 'Looking for a calm public cafe for conversation practice this weekend.',
    mentions: [],
    media: [],
    poll: {
      question: 'Which time works better?',
      totalVotes: 9,
      closed: false,
      options: [
        { id: 'morning', label: 'Saturday morning', voteCount: 6, percentage: 66.7 },
        { id: 'afternoon', label: 'Sunday afternoon', voteCount: 3, percentage: 33.3 },
      ],
    },
    featuredComment: undefined,
    liked: false,
    likeCount: 3,
    saved: false,
    commentCount: 2,
    followingAuthor: true,
    ownPost: false,
  },
} as never

const meta = {
  title: 'Mobile/Social/Social feed card',
  component: SocialFeedCard,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    item: postItem,
    signedIn: true,
    following: true,
    onAction: recordAction,
  },
} satisfies Meta<typeof SocialFeedCard>

export default meta
type Story = StoryObj<typeof meta>

export const ProductionPostComposition: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Looking for a calm public cafe for conversation practice this weekend.')).toBeVisible()
    await expect(canvas.getByRole('radiogroup')).toBeVisible()
    await expect(canvas.getAllByRole('button', { name: "View Alex Rivera's profile" })).toHaveLength(2)
    await userEvent.click(canvas.getByRole('button', { name: 'Comment on post' }))
    await expect(recordAction).toHaveBeenCalledWith('comment')
  },
}

export const SignedOutReadOnly: Story = {
  args: { signedIn: false, following: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Like post' })).toHaveAttribute('aria-disabled', 'true')
    await expect(canvas.getByRole('radio', { name: /Saturday morning/ })).toHaveAttribute('aria-disabled', 'true')
    await expect(canvas.queryByRole('button', { name: 'Post options' })).not.toBeInTheDocument()
  },
}
