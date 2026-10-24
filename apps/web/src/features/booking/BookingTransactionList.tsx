import { Link } from '@tanstack/react-router'
import { CalendarClock, CheckCircle2, RotateCcw, type LucideIcon } from 'lucide-react'
import { formatPhp } from '@lets-be-friends/shared'

export type BookingTransaction = {
  _id: string
  kind: 'booking_reserve' | 'booking_complete' | 'booking_release' | 'booking_admin_refund'
  amountCentavos: number
  createdAt: number
  bookingId: string
  category: string
  companionDisplayName: string
}

type TransactionDirection = 'hold' | 'debit' | 'credit'

const presentation = {
  booking_reserve: {
    label: 'Reserved for booking',
    icon: CalendarClock,
    direction: 'hold',
  },
  booking_complete: {
    label: 'Booking completed',
    icon: CheckCircle2,
    direction: 'debit',
  },
  booking_release: {
    label: 'Returned to wallet',
    icon: RotateCcw,
    direction: 'credit',
  },
  booking_admin_refund: {
    label: 'Refunded to wallet',
    icon: RotateCcw,
    direction: 'credit',
  },
} as const

export function WalletActivityRow({
  icon: Icon,
  label,
  detail,
  amount,
  direction,
  time,
  dataKind,
  bookingId,
}: {
  icon: LucideIcon
  label: string
  detail: string
  amount: string
  direction: TransactionDirection
  time: number
  dataKind: string
  bookingId?: string
}) {
  const content = (
    <>
      <span className="booking-transaction-icon" data-kind={dataKind} aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className="booking-transaction-copy">
        <strong>{label}</strong>
        <span>{detail}</span>
      </span>
      <span className="booking-transaction-amount">
        <strong className="tabular" data-direction={direction}>{amount}</strong>
        <time dateTime={new Date(time).toISOString()}>
          {formatTransactionTime(time)}
        </time>
      </span>
    </>
  )

  return bookingId
    ? <Link to="/app" search={{ bookingId }} className="booking-transaction-row">{content}</Link>
    : <div className="booking-transaction-row">{content}</div>
}

export function BookingTransactionRow({ transaction }: { transaction: BookingTransaction }) {
  const item = presentation[transaction.kind]
  const amount = item.direction === 'credit'
    ? `+${formatPhp(transaction.amountCentavos)}`
    : item.direction === 'debit'
      ? `−${formatPhp(transaction.amountCentavos)}`
      : formatPhp(transaction.amountCentavos)
  return (
    <WalletActivityRow
      icon={item.icon}
      label={item.label}
      detail={`${transaction.companionDisplayName} · ${transaction.category}`}
      amount={amount}
      direction={item.direction}
      time={transaction.createdAt}
      dataKind={transaction.kind}
      bookingId={String(transaction.bookingId)}
    />
  )
}

export function BookingTransactionList({
  transactions,
  emptyMessage = 'No booking transactions yet.',
}: {
  transactions: readonly BookingTransaction[]
  emptyMessage?: string
}) {
  if (transactions.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="booking-transaction-list">
      {transactions.map((transaction) => (
        <BookingTransactionRow key={transaction._id} transaction={transaction} />
      ))}
    </div>
  )
}

export function BookingTransactionsPreview({
  transactions,
}: {
  transactions: readonly BookingTransaction[] | undefined
}) {
  const hasTransactions = Boolean(transactions && transactions.length > 0)
  return (
    <section className="booking-transactions-preview mt-10" aria-labelledby="recent-transactions-title">
      <header className="booking-transactions-header">
        <div>
          <h2 id="recent-transactions-title" className="text-h2">Recent transactions</h2>
          <p className="text-meta mt-1">Holds, payments, and refunds from your bookings.</p>
        </div>
        {hasTransactions ? (
          <Link to="/transactions" className="booking-transactions-more">View more</Link>
        ) : null}
      </header>
      {transactions === undefined ? (
        <p className="text-meta" role="status">Loading transactions…</p>
      ) : (
        <div className="panel booking-transactions-panel">
          <BookingTransactionList transactions={transactions} />
        </div>
      )}
    </section>
  )
}

function formatTransactionTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
