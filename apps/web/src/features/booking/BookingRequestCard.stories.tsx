import type { Meta, StoryObj } from '@storybook/react-vite'

import { BookingRequestCard } from './BookingRequestCard'

const booking = {
  bookingId: 'booking_story' as never,
  status: 'request_sent' as const,
  category: 'Coffee and conversation',
  mode: 'in_person' as const,
  requestedAt: Date.UTC(2026, 8, 12, 6, 30),
  durationMinutes: 90,
  notes: 'Meet near the main entrance.',
  memberId: 'member_story' as never,
  memberDisplayName: 'Sam',
  companionDisplayName: 'Alex',
  memberTotalCentavos: 120000,
  companionEarningsCentavos: 100000,
  settlementBlocked: false,
}

const meta = {
  title: 'Features/Booking/Request card',
  component: BookingRequestCard,
  globals: { viewport: 'mobileDefault' },
  args: {
    intro: 'A relaxed afternoon plan with clear timing and meeting details.',
    booking,
    viewerId: 'member_story' as never,
    onDecide: async () => undefined,
    onEdit: () => undefined,
  },
} satisfies Meta<typeof BookingRequestCard>

export default meta
type Story = StoryObj<typeof meta>

export const MemberView: Story = {}
export const CompanionView: Story = { args: { viewerId: 'companion_story' as never } }
export const AcceptedCompact: Story = { args: { booking: { ...booking, status: 'accepted' } } }
