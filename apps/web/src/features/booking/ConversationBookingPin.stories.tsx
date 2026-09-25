import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { Id } from '../../../convex/_generated/dataModel'
import { ConversationBookingPin } from './ConversationBookingPin'
import type { BookingRequestView } from './BookingRequestCard'

function booking(overrides: Partial<Omit<BookingRequestView, 'bookingId' | 'category'>> & { bookingId: string; category: string }): BookingRequestView {
  return {
    status: 'accepted',
    mode: 'online',
    requestedAt: Date.UTC(2026, 8, 12, 6, 30),
    durationMinutes: 60,
    memberId: 'member_story' as Id<'users'>,
    memberDisplayName: 'Sam',
    companionDisplayName: 'Alex',
    settlementBlocked: false,
    ...overrides,
    bookingId: overrides.bookingId as Id<'bookings'>,
  }
}

const current = booking({ bookingId: 'booking_current', category: 'Coffee and conversation' })
const history = [
  booking({ bookingId: 'booking_history_1', category: 'City walk', status: 'declined' }),
  booking({ bookingId: 'booking_history_2', category: 'Museum visit', status: 'completed' }),
]

const decide = fn(async () => undefined)
const edit = fn()
const dismiss = fn()
const report = fn()

const meta = {
  title: 'Features/Booking/Conversation pin',
  component: ConversationBookingPin,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    booking: current,
    intro: 'Here are the details for our session.',
    viewerId: 'member_story' as Id<'users'>,
    history,
    onDecide: decide,
    onEdit: edit,
    onReport: report,
    onDismiss: dismiss,
  },
} satisfies Meta<typeof ConversationBookingPin>

export default meta
type Story = StoryObj<typeof meta>

export const MemberView: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Current booking')).toBeVisible()
    await expect(canvas.getByText('Coffee and conversation')).toBeVisible()
  },
}

export const CompanionDecision: Story = {
  args: {
    viewerId: 'companion_story' as Id<'users'>,
    booking: booking({ bookingId: 'booking_current', category: 'Coffee and conversation', status: 'request_sent' }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Accept request' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Decline' })).toBeVisible()
  },
}

export const PreviousBookingsDialog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'View previous bookings' }))
    const dialog = await within(document.body).findByRole('dialog', { name: 'Previous bookings' })
    await expect(within(dialog).getAllByRole('listitem')).toHaveLength(2)
    await expect(within(dialog).getByText('City walk')).toBeVisible()
  },
}

export const NoPreviousBookings: Story = {
  args: { history: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'View previous bookings' }))
    const dialog = await within(document.body).findByRole('dialog', { name: 'Previous bookings' })
    await expect(
      within(dialog).getByText('No previous bookings in this conversation yet.'),
    ).toBeVisible()
  },
}
