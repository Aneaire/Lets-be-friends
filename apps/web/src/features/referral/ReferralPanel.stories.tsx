import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

import { ReferralPanelView, type ReferralPanelData } from './ReferralPanelView'

const NOW = Date.UTC(2026, 10, 4, 9, 0)

const referral: ReferralPanelData = {
  code: 'ABCD1234',
  programActive: true,
  totalReferrals: 2,
  totalRewardedBookings: 5,
  totalEarnedCentavos: 15_300,
  totalPendingCentavos: 0,
  totalReversedCentavos: 0,
  referralDebtCentavos: 0,
  canAddReferralCode: false,
  referredBy: null,
}

const rewardItems = [
  {
    _id: 'reward-1',
    bookingId: 'booking-1',
    kind: 'lifetime',
    amountCentavos: 525,
    status: 'credited',
    reviewRequired: false,
    createdAt: NOW,
    releasedAt: NOW,
    referredDisplayName: 'Maya',
  },
]

const items = [
  {
    _id: 'referral-1',
    referredDisplayName: 'Maya',
    status: 'active',
    rewardedBookings: 2,
    createdAt: NOW,
  },
  {
    _id: 'referral-2',
    referredDisplayName: 'Paolo',
    status: 'active',
    rewardedBookings: 3,
    createdAt: NOW - 86_400_000,
  },
]

const meta = {
  title: 'Features/Referral/Referral panel',
  component: ReferralPanelView,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: {
    referral,
    items,
    rewardItems: [],
    status: 'Exhausted' as const,
    rewardStatus: 'Exhausted' as const,
    busy: false,
    error: '',
    notice: '',
    origin: 'https://letsbefriends.ph',
    copied: false,
    onCreateCode: fn(),
    onCopyLink: fn(),
    onLoadMore: fn(),
    onLoadMoreRewards: fn(),
  },
} satisfies Meta<typeof ReferralPanelView>

export default meta
type Story = StoryObj<typeof meta>

export const WithReferrals: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Invite friends' })).toBeVisible()
    await expect(canvas.getByDisplayValue('https://letsbefriends.ph/?ref=ABCD1234')).toBeVisible()
    await expect(canvas.getByText('Maya')).toBeVisible()
    await expect(canvas.getByText('2 bookings rewarded')).toBeVisible()
  },
}

export const NoCodeYet: Story = {
  args: {
    referral: { ...referral, code: null, totalReferrals: 0, totalRewardedBookings: 0, totalEarnedCentavos: 0 },
    items: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Create my referral link' })).toBeVisible()
    await expect(canvas.getByText('Friends joined')).toBeVisible()
  },
}

export const ManyReferrals: Story = {
  args: {
    referral: { ...referral, totalReferrals: 12, totalRewardedBookings: 9 },
    items: [
      ...items,
      {
        _id: 'referral-3',
        referredDisplayName: 'Bea',
        status: 'active',
        rewardedBookings: 1,
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
        termsVersion: 'lifetime_5_v1',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/You joined with Maya's code/)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Add referral code' })).toBeNull()
  },
}

export const CodeError: Story = {
  args: { error: 'That referral code could not be added.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('That referral code could not be added.')
  },
}

export const Copied: Story = {
  args: { copied: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /Copied/ })).toBeVisible()
  },
}

export const NarrowDark: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
}
