import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { BookingCard } from './BookingCard'

const booking = {
  id: 'booking_story',
  participantName: 'Alex Rivera',
  category: 'Coffee and conversation',
  mode: 'in_person' as const,
  requestedAt: Date.UTC(2026, 8, 12, 6, 30),
  durationMinutes: 90,
  status: 'request_sent' as const,
  memberTotalCentavos: 120000,
}

const meta = {
  title: 'Mobile/Organisms/Booking card',
  component: BookingCard,
  args: { booking, onPress: fn() },
} satisfies Meta<typeof BookingCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Open Coffee and conversation booking with Alex Rivera/ }))
    await expect(args.onPress).toHaveBeenCalledOnce()
  },
}

export const IncomingRequest: Story = {
  args: {
    booking: {
      ...booking,
      participantName: 'Morgan Lee',
      participantPreposition: 'from',
      status: 'verification_required',
    },
  },
}

export const Compact: Story = { args: { compact: true } }
export const Completed: Story = { args: { booking: { ...booking, status: 'completed' } } }
export const NoTotal: Story = { args: { booking: { ...booking, memberTotalCentavos: undefined } } }
export const LongContentAt320: Story = {
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  args: {
    booking: {
      ...booking,
      participantName: 'Alexandria Marisol Rivera-Santos',
      category: 'Coffee, conversation, and neighborhood orientation',
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}
