import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, within } from 'storybook/test'

import { ReferralsView, type MobileReferralData } from './ReferralsView'

const NOW = Date.UTC(2026, 10, 4, 9, 0)

const referral: MobileReferralData = {
  code: 'ABCD1234',
  referrals: [
    {
      _id: 'referral-1',
      referredDisplayName: 'Maya',
      status: 'active',
      rewardedBookings: 2,
      totalRewardedBookings: 3,
      createdAt: NOW,
    },
  ],
  rewards: [],
  totalReferrals: 1,
  totalRewardedBookings: 2,
  totalEarnedCentavos: 10_200,
  totalReversedCentavos: 0,
  referredBy: null,
}

const meta = {
  title: 'Features/Referral/Referrals screen',
  component: ReferralsView,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    referral,
    busy: false,
    message: '',
    shareUrl: 'https://letsbefriends.ph/?ref=ABCD1234',
    onCreateCode: fn(),
    onShare: fn(),
    onReturn: fn(),
    onViewAll: fn(),
  },
} satisfies Meta<typeof ReferralsView>

export default meta
type Story = StoryObj<typeof meta>

export const WithCode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('ABCD1234')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Share my link' })).toBeVisible()
    await expect(canvas.getByText('Maya')).toBeVisible()
  },
}

export const NoCodeYet: Story = {
  args: {
    referral: { ...referral, code: null, referrals: [], totalReferrals: 0, totalRewardedBookings: 0, totalEarnedCentavos: 0 },
    shareUrl: undefined,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Create my referral link' })).toBeVisible()
  },
}

export const ManyReferrals: Story = {
  args: {
    referral: { ...referral, totalReferrals: 12, totalRewardedBookings: 9 },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'View all referrals' })).toBeVisible()
  },
}

export const ReferredByFriend: Story = {
  args: {
    referral: {
      ...referral,
      referredBy: {
        referrerDisplayName: 'Maya',
        code: 'MAYA1234',
        rewardedBookings: 1,
        totalRewardedBookings: 3,
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/You joined with Maya's code/)).toBeVisible()
  },
}

export const Message: Story = {
  args: { message: 'Referral code added. It will apply to your first completed bookings.' },
}
