import { formatPhp } from '@lets-be-friends/shared'

import { topUpPresentation, type WalletTopUpStatus } from './wallet'

export type BookingTransactionKind =
  | 'booking_reserve'
  | 'booking_complete'
  | 'booking_release'
  | 'booking_admin_refund'

export type MemberBookingTransaction = {
  _id: string
  kind: BookingTransactionKind
  amountCentavos: number
  createdAt: number
  bookingId: string
  category: string
  companionDisplayName: string
}

export type MemberTopUpRecord = {
  _id: string
  amountCentavos: number
  status: WalletTopUpStatus
  createdAt: number
  paidAt?: number
  expiresAt?: number
}

export type WalletActivityDirection = 'hold' | 'debit' | 'credit'
export type WalletActivityTone = 'social' | 'neutral' | 'success' | 'warning' | 'danger'
export type WalletActivityIcon =
  | 'calendar-outline'
  | 'checkmark-circle-outline'
  | 'return-down-back-outline'
  | 'wallet-outline'
  | 'time-outline'
  | 'close-circle-outline'

export type WalletActivityRow = {
  key: string
  label: string
  detail: string
  amountLabel: string
  direction: WalletActivityDirection
  tone: WalletActivityTone
  icon: WalletActivityIcon
  time: number
  timeLabel: string
  bookingId?: string
}

const BOOKING_PRESENTATION = {
  booking_reserve: { label: 'Reserved for booking', icon: 'calendar-outline', direction: 'hold', tone: 'social' },
  booking_complete: { label: 'Booking completed', icon: 'checkmark-circle-outline', direction: 'debit', tone: 'neutral' },
  booking_release: { label: 'Returned to wallet', icon: 'return-down-back-outline', direction: 'credit', tone: 'success' },
  booking_admin_refund: { label: 'Refunded to wallet', icon: 'return-down-back-outline', direction: 'credit', tone: 'success' },
} as const satisfies Record<BookingTransactionKind, {
  label: string
  icon: WalletActivityIcon
  direction: WalletActivityDirection
  tone: WalletActivityTone
}>

export function bookingActivityRow(transaction: MemberBookingTransaction): WalletActivityRow {
  const item = BOOKING_PRESENTATION[transaction.kind]
  return {
    key: `booking-${transaction._id}`,
    label: item.label,
    detail: `${transaction.companionDisplayName} · ${transaction.category}`,
    amountLabel: activityAmount(transaction.amountCentavos, item.direction),
    direction: item.direction,
    tone: item.tone,
    icon: item.icon,
    time: transaction.createdAt,
    timeLabel: formatActivityTimestamp(transaction.createdAt),
    bookingId: transaction.bookingId,
  }
}

export function topUpActivityRow(topUp: MemberTopUpRecord, now = Date.now()): WalletActivityRow {
  const presentation = topUpPresentation(topUp.status, topUp.expiresAt, now)
  const expired = topUp.status !== 'paid' && presentation.label === 'Expired'
  const paid = topUp.status === 'paid'
  const pending = (topUp.status === 'awaiting_payment' || topUp.status === 'processing') && !expired
  const label = paid
    ? 'Wallet top-up'
    : pending
      ? 'Top-up pending'
      : expired
        ? 'Top-up expired'
        : 'Top-up failed'
  const detail = paid
    ? 'Added to your available balance'
    : pending
      ? 'Waiting for payment confirmation'
      : expired
        ? 'The payment window expired'
        : 'Payment was not completed'
  const time = topUp.paidAt ?? topUp.createdAt
  return {
    key: `top-up-${topUp._id}`,
    label,
    detail,
    amountLabel: activityAmount(topUp.amountCentavos, paid ? 'credit' : 'hold'),
    direction: paid ? 'credit' : 'hold',
    tone: paid ? 'success' : pending ? 'warning' : 'danger',
    icon: paid ? 'wallet-outline' : pending ? 'time-outline' : 'close-circle-outline',
    time,
    timeLabel: formatActivityTimestamp(time),
  }
}

/**
 * Merges member booking movements and wallet top-ups the way the web
 * transactions page does: newest first, capped at the server's page size.
 */
export function walletActivityRows(
  transactions: readonly MemberBookingTransaction[],
  topUps: readonly MemberTopUpRecord[],
  now = Date.now(),
) {
  return [
    ...transactions.map(bookingActivityRow),
    ...topUps.map((topUp) => topUpActivityRow(topUp, now)),
  ]
    .sort((left, right) => right.time - left.time)
    .slice(0, 100)
}

export function activityAmount(amountCentavos: number, direction: WalletActivityDirection) {
  const formatted = formatPhp(amountCentavos)
  if (direction === 'credit') return `+${formatted}`
  if (direction === 'debit') return `−${formatted}`
  return formatted
}

export function formatActivityTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}
