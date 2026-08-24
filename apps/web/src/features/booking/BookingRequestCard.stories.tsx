import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { ComponentProps } from 'react'

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

const decide = fn(async () => undefined)
const edit = fn()
const keepSaving = fn(() => new Promise<void>(() => undefined))
const rejectDecision = fn(async () => {
  throw new Error('The decision could not be saved. Try again.')
})

const meta = {
  title: 'Features/Booking/Request card',
  component: BookingRequestCard,
  globals: { viewport: 'mobileDefault' },
  args: {
    intro: 'A relaxed afternoon plan with clear timing and meeting details.',
    booking,
    viewerId: 'member_story' as never,
    onDecide: decide,
    onEdit: edit,
  },
} satisfies Meta<typeof BookingRequestCard>

export default meta
type Story = StoryObj<typeof meta>

function FloatingThread(props: ComponentProps<typeof BookingRequestCard>) {
  return (
    <section
      aria-label="Booking conversation preview"
      style={{
        height: '34rem',
        overflowY: 'auto',
        padding: '1rem',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        background: 'var(--app-bg)',
      }}
    >
      <div className="direct-booking" data-floating="true">
        <BookingRequestCard {...props} />
      </div>
      <div style={{ display: 'grid', gap: '0.75rem', paddingBlock: '1rem 24rem' }} aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} style={{ width: index % 2 ? '72%' : '58%', height: '3rem', marginLeft: index % 2 ? 'auto' : 0, borderRadius: '12px', background: 'var(--surface-sunk)' }} />
        ))}
      </div>
    </section>
  )
}

export const MemberView: Story = {}
export const CompanionView: Story = {
  args: { viewerId: 'companion_story' as never },
}
export const Draft: Story = {
  args: { booking: { ...booking, status: 'draft' } },
}
export const VerificationRequired: Story = {
  args: { booking: { ...booking, status: 'verification_required' } },
}
export const PendingAdminReview: Story = {
  args: { booking: { ...booking, status: 'pending_admin_review' } },
}
export const AcceptedCompact: Story = {
  args: { booking: { ...booking, status: 'accepted' } },
}
export const Declined: Story = {
  args: { booking: { ...booking, status: 'declined' } },
}
export const Cancelled: Story = {
  args: { booking: { ...booking, status: 'cancelled' } },
}
export const Completed: Story = {
  args: { booking: { ...booking, status: 'completed' } },
}
export const ReviewWindow: Story = {
  args: { booking: { ...booking, status: 'review_window' } },
}
export const Closed: Story = {
  args: { booking: { ...booking, status: 'closed' } },
}
export const DecisionBusy: Story = {
  args: {
    viewerId: 'companion_story' as never,
    onDecide: keepSaving,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Accept request' }),
    )
    await expect(
      canvas.getByRole('button', { name: 'Accepting…' }),
    ).toHaveAttribute('aria-busy', 'true')
    await expect(canvas.getByRole('button', { name: 'Decline' })).toBeDisabled()
  },
}
export const DecisionError: Story = {
  args: {
    viewerId: 'companion_story' as never,
    onDecide: rejectDecision,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      canvas.getByRole('button', { name: 'Accept request' }),
    )
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'The decision could not be saved. Try again.',
    )
  },
}
export const LongNotes: Story = {
  args: {
    intro: 'A relaxed plan for navigating a new neighborhood, finding a quiet café, and practicing conversational English without rushing the experience.',
    booking: {
      ...booking,
      category: 'Neighborhood orientation and conversational language practice',
      notes: 'Please meet near the clearly marked public entrance. I use a mobility aid and may need a few extra minutes between locations, so a steady pace and step-free route would make the experience more comfortable.',
    },
  },
}
export const MissingOptionalPricing: Story = {
  args: {
    booking: {
      ...booking,
      memberTotalCentavos: undefined,
      companionEarningsCentavos: undefined,
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByText(/Booking total/),
    ).not.toBeInTheDocument()
  },
}
export const FloatingInThreadLight: Story = {
  globals: { theme: 'light' },
  render: (args) => <FloatingThread {...args} />,
}
export const FloatingInThreadDark: Story = {
  globals: { theme: 'dark' },
  render: (args) => <FloatingThread {...args} />,
}
