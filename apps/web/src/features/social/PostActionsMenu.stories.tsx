import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'

import { PostActionsMenu } from './PostActionsMenu'

const meta = {
  title: 'Features/Social/Post actions menu',
  component: PostActionsMenu,
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    ownedByViewer: false,
    onEdit: () => undefined,
    onDelete: () => undefined,
    onReport: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="social-post-options-story">
        <span className="text-meta">Post header</span>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PostActionsMenu>

export default meta
type Story = StoryObj<typeof meta>

export const ViewerOptions: Story = {}

export const OwnerOptions: Story = {
  args: { ownedByViewer: true },
}

export const MutedNotifications: Story = {
  args: {
    notificationsMuted: true,
    onToggleNotifications: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Post options' }))
    await expect(canvas.getByRole('menuitem', { name: 'Unmute notifications for this post' })).toBeVisible()
    await expect(canvas.getByRole('menuitem', { name: 'Report post' })).toBeVisible()
  },
}

export const ActiveNotifications: Story = {
  args: {
    notificationsMuted: false,
    onToggleNotifications: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Post options' }))
    await expect(canvas.getByRole('menuitem', { name: 'Mute notifications for this post' })).toBeVisible()
  },
}
