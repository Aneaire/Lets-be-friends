import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import {
  bookingActivityRow,
  topUpActivityRow,
  type MemberBookingTransaction,
  type MemberTopUpRecord,
} from '@/data/walletActivity'
import { transactionsPreviewRows } from '@/features/finance/transactions'

import { TransactionsPresentation } from './TransactionsPresentation'

const NOW = Date.parse('2026-08-24T01:42:00.000Z')

const bookingTransaction: MemberBookingTransaction = {
  _id: 'transaction-1',
  kind: 'booking_reserve',
  amountCentavos: 50_000,
  createdAt: NOW - 7_200_000,
  bookingId: 'booking-1',
  category: 'Coffee and a walk',
  companionDisplayName: 'Mika Santos',
}

const releasedTransaction: MemberBookingTransaction = {
  ...bookingTransaction,
  _id: 'transaction-2',
  kind: 'booking_release',
  createdAt: NOW - 3_600_000,
}

const refundedTransaction: MemberBookingTransaction = {
  ...bookingTransaction,
  _id: 'transaction-3',
  kind: 'booking_admin_refund',
  bookingId: 'booking-2',
  createdAt: NOW - 1_800_000,
}

const paidTopUp: MemberTopUpRecord = {
  _id: 'paid-1',
  amountCentavos: 100_000,
  status: 'paid',
  createdAt: NOW - 86_400_000,
  paidAt: NOW - 86_400_000,
}

const pendingTopUp: MemberTopUpRecord = {
  _id: 'awaiting-1',
  amountCentavos: 100_000,
  status: 'awaiting_payment',
  createdAt: NOW - 1_800_000,
  expiresAt: NOW + 3_600_000,
}

const history = [
  topUpActivityRow(pendingTopUp, NOW),
  bookingActivityRow(refundedTransaction),
  bookingActivityRow(releasedTransaction),
  bookingActivityRow(bookingTransaction),
  topUpActivityRow(paidTopUp, NOW),
]

const onBack = fn()
const onOpenBooking = fn()

const meta = {
  title: 'Mobile/Finance/Transactions history',
  component: TransactionsPresentation,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    rows: history,
    onBack,
    onOpenBooking,
  },
} satisfies Meta<typeof TransactionsPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const ReadyHistory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Transactions')).toBeVisible()
    await expect(canvas.getByText('Holds, payments, top-ups, and refunds from your wallet.')).toBeVisible()
    await expect(canvas.getByText('Returned to wallet')).toBeVisible()
    await expect(canvas.getByText('Refunded to wallet')).toBeVisible()
    await expect(canvas.getByText('Wallet top-up')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Back to bookings' }))
    await expect(onBack).toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: /Returned to wallet/ }))
    await expect(onOpenBooking).toHaveBeenCalledWith('booking-1')
  },
}

export const PreviewLimit: Story = {
  args: {
    rows: transactionsPreviewRows(history),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Transactions')).toBeVisible()
    await expect(canvas.queryByText('No wallet activity yet.')).not.toBeInTheDocument()
  },
}

export const LoadingHistory: Story = {
  args: { rows: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Loading transactions')).toBeVisible()
  },
}

export const EmptyHistory: Story = {
  args: { rows: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No wallet activity yet.')).toBeVisible()
  },
}

export const NarrowHistoryAt320: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: { rows: history },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: { rows: history },
}
