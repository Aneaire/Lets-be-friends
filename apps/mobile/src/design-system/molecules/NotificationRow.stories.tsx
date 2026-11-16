import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'

import { NotificationRow } from './NotificationRow'

const meta = {
  title: 'Mobile/Molecules/Notification row',
  component: NotificationRow,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    title: 'New message',
    body: 'Alex Rivera sent you a message.',
    timeLabel: '8m',
    tone: 'social',
    kind: 'direct_message',
    actors: [{ displayName: 'Alex Rivera' }],
    unread: true,
    onOpen: fn(),
    onToggleRead: fn(),
  },
} satisfies Meta<typeof NotificationRow>

export default meta
type Story = StoryObj<typeof meta>

export const UnreadSocial: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Unread notification\. New message/ }))
    await expect(args.onOpen).toHaveBeenCalledOnce()
  },
}

export const ReadSelf: Story = {
  args: {
    title: 'Identity verification approved',
    body: 'Your identity verification was approved.',
    timeLabel: '1d',
    tone: 'self',
    kind: 'identity_verification_approved',
    actors: undefined,
    unread: false,
  },
}

export const SafetyTone: Story = {
  args: {
    title: 'Report closed',
    body: 'The safety team closed your report.',
    tone: 'danger',
    kind: 'report_resolved',
    actors: undefined,
  },
}

export const AggregatedActors: Story = {
  args: {
    title: 'New likes',
    body: 'Alex Rivera and 4 others liked your post.',
    timeLabel: '12m',
    tone: 'social',
    kind: 'post_liked',
    unread: true,
    actors: [
      { displayName: 'Alex Rivera' },
      { displayName: 'Priya Shah' },
      { displayName: 'Mateo Alvarez' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('New likes')).toBeVisible()
    const row = canvas.getByRole('button', { name: /New likes/ })
    await expect(row).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Also: Priya Shah, Mateo Alvarez.'),
    )
  },
}

export const ProfilePhotoActors: Story = {
  args: {
    title: 'New likes',
    body: 'Priya Shah and 4 others liked your post.',
    timeLabel: '12m',
    tone: 'social',
    kind: 'post_liked',
    unread: true,
    actors: [
      {
        displayName: 'Priya Shah',
        profileImageUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
      },
      {
        displayName: 'Mateo Alvarez',
        profileImageUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
      },
      {
        displayName: 'Sam Chen',
        profileImageUrl: 'https://randomuser.me/api/portraits/women/68.jpg',
      },
    ],
  },
}

export const SystemNotification: Story = {
  args: {
    title: 'Identity verification approved',
    body: 'Your identity verification was approved.',
    timeLabel: '33d',
    tone: 'self',
    kind: 'identity_verification_approved',
    actors: undefined,
    unread: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByRole('button', { name: /Identity verification approved/ })
    await expect(row.getAttribute('aria-label')).not.toContain('People shown')
  },
}

export const Compact: Story = {
  args: { density: 'compact' },
}

export const LongContentAt320: Story = {
  args: {
    title: 'Completion confirmation needed for your upcoming online language exchange',
    body: 'Alexandria Rivera-Santos confirmed the experience is complete. Add your confirmation when you are ready so the booking history remains accurate.',
    timeLabel: '23h',
  },
}

function ReadToggleExample() {
  const [unread, setUnread] = useState(true)
  return (
    <NotificationRow
      title="Booking accepted"
      body="Alex Rivera accepted your booking request."
      timeLabel="Now"
      tone="social"
      unread={unread}
      onOpen={() => undefined}
      onToggleRead={() => setUnread((current) => !current)}
    />
  )
}

export const ReadToggle: Story = {
  render: () => <ReadToggleExample />,
}

export const BusyToggle: Story = {
  args: { toggleBusy: true },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: /Unread notification\. New message/ })
    await expect(row).toHaveAttribute('aria-disabled', 'true')
  },
}
