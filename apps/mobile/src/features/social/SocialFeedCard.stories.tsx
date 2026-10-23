import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { SocialFeedCard } from './SocialFeedCard'

const recordAction = fn()
const openImage = fn()

const photo = 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect width="800" height="600" fill="%231093ED"/%3E%3Ccircle cx="400" cy="300" r="120" fill="white" fill-opacity=".82"/%3E%3C/svg%3E'

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

const photoPost = postItem as unknown as Record<string, unknown>
const photoPostBody = photoPost['post'] as Record<string, unknown>

export const FeedPhotoOpensLightbox: Story = {
  args: {
    item: {
      ...photoPost,
      itemKey: 'post:story-photo',
      post: {
        ...photoPostBody,
        _id: 'story-photo',
        body: 'Sunset walk photos from the weekend group.',
        media: [{ storageId: 'story-photo-one', kind: 'image', url: photo }],
        poll: undefined,
      },
    } as never,
    onOpenImage: openImage,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Open post image 1 of 1 full screen' }))
    await expect(openImage).toHaveBeenCalledWith({ url: photo, index: 0, total: 1 })
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

export const ProfilePictureUpdate: Story = {
  args: {
    item: {
      ...photoPost,
      itemKey: 'post:story-profile-picture',
      post: {
        ...photoPostBody,
        _id: 'story-profile-picture',
        body: 'A new season, a new photo.',
        media: [{ storageId: 'story-profile-picture', kind: 'image', url: photo }],
        poll: undefined,
        profilePictureUpdate: true,
      },
    } as never,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Profile picture update')).toBeVisible()
    await expect(canvas.getByText('A new season, a new photo.')).toBeVisible()
  },
}
