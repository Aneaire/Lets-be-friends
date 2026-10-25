import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { SocialPostCard } from './SocialPostCard'

const recordAction = fn()
const openImage = fn()
const toggleFollow = fn(async () => true)

const photo = 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect width="800" height="600" fill="%231093ED"/%3E%3Ccircle cx="400" cy="300" r="120" fill="white" fill-opacity=".82"/%3E%3C/svg%3E'

// Same enriched shape as `mobileApi.social.byUser`: the featured comment is
// null there, but header, mentions, media, polls, and action state flow
// through the shared renderer unchanged.
const profilePost = {
  _id: 'profile-post',
  authorId: 'companion-user',
  authorDisplayName: 'Alex Rivera',
  authorUsername: 'alex_rivera',
  authorProfileImageUrl: undefined,
  authorCompanionProfileId: 'companion-1',
  createdAt: Date.UTC(2026, 7, 14, 13, 22),
  body: 'Sunset walk photos from the weekend group.',
  mentions: [],
  media: [{ storageId: 'profile-post-photo', kind: 'image', url: photo }],
  poll: {
    question: 'Which time works better?',
    totalVotes: 9,
    closed: false,
    options: [
      { id: 'morning', label: 'Saturday morning', voteCount: 6, percentage: 66.7 },
      { id: 'afternoon', label: 'Sunday afternoon', voteCount: 3, percentage: 33.3 },
    ],
  },
  featuredComment: null,
  liked: false,
  likeCount: 3,
  saved: false,
  commentCount: 2,
  followingAuthor: false,
  ownPost: false,
} as never

const meta = {
  title: 'Mobile/Social/Social post card',
  component: SocialPostCard,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    post: profilePost,
    signedIn: true,
    following: false,
    onAction: recordAction,
  },
} satisfies Meta<typeof SocialPostCard>

export default meta
type Story = StoryObj<typeof meta>

export const CompanionProfilePost: Story = {
  args: { onOpenImage: openImage, onToggleFollow: toggleFollow },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Sunset walk photos from the weekend group.')).toBeVisible()
    await expect(canvas.getByRole('radiogroup')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Follow Alex Rivera' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Open post image 1 of 1 full screen' }))
    await expect(openImage).toHaveBeenCalledWith({ url: photo, index: 0, total: 1 })
    await userEvent.click(canvas.getByRole('button', { name: 'Follow Alex Rivera' }))
    await expect(toggleFollow).toHaveBeenCalledWith('companion-user')
    await expect(recordAction).toHaveBeenCalledWith('follow')
    await userEvent.click(canvas.getByRole('button', { name: 'Like post' }))
    await expect(recordAction).toHaveBeenCalledWith('like')
    await userEvent.click(canvas.getByRole('button', { name: 'Save post' }))
    await expect(recordAction).toHaveBeenCalledWith('save')
    await userEvent.click(canvas.getByRole('button', { name: 'Comment on post' }))
    await expect(recordAction).toHaveBeenCalledWith('comment')
  },
}

export const CompanionOwnPostOptions: Story = {
  args: {
    post: { ...(profilePost as unknown as Record<string, unknown>), ownPost: true } as never,
    onOpenImage: openImage,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    await expect(canvas.queryByRole('button', { name: /Follow/ })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Post options' }))
    await expect(await page.findByRole('button', { name: 'Edit post' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete post' })).toBeVisible()
  },
}

export const SignedOutReadOnly: Story = {
  args: { signedIn: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Like post' })).toHaveAttribute('aria-disabled', 'true')
    await expect(canvas.getByRole('radio', { name: /Saturday morning/ })).toHaveAttribute('aria-disabled', 'true')
    await expect(canvas.queryByRole('button', { name: 'Post options' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /Follow/ })).not.toBeInTheDocument()
  },
}
