import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'

import { CircleRemovedContentView, type RemovedCircleItem } from './CircleRemovedContent'

const sampleItems: RemovedCircleItem[] = [
  { kind: 'post', id: 'post-1', body: 'A post that broke the Circle rules.' },
  { kind: 'comment', id: 'comment-2', body: 'A comment that was removed by a moderator.' },
]

function InteractiveRemoved() {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  return (
    <CircleRemovedContentView
      items={sampleItems}
      confirmId={confirmId}
      busyId={null}
      error=""
      onAskConfirm={(item) => setConfirmId(item.id)}
      onCancelConfirm={() => setConfirmId(null)}
      onRestore={() => setConfirmId(null)}
    />
  )
}

const meta = {
  title: 'Mobile/Circles/Removed content',
  component: InteractiveRemoved,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
} satisfies Meta<typeof InteractiveRemoved>

export default meta
type Story = StoryObj<typeof meta>

export const RemovedContent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Removed content')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Restore post' }))
    await expect(canvas.getByText('Restore this post? Members will see it in the Circle again.')).toBeVisible()
  },
}

export const EmptyQueue: Story = {
  render: () => (
    <CircleRemovedContentView
      items={[]}
      confirmId={null}
      busyId={null}
      error=""
      onAskConfirm={() => undefined}
      onCancelConfirm={() => undefined}
      onRestore={() => undefined}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No removed content')).toBeVisible()
  },
}
