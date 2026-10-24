import { Clock3, WalletCards, XCircle } from 'lucide-react'
import { formatPhp } from '@lets-be-friends/shared'

import { BookingTransactionRow, WalletActivityRow, type BookingTransaction } from './BookingTransactionList'

export type MemberTopUp = {
  _id: string
  amountCentavos: number
  status: 'awaiting_payment' | 'processing' | 'paid' | 'failed' | 'expired'
  createdAt: number
  paidAt?: number
  expiresAt?: number
}

export type WalletHistoryItem =
  | { type: 'booking'; transaction: BookingTransaction }
  | { type: 'top_up'; topUp: MemberTopUp }

export function WalletHistoryList({
  items,
  emptyMessage = 'No wallet activity yet.',
}: {
  items: readonly WalletHistoryItem[]
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="booking-transaction-list">
      {items.map((item) => item.type === 'booking'
        ? <BookingTransactionRow key={`booking-${item.transaction._id}`} transaction={item.transaction} />
        : <TopUpRow key={`top-up-${item.topUp._id}`} topUp={item.topUp} />)}
    </div>
  )
}

function TopUpRow({ topUp }: { topUp: MemberTopUp }) {
  const expired = topUp.status !== 'paid'
    && topUp.expiresAt !== undefined
    && topUp.expiresAt <= Date.now()
  const status = expired ? 'expired' : topUp.status
  const paid = status === 'paid'
  const pending = status === 'awaiting_payment' || status === 'processing'
  const time = topUp.paidAt ?? topUp.createdAt
  const label = paid
    ? 'Wallet top-up'
    : pending
      ? 'Top-up pending'
      : status === 'expired'
        ? 'Top-up expired'
        : 'Top-up failed'
  const detail = paid
    ? 'Added to your available balance'
    : pending
      ? 'Waiting for payment confirmation'
      : status === 'expired'
        ? 'The payment window expired'
        : 'Payment was not completed'
  const icon = paid ? WalletCards : status === 'failed' || status === 'expired' ? XCircle : Clock3
  const amount = paid
    ? `+${formatPhp(topUp.amountCentavos)}`
    : formatPhp(topUp.amountCentavos)

  return (
    <WalletActivityRow
      icon={icon}
      label={label}
      detail={detail}
      amount={amount}
      direction={paid ? 'credit' : 'hold'}
      time={time}
      dataKind={`top_up_${status}`}
    />
  )
}
