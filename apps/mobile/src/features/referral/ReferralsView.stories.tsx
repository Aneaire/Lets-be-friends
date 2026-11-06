import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, within } from 'storybook/test'

import { ReferralsView, type MobileReferralData } from './ReferralsView'

const NOW = Date.UTC(2026, 10, 4, 9, 0)

const referral: MobileReferralData = {
  code: 'ABCD1234',
  totalReferrals: 1,
  totalRewardedBookings: 2,
  totalEarnedCentavos: 10_200,
  totalReversedCentavos: 0,
  referredBy: null,
}

const items = [
  {
    _id: 'referral-1',
    referredDisplayName: 'Maya',
    status: 'active',
    rewardedBookings: 2,
    totalRewardedBookings: 3,
    createdAt: NOW,
  },
]

const meta = {
  title: 'Features/Referral/Referrals screen',
  component: ReferralsView,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    referral,
    items,
    status: 'Exhausted' as const,
    busy: false,
    message: '',
    shareUrl: 'https://letsbefriends.ph/?ref=ABCD1234',
    onCreateCode: fn(),
    onShare: fn(),
    onBack: fn(),
    onLoadMore: fn(),
  },
} satisfies Meta<typeof ReferralsView>

export default meta
type Story = StoryObj<typeof meta>

export const WithCode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Your code/)).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Share my link' })).toBeVisible()
    await expect(canvas.getByText('Maya')).toBeVisible()
  },
}

export const NoCodeYet: Story = {
  args: {
    referral: { ...referral, code: null, totalReferrals: 0, totalRewardedBookings: 0, totalEarnedCentavos: 0 },
    items: [],
    shareUrl: undefined,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Create my referral link' })).toBeVisible()
  },
}

export const ManyReferrals: Story = {
  args: {
    referral: { ...referral, totalReferrals: 12, totalRewardedBookings: 9 },
    items: [
      ...items,
      {
        _id: 'referral-2',
        referredDisplayName: 'Paolo',
        status: 'completed',
        rewardedBookings: 3,
        totalRewardedBookings: 3,
        createdAt: NOW - 86_400_000,
      },
      {
        _id: 'referral-3',
        referredDisplayName: 'Bea',
        status: 'active',
        rewardedBookings: 1,
        totalRewardedBookings: 3,
        createdAt: NOW - 172_800_000,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Bea')).toBeVisible()
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
