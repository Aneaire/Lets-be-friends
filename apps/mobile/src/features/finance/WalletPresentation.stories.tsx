import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import {
  WalletPresentation,
  type WalletTopUpItem,
} from './WalletPresentation'

const balances = [
  { key: 'available' as const, label: 'Available to book', value: '₱2,450.00' },
  { key: 'reserved' as const, label: 'Reserved for accepted bookings', value: '₱500.00' },
  { key: 'pending' as const, label: 'Pending provider confirmation', value: '₱0.00' },
]

const paidTopUp: WalletTopUpItem = {
  id: 'paid-1',
  amountLabel: '₱1,000.00',
  createdLabel: 'Aug 23, 2026, 4:18 PM',
  statusLabel: 'Paid',
  detail: 'Provider confirmation was received and the wallet credit was recorded.',
  active: false,
  payable: false,
  canRefresh: false,
}

const awaitingTopUp: WalletTopUpItem = {
  id: 'awaiting-1',
  amountLabel: '₱1,000.00',
  createdLabel: 'Aug 24, 2026, 9:42 AM',
  statusLabel: 'Awaiting payment',
  detail: 'Scan the QR Ph code. Balance is credited only after provider confirmation.',
  active: true,
  payable: true,
  expiryLabel: 'Expires Aug 24, 2026, 10:42 AM',
  canRefresh: true,
}

const createTopUp = fn()
const refreshTopUp = fn()
const returnToProfile = fn()
const changeAmount = fn()

const meta = {
  title: 'Mobile/Finance/Booking wallet',
  component: WalletPresentation,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  args: {
    enabled: true,
    balances,
    amount: '1000',
    onAmountChange: changeAmount,
    createLabel: 'Create QR Ph top-up',
    createDisabled: false,
    onCreate: createTopUp,
    onRefresh: refreshTopUp,
    topUps: [],
    onReturn: returnToProfile,
  },
} satisfies Meta<typeof WalletPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const ReadyNoHistory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('₱2,450.00')).toBeVisible()
    await expect(canvas.getByText('No member-wallet top-ups yet.')).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Create QR Ph top-up' }),
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Return to Profile' }),
    )
    await expect(createTopUp).toHaveBeenCalledOnce()
    await expect(returnToProfile).toHaveBeenCalledOnce()
  },
}

function AmountEntryStory() {
  const [amount, setAmount] = useState('1000')
  return (
    <WalletPresentation
      enabled
      balances={balances}
      amount={amount}
      onAmountChange={setAmount}
      createLabel="Create QR Ph top-up"
      createDisabled={false}
      onCreate={createTopUp}
      onRefresh={refreshTopUp}
      topUps={[]}
      onReturn={returnToProfile}
    />
  )
}

export const AmountEntry: Story = {
  render: () => <AmountEntryStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByLabelText('Top-up amount in PHP')
    await userEvent.clear(input)
    await userEvent.type(input, '2500.50')
    await expect(input).toHaveValue('2500.50')
  },
}

export const CurrentQrAttempt: Story = {
  args: {
    currentTopUp: awaitingTopUp,
    topUps: [awaitingTopUp, paidTopUp],
    createLabel: 'A QR attempt is still active',
    createDisabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByText('Awaiting payment')).toHaveLength(2)
    await expect(canvas.getByText(/Expires Aug 24/)).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: 'Refresh provider status' }),
    )
    await expect(refreshTopUp).toHaveBeenCalledOnce()
  },
}

export const CreatingTopUp: Story = {
  args: { createBusy: true, createDisabled: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Create QR Ph top-up',
    })
    await expect(button).toHaveAttribute('aria-busy', 'true')
    await expect(button).toHaveAttribute('aria-disabled', 'true')
  },
}

export const RefreshingProvider: Story = {
  args: {
    currentTopUp: awaitingTopUp,
    topUps: [awaitingTopUp],
    createLabel: 'A QR attempt is still active',
    createDisabled: true,
    refreshBusy: true,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', {
      name: 'Refresh provider status',
    })).toHaveAttribute('aria-busy', 'true')
  },
}

export const TopUpsUnavailable: Story = {
  args: {
    enabled: false,
    createDisabled: true,
    topUps: [paidTopUp],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('New wallet top-ups are unavailable')).toBeVisible()
    await expect(canvas.getByText('Paid')).toBeVisible()
  },
}

export const ConfirmationMessage: Story = {
  args: {
    message: 'QR Ph top-up for ₱1,000.00 is ready to scan.',
    currentTopUp: awaitingTopUp,
    topUps: [awaitingTopUp],
    createLabel: 'A QR attempt is still active',
    createDisabled: true,
  },
}

export const LongHistoryAt320: Story = {
  parameters: { viewport: { defaultViewport: 'mobileTiny' } },
  args: {
    topUps: [
      paidTopUp,
      {
        ...paidTopUp,
        id: 'failed-2',
        amountLabel: '₱100,000.00',
        createdLabel: 'Sunday, August 24, 2026 at 11:48 PM',
        statusLabel: 'Provider confirmation could not be completed',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: { topUps: [paidTopUp] },
}
