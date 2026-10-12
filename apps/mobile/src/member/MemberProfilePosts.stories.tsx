import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { MemberProfilePosts } from './MemberProfilePosts'

const samplePosts = [
  {
    _id: 'post-1',
    authorId: 'user-1',
    authorDisplayName: 'Alex Rivera',
    body: 'Morning walk along the river. Join me next time.',
    createdAt: 1_786_000_000_000,
    media: [],
    likeCount: 3,
    commentCount: 1,
    liked: false,
    saved: false,
    followingAuthor: false,
    ownPost: false,
  },
  {
    _id: 'post-2',
    authorId: 'user-1',
    authorDisplayName: 'Alex Rivera',
    body: 'Book club notes from this week.',
    createdAt: 1_785_900_000_000,
    media: [],
    likeCount: 0,
    commentCount: 0,
    liked: false,
    saved: false,
    followingAuthor: false,
    ownPost: false,
  },
]

const meta = {
  title: 'Mobile/Profile/Member posts',
  component: MemberProfilePosts,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    ownerName: 'Alex Rivera',
    posts: samplePosts,
    signedIn: true,
    emptyDescription: 'This member has not shared a post yet.',
  },
} satisfies Meta<typeof MemberProfilePosts>

export default meta
type Story = StoryObj<typeof meta>

export const SignedInPosts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('2 public posts')).toBeVisible()
    await expect(canvas.getByText('Morning walk along the river. Join me next time.')).toBeVisible()
  },
}

export const SignedOutReadOnly: Story = {
  args: { signedIn: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Sign in to like, save, follow, comment, or share.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeVisible()
  },
}

export const EmptyPosts: Story = {
  args: { posts: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No posts yet')).toBeVisible()
  },
}

export const LoadingPosts: Story = {
  args: { posts: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Loading posts.')).toBeVisible()
  },
}
