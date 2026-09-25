import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

import type { CompanionBooking } from './combinedBookings'
import { CompanionBookingRowView } from './CompanionBookingRow'

const baseBooking = {
  _id: 'booking_story',
  memberId: 'member_story',
  memberDisplayName: 'Sam Rivera',
  companionDisplayName: 'Alex',
  category: 'Coffee and conversation',
  mode: 'online',
  requestedAt: Date.UTC(2026, 8, 12, 6, 30),
  durationMinutes: 60,
  status: 'request_sent',
  pricingModel: 'legacy_cash',
  viewerHasReviewed: false,
} as unknown as CompanionBooking

const accept = fn(async () => undefined)
const decline = fn(async () => undefined)
const cancel = fn(async () => undefined)
const complete = fn(async () => undefined)
const report = fn(async () => undefined)

const meta = {
  title: 'Features/Booking/Companion booking row',
  component: CompanionBookingRowView,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: {
    booking: baseBooking,
    onAccept: accept,
    onDecline: decline,
    onCancel: cancel,
    onComplete: complete,
    onReport: report,
  },
} satisfies Meta<typeof CompanionBookingRowView>

export default meta
type Story = StoryObj<typeof meta>

export const NeedsDecision: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Sam Rivera' })).toBeVisible()
    await expect(canvas.getByText('Needs decision')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Accept' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Decline' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Report' })).toBeVisible()
  },
}

export const AcceptedWithLegacyAmount: Story = {
  args: {
    booking: {
      ...baseBooking,
      status: 'accepted',
      grossPriceCentavos: 120_000,
      currency: 'PHP',
      commissionCentavos: 20_000,
    } as unknown as CompanionBooking,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/Legacy cash amount/),
    ).toBeVisible()
  },
}

export const MemberWalletPendingSettlement: Story = {
  args: {
    booking: {
      ...baseBooking,
      status: 'accepted',
      pricingModel: 'member_wallet_v2',
      companionEarningsCentavos: 50_000,
      memberTotalCentavos: 57_500,
      settlementState: 'pending',
      settlementEligibleAt: Date.UTC(2026, 8, 13, 6, 30),
    } as unknown as CompanionBooking,
    evidenceSlot: (
      <div className="evidence-decision" data-state="undecided">
        <p className="text-h3">Start evidence</p>
        <p className="text-meta mt-1">Owner-provided evidence placeholder for the provider-free row.</p>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvasElement.querySelector('[data-settlement="pending"]')).toBeTruthy()
    await expect(canvas.getByText(/Your entitlement/)).toBeVisible()
  },
}

export const ReviewWindow: Story = {
  args: {
    booking: { ...baseBooking, status: 'review_window' } as unknown as CompanionBooking,
    reviewSlot: <button type="button" className="btn btn-social-quiet btn-sm">Leave review</button>,
    conversationLink: <a href="/messages" className="btn btn-social btn-sm">Open conversation</a>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Leave review' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Open conversation' })).toBeVisible()
  },
}

export const ReviewSubmitted: Story = {
  args: {
    booking: {
      ...baseBooking,
      status: 'review_window',
      viewerHasReviewed: true,
    } as unknown as CompanionBooking,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Review submitted'),
    ).toBeVisible()
  },
}

export const NarrowDarkNeedsDecision: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Accept' }),
    ).toBeVisible()
  },
}
