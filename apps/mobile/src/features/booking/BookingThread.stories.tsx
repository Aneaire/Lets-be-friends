import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { BookingThread } from './BookingThread'

const meta = {
  title: 'Mobile/Booking/Booking thread',
  component: BookingThread,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    bookingId: 'booking_thread_story' as never,
    status: 'request_sent',
  },
} satisfies Meta<typeof BookingThread>

export default meta
type Story = StoryObj<typeof meta>

export const RequestDiscussion: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Private booking thread')).toBeVisible()
    await expect(canvas.getByText('Plan discussion open')).toBeVisible()
    await expect(canvas.getByLabelText('Booking messages')).toBeVisible()
  },
}

export const AcceptedDiscussion: Story = {
  args: { status: 'accepted' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Plan confirmed')).toBeVisible()
  },
}

export const LockedAfterCancel: Story = {
  args: { status: 'cancelled' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Record preserved')).toBeVisible()
    await expect(canvas.getByText(/Booking chat opens after the request is sent/)).toBeVisible()
  },
}
