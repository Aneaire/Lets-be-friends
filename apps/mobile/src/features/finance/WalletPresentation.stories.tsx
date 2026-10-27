import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { walletTopUpCreationState } from '@/data/wallet'

import {
  bookingActivityRow,
  topUpActivityRow,
  type MemberBookingTransaction,
  type MemberTopUpRecord,
} from '@/data/walletActivity'

import {
  WalletPresentation,
  type WalletTopUpItem,
} from './WalletPresentation'

const NOW = Date.parse('2026-08-24T01:42:00.000Z')

const balances = [
  { key: 'available' as const, label: 'Available balance', value: '₱2,450.00' },
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
  qrImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
}

const paidTopUpRecord: MemberTopUpRecord = {
  _id: 'paid-1',
  amountCentavos: 100_000,
  status: 'paid',
  createdAt: NOW - 86_400_000,
  paidAt: NOW - 86_400_000,
}

const awaitingTopUpRecord: MemberTopUpRecord = {
  _id: 'awaiting-1',
  amountCentavos: 100_000,
  status: 'awaiting_payment',
  createdAt: NOW,
  expiresAt: NOW + 3_600_000,
}

const bookingTransaction: MemberBookingTransaction = {
  _id: 'transaction-1',
  kind: 'booking_reserve',
  amountCentavos: 50_000,
  createdAt: NOW - 7_200_000,
  bookingId: 'booking-1',
  category: 'Coffee and a walk',
  companionDisplayName: 'Mika Santos',
}

const closedBookingTransaction: MemberBookingTransaction = {
  ...bookingTransaction,
  _id: 'transaction-2',
  kind: 'booking_complete',
  createdAt: NOW - 3_600_000,
}

const activity = [
  bookingActivityRow(bookingTransaction),
  bookingActivityRow(closedBookingTransaction),
  topUpActivityRow(paidTopUpRecord, NOW),
  topUpActivityRow(awaitingTopUpRecord, NOW),
]

const createTopUp = fn()
const saveQr = fn()
const returnToProfile = fn()
const changeAmount = fn()
const openBooking = fn()
const openTransactions = fn()

const meta = {
  title: 'Mobile/Finance/Booking wallet',
  component: WalletPresentation,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    enabled: true,
    balances,
    amount: '1000',
    onAmountChange: changeAmount,
    createLabel: 'Create QR Ph top-up',
    createDisabled: false,
    onCreate: createTopUp,
    onSaveQr: saveQr,
    activity: [],
    onOpenBooking: openBooking,
    onReturn: returnToProfile,
    onOpenWithdrawals: fn(),
  },
} satisfies Meta<typeof WalletPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const ReadyNoHistory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('₱2,450.00')).toBeVisible()
    await expect(canvas.getByText('No wallet activity yet.')).toBeVisible()
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
      onSaveQr={saveQr}
      activity={[]}
      onReturn={returnToProfile}
      onOpenWithdrawals={fn()}
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
    activity: [
      topUpActivityRow(awaitingTopUpRecord, NOW),
      topUpActivityRow(paidTopUpRecord, NOW),
    ],
    createLabel: 'Edit amount to create a new QR',
    createDisabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Awaiting payment')).toBeVisible()
    await expect(canvas.getAllByText('Top-up pending')).toHaveLength(1)
    await expect(canvas.getByText(/Expires Aug 24/)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
    await expect(canvas.getByLabelText('Top-up amount in PHP')).toBeEnabled()
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Save QR' })).toBeEnabled())
    await userEvent.click(canvas.getByRole('button', { name: 'Save QR' }))
    await expect(saveQr).toHaveBeenCalledWith(awaitingTopUp.qrImageUrl)
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
  },
}

export const BookingActivity: Story = {
  args: { activity },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Reserved for booking')).toBeVisible()
    await expect(canvas.getByText('Booking completed')).toBeVisible()
    await expect(canvas.getByText('−₱500.00')).toBeVisible()
    await expect(canvas.getByText('+₱1,000.00')).toBeVisible()
    await userEvent.click(
      canvas.getByRole('button', { name: /Reserved for booking/ }),
    )
    await expect(openBooking).toHaveBeenCalledWith('booking-1')
  },
}

export const RecentPreviewWithViewMore: Story = {
  args: {
    activity,
    onOpenTransactions: openTransactions,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Recent transactions')).toBeVisible()
    await expect(canvas.getByText('Reserved for booking')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'View more transactions' }))
    await expect(openTransactions).toHaveBeenCalledTimes(1)
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1)
  },
};

export const LoadingActivity: Story = {
  args: { activityLoading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading transactions')).toBeVisible()
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

export const ConfirmingPayment: Story = {
  args: {
    currentTopUp: { ...awaitingTopUp, payable: false, statusLabel: 'Confirming payment', detail: 'Your payment is being confirmed. Your balance updates automatically.' },
    createDisabled: true,
    amountEditable: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Confirming payment')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Save QR' })).not.toBeInTheDocument()
  },
}

export const TopUpsUnavailable: Story = {
  args: {
    enabled: false,
    createDisabled: true,
    activity: [topUpActivityRow(paidTopUpRecord, NOW)],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('New wallet top-ups are unavailable')).toBeVisible()
    await expect(canvas.getByText('Wallet top-up')).toBeVisible()
  },
}

export const ConfirmationMessage: Story = {
  args: {
    message: 'QR Ph top-up for ₱1,000.00 is ready to scan.',
    currentTopUp: awaitingTopUp,
    activity: [topUpActivityRow(awaitingTopUpRecord, NOW)],
    createLabel: 'Edit amount to create a new QR',
    createDisabled: true,
  },
}

export const LongHistoryAt320: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    activity: [
      ...activity,
      {
        ...topUpActivityRow(paidTopUpRecord, NOW),
        key: 'top-up-failed-2',
        label: 'Top-up failed',
        amountLabel: '₱100,000.00',
        timeLabel: 'Sunday, August 24, 2026 at 11:48 PM',
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
  args: { activity },
}

export const PreparingQr: Story = {
  args: { qrPreparing: true, createBusy: true, createDisabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Preparing QR code')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Save QR' })).not.toBeInTheDocument()
  },
}

export const ExpiredQr: Story = {
  args: { currentTopUp: { ...awaitingTopUp, active: false, payable: false, statusLabel: 'Expired', detail: 'This QR has expired. Create a new top-up when ready.', expiryLabel: 'Expired' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('img', { name: /QR Ph code/ })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Save QR' })).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Create QR Ph top-up' })).toBeEnabled()
  },
}

function CorrectAmountStory() {
  const [amount, setAmount] = useState('50')
  const creation = walletTopUpCreationState({ amount, activeTopUp: { status: 'awaiting_payment', amountCentavos: 5_000 }, busy: false, waiting: false, enabled: true })
  return <WalletPresentation {...meta.args} amount={amount} onAmountChange={setAmount} createLabel={creation.label} createDisabled={creation.disabled} amountEditable={creation.editable} currentTopUp={{ ...awaitingTopUp, amountLabel: '₱50.00' }} />
}

export const CorrectActiveQrAmount: Story = {
  render: () => <CorrectAmountStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.clear(canvas.getByLabelText('Top-up amount in PHP'))
    await userEvent.type(canvas.getByLabelText('Top-up amount in PHP'), '500')
    await expect(canvas.getByRole('button', { name: 'Create QR for updated amount' })).toBeEnabled()
    await userEvent.click(canvas.getByRole('button', { name: 'Create QR for updated amount' }))
    await expect(createTopUp).toHaveBeenCalledOnce()
  },
}
