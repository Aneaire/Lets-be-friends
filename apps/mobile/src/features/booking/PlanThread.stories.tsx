import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, within } from 'storybook/test'

import { PlanThread } from './PlanThread'

const requestedAt = Date.UTC(2026, 8, 12, 6, 30)

const meta = {
  title: 'Mobile/Booking/Plan thread',
  component: PlanThread,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  args: {
    status: 'request_sent',
    requestedAt,
  },
} satisfies Meta<typeof PlanThread>

export default meta
type Story = StoryObj<typeof meta>

export const WaitingForCompanion: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText('Waiting for the Companion to respond.'),
    ).toBeVisible()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const AcceptedUpcoming: Story = {
  args: { status: 'accepted' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('The Companion accepted the plan.'),
    ).toBeVisible()
  },
}

export const MemberConfirmedCompletion: Story = {
  args: {
    status: 'completed',
    memberCompletedAt: Date.UTC(2026, 8, 12, 8, 5),
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        'Each person confirms completion separately.',
      ),
    ).toBeVisible()
  },
}

export const ReviewWindowOpen: Story = {
  args: {
    status: 'review_window',
    memberCompletedAt: Date.UTC(2026, 8, 12, 8, 5),
    companionCompletedAt: Date.UTC(2026, 8, 12, 8, 8),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Both people confirmed completion.')).toBeVisible()
    await expect(canvas.getByText('The review window is open.')).toBeVisible()
  },
}

export const Cancelled: Story = {
  args: { status: 'cancelled' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        'This plan was cancelled. Existing messages and safety records remain available.',
      ),
    ).toBeVisible()
  },
}

export const DeclinedDark: Story = {
  globals: { theme: 'dark' },
  args: { status: 'declined' },
}

export const LongDateAt320: Story = {
  args: {
    status: 'accepted',
    requestedAt: Date.UTC(2026, 11, 31, 15, 45),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}
