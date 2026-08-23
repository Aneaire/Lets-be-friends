import type { Meta, StoryObj } from '@storybook/react-native-web-vite'

import { BookingCard } from './BookingCard'

const booking = {
  id: 'booking_story',
  companionName: 'Alex Rivera',
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
  args: { booking, onPress: () => undefined },
} satisfies Meta<typeof BookingCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
export const Completed: Story = { args: { booking: { ...booking, status: 'completed' } } }
