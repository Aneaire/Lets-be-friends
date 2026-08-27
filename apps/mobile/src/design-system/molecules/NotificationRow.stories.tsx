import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'

import { NotificationRow } from './NotificationRow'

const meta = {
  title: 'Mobile/Molecules/Notification row',
  component: NotificationRow,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  args: {
    title: 'New message',
    body: 'Alex Rivera sent you a message.',
    timeLabel: '8m',
    tone: 'social',
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
    unread: false,
  },
}

export const SafetyTone: Story = {
  args: {
    title: 'Report closed',
    body: 'The safety team closed your report.',
    tone: 'danger',
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
