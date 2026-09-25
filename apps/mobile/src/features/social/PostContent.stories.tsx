import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { DisplayPostMediaItem } from './PostMediaGrid'
import { PostContent } from './PostContent'

const photo = 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect width="800" height="600" fill="%231093ED"/%3E%3Ccircle cx="400" cy="300" r="120" fill="white" fill-opacity=".82"/%3E%3C/svg%3E'

const media: DisplayPostMediaItem[] = [
  { storageId: 'photo-one', kind: 'image', url: photo },
  { storageId: 'video-one', kind: 'video', url: 'https://example.com/community-video.mp4' },
]

const openVideo = fn()
const vote = fn()
const openThread = fn()
const openImage = fn()

const meta = {
  title: 'Mobile/Organisms/Post content',
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const TextPost: Story = {
  render: () => (
    <PostContent
      body="Looking for someone to practice conversational English with this weekend."
      onOpenVideo={openVideo}
    />
  ),
}

export const PostWithMediaAndPoll: Story = {
  render: () => (
    <PostContent
      body="Two options for Sunday, plus a quick poll so we can plan together."
      media={media}
      poll={{
        question: 'Which time works better?',
        totalVotes: 9,
        closed: false,
        options: [
          { id: 'morning', label: 'Morning', voteCount: 6, percentage: 66.7 },
          { id: 'afternoon', label: 'Afternoon', voteCount: 3, percentage: 33.3 },
        ],
      }}
      imagePressContext="comments"
      onOpenVideo={openVideo}
      onOpenImage={openImage}
      onVote={async () => { vote() }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Which time works better?')).toBeVisible()
    await userEvent.click(canvas.getByRole('link', { name: 'Open post video 2 of 2' }))
    await expect(openVideo).toHaveBeenCalledWith('https://example.com/community-video.mp4')
  },
}

export const PostWithFeaturedComment: Story = {
  render: () => (
    <PostContent
      body="Open to suggestions on a quiet place to meet."
      featuredComment={{
        _id: 'comment-one',
        authorId: 'user-two',
        authorDisplayName: 'Alex Rivera',
        body: 'The library cafe is quiet on weekday mornings.',
        mentions: [],
        threadInteractionCount: 4,
      } as never}
      onOpenVideo={openVideo}
      onOpenFeaturedThread={() => { openThread() }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Most discussed')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /See the conversation/ }))
    await expect(openThread).toHaveBeenCalledTimes(1)
  },
}
