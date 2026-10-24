import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { api } from '../../convex/_generated/api'
import type { BookingTransaction } from '../features/booking/BookingTransactionList'
import { WalletHistoryList, type MemberTopUp, type WalletHistoryItem } from '../features/booking/WalletHistoryList'

export const Route = createFileRoute('/transactions')({ component: TransactionsPage })

function TransactionsPage() {
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer)
  const bookingTransactions = useQuery(
    api.finance.memberBookingTransactions,
    viewer ? { limit: 50 } : 'skip',
  )
  const topUps = useQuery(
    api.finance.memberTopUps,
    viewer ? { limit: 50 } : 'skip',
  )
  const items = useMemo<WalletHistoryItem[] | undefined>(() => {
    if (bookingTransactions === undefined || topUps === undefined) return undefined
    return [
      ...(bookingTransactions as BookingTransaction[]).map((transaction) => ({
        type: 'booking' as const,
        transaction,
      })),
      ...(topUps as MemberTopUp[]).map((topUp) => ({
        type: 'top_up' as const,
        topUp,
      })),
    ]
      .sort((left, right) => activityTime(right) - activityTime(left))
      .slice(0, 100)
  }, [bookingTransactions, topUps])

  if (!isSignedIn) {
    return (
      <main className="marketing-page">
        <h1 className="text-h1 mt-2">Sign in to view your transactions.</h1>
        <div className="mt-6">
          <SignInButton mode="modal">
            <button className="btn btn-self">Sign in</button>
          </SignInButton>
        </div>
      </main>
    )
  }

  return <TransactionsPageView items={items} />
}

export function TransactionsPageView({ items }: { items: WalletHistoryItem[] | undefined }) {
  return (
    <main className="settings-page">
      <Link to="/app" className="booking-back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to bookings
      </Link>
      <header className="settings-page-header">
        <p className="text-meta">Your money</p>
        <h1 className="text-h1">Transactions</h1>
        <p className="text-body muted">Holds, payments, top-ups, and refunds from your wallet.</p>
      </header>

      <section className="panel booking-transactions-panel" aria-label="Wallet transactions">
        {items === undefined ? (
          <p className="booking-transactions-loading text-meta" role="status">Loading wallet activity…</p>
        ) : (
          <WalletHistoryList items={items} />
        )}
      </section>
    </main>
  )
}

function activityTime(item: WalletHistoryItem) {
  return item.type === 'booking'
    ? item.transaction.createdAt
    : item.topUp.paidAt ?? item.topUp.createdAt
}
