import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

import { ReferralPanelView, type ReferralPanelData } from './ReferralPanelView'

const NOW = Date.UTC(2026, 10, 4, 9, 0)

const referral: ReferralPanelData = {
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
    {
      _id: 'referral-2',
      referredDisplayName: 'Paolo',
      status: 'completed',
      rewardedBookings: 3,
      totalRewardedBookings: 3,
      createdAt: NOW - 86_400_000,
    },
  ],
  rewards: [],
  totalEarnedCentavos: 15_300,
  totalReversedCentavos: 0,
  referredBy: null,
}

const meta = {
  title: 'Features/Referral/Referral panel',
  component: ReferralPanelView,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: {
    referral,
    busy: false,
    error: '',
    notice: '',
    codeInput: '',
    origin: 'https://letsbefriends.ph',
    onCodeInputChange: fn(),
    onCreateCode: fn(),
    onCopyLink: fn(),
    onSubmitCode: fn(),
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
    await expect(canvas.getByText('2 of 3 bookings rewarded')).toBeVisible()
  },
}

export const NoCodeYet: Story = {
  args: {
    referral: { ...referral, code: null, referrals: [], totalEarnedCentavos: 0 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Create my referral link' })).toBeVisible()
    await expect(canvas.getByText('Friends joined')).toBeVisible()
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

export const NarrowDark: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
}
