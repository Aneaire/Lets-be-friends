import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { CompanionSettlementPanel } from './CompanionSettlementPanel'

const ELIGIBLE_AT = Date.UTC(2026, 7, 12, 5, 39, 0)

const meta = {
  title: 'Features/Booking/Companion settlement',
  component: CompanionSettlementPanel,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    companionEarningsCentavos: 57_500,
    memberTotalCentavos: 66_125,
  },
} satisfies Meta<typeof CompanionSettlementPanel>

export default meta
type Story = StoryObj<typeof meta>

export const ReservedUntilCompletion: Story = {
  args: { settlementState: 'reserved' },
}

export const PendingReviewWindow: Story = {
  args: { settlementState: 'pending', settlementEligibleAt: ELIGIBLE_AT },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Pending 24-hour review')).toBeVisible()
    await expect(canvas.getByText(/₱575\.00/)).toBeVisible()
    await expect(canvas.getByText(/The member paid ₱661\.25 total/)).toBeVisible()
  },
}

export const OnHoldForReview: Story = {
  args: { settlementState: 'blocked' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('On hold for review'),
    ).toBeVisible()
  },
}

export const AvailableInWallet: Story = {
  args: { settlementState: 'settled' },
}

export const ReturnedToMember: Story = {
  args: { settlementState: 'refunded' },
}

export const UnknownStatusNarrowDark: Story = {
  args: { settlementState: undefined },
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
}
