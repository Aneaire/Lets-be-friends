import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ConversationListItem } from './ConversationListItem'

const meta = {
  title: 'Mobile/Organisms/Conversation list item',
  component: ConversationListItem,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  args: {
    name: 'Alex Rivera',
    preview: 'Would 2:30 PM work for the online session?',
    timeLabel: '2:24 PM',
    onPress: fn(),
  },
} satisfies Meta<typeof ConversationListItem>

export default meta
type Story = StoryObj<typeof meta>

export const Read: Story = {}

export const Unread: Story = {
  args: { unreadCount: 2 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Open conversation with Alex Rivera, 2 unread messages/ }))
    await expect(args.onPress).toHaveBeenCalledOnce()
    await expect(canvas.getByLabelText('2 unread messages')).toBeVisible()
  },
}

export const AttachmentOnly: Story = {
  args: { preview: 'You: Shared 3 files', timeLabel: 'Yesterday' },
}

export const LongContentAt320: Story = {
  args: {
    name: 'Alexandria Marisol Rivera-Santos',
    preview: 'You: I added the complete session notes and the updated meeting details so everything stays together in this private conversation.',
    unreadCount: 128,
    timeLabel: 'Aug 22',
  },
}

export const SuspendedSafety: Story = {
  args: {
    preview: 'Sensitive stored message that must not be shown',
    suspended: true,
    unreadCount: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Messaging unavailable')).toBeVisible()
    await expect(canvas.getByText('Conversation paused for safety')).toBeVisible()
    await expect(canvas.queryByText('Sensitive stored message that must not be shown')).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /conversation paused for safety/i })).toBeVisible()
  },
}
