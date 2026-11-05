import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, within } from 'storybook/test'

import { ReferralsAllView } from './ReferralsAllView'

const items = [
  { _id: 'referral-1', referredDisplayName: 'Maya', status: 'active', rewardedBookings: 2, totalRewardedBookings: 3 },
  { _id: 'referral-2', referredDisplayName: 'Paolo', status: 'completed', rewardedBookings: 3, totalRewardedBookings: 3 },
  { _id: 'referral-3', referredDisplayName: 'Bea', status: 'active', rewardedBookings: 1, totalRewardedBookings: 3 },
]

const meta = {
  title: 'Features/Referral/All referrals screen',
  component: ReferralsAllView,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    items,
    status: 'Exhausted' as const,
    onLoadMore: fn(),
    onBack: fn(),
  },
} satisfies Meta<typeof ReferralsAllView>

export default meta
type Story = StoryObj<typeof meta>

export const WithReferrals: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('All referrals')).toBeVisible()
    await expect(canvas.getByText('Maya')).toBeVisible()
  },
}

export const CanLoadMore: Story = {
  args: { status: 'CanLoadMore' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Load more' })).toBeVisible()
  },
}

export const Empty: Story = {
  args: { items: [], status: 'Exhausted' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No friends have joined with your link yet.')).toBeVisible()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
}

export const Narrow: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
}
