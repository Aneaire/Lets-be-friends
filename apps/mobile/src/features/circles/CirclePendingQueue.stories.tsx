import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { CirclePendingQueueView, type PendingDecision } from './CirclePendingQueue'

const samplePosts = [
  {
    _id: 'post-photo-walk',
    body: 'Photo walk this Saturday? I found a relaxed public route with cafe stops.',
    media: [{ storageId: 'media-1', kind: 'image', url: 'https://example.com/walk.jpg' }],
    poll: null,
    createdAt: new Date('2026-10-10T09:00:00Z').getTime(),
    authorId: 'user-ana',
    authorDisplayName: 'Ana',
    authorUsername: 'ana_walks',
    authorProfileImageUrl: null,
  },
  {
    _id: 'post-poll',
    body: '',
    media: [],
    poll: {
      question: 'Which morning works for the language exchange?',
      options: [
        { id: 'saturday', label: 'Saturday' },
        { id: 'sunday', label: 'Sunday' },
      ],
    },
    createdAt: new Date('2026-10-10T10:00:00Z').getTime(),
    authorId: 'user-ben',
    authorDisplayName: 'Ben',
    authorUsername: null,
    authorProfileImageUrl: null,
  },
]

function InteractiveQueue() {
  const [confirm, setConfirm] = useState<{ postId: string; decision: PendingDecision } | null>(null)
  return (
    <CirclePendingQueueView
      posts={samplePosts}
      busyKey={null}
      confirm={confirm}
      error=""
      onAskConfirm={(postId, decision) => setConfirm({ postId, decision })}
      onCancelConfirm={() => setConfirm(null)}
      onDecide={() => setConfirm(null)}
      onOpenImage={openImage}
      onOpenVideo={() => undefined}
    />
  )
}

const openImage = fn()

const meta = {
  title: 'Mobile/Circles/Pending queue',
  component: InteractiveQueue,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof InteractiveQueue>

export default meta
type Story = StoryObj<typeof meta>

export const PendingPosts: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Pending posts')).toBeVisible()
    await expect(canvas.getByText('Which morning works for the language exchange?')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Open post image 1 of 1 full screen' }))
    await expect(openImage).toHaveBeenCalledWith(samplePosts[0].media[0], 0, 1)
    await userEvent.click(canvas.getByRole('button', { name: "Approve Ana's post" }))
    await expect(canvas.getByText('Approve this post by Ana?')).toBeVisible()
  },
}

export const RejectConfirmation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: "Reject Ben's post" }))
    await expect(canvas.getByText('Reject this post by Ben? It stays hidden from members.')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Confirm reject' })).toBeVisible()
  },
}
