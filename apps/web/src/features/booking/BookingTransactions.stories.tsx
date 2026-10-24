import type { Meta, StoryObj } from '@storybook/react-vite'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { useMemo, type ReactNode } from 'react'
import { expect, within } from 'storybook/test'

import { BookingTransactionList, BookingTransactionsPreview, type BookingTransaction } from './BookingTransactionList'
import { WalletHistoryList, type MemberTopUp, type WalletHistoryItem } from './WalletHistoryList'
import { TransactionsPageView } from '../../routes/transactions'

function StoryRouter({ children }: { children: ReactNode }) {
  const router = useMemo(() => {
    const rootRoute = createRootRoute({ component: () => <>{children}</> })
    const routeTree = rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/' }),
      createRoute({ getParentRoute: () => rootRoute, path: '/app' }),
      createRoute({ getParentRoute: () => rootRoute, path: '/transactions' }),
    ])
    return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) })
  }, [children])
  return <RouterProvider router={router} />
}

const transactions: BookingTransaction[] = [
  {
    _id: 'transaction-1',
    kind: 'booking_complete',
    amountCentavos: 57_500,
    createdAt: Date.UTC(2026, 9, 20, 13, 30),
    bookingId: 'booking-dana',
    category: 'Coffee and conversation',
    companionDisplayName: 'Dana Cruz',
  },
  {
    _id: 'transaction-2',
    kind: 'booking_reserve',
    amountCentavos: 57_500,
    createdAt: Date.UTC(2026, 9, 19, 9, 15),
    bookingId: 'booking-dana',
    category: 'Coffee and conversation',
    companionDisplayName: 'Dana Cruz',
  },
  {
    _id: 'transaction-3',
    kind: 'booking_admin_refund',
    amountCentavos: 32_000,
    createdAt: Date.UTC(2026, 9, 16, 18, 5),
    bookingId: 'booking-mina',
    category: 'Study session',
    companionDisplayName: 'Mina Santos',
  },
  {
    _id: 'transaction-4',
    kind: 'booking_release',
    amountCentavos: 45_000,
    createdAt: Date.UTC(2026, 9, 12, 11, 40),
    bookingId: 'booking-jules',
    category: 'City walk',
    companionDisplayName: 'Jules Rivera',
  },
  {
    _id: 'transaction-5',
    kind: 'booking_reserve',
    amountCentavos: 45_000,
    createdAt: Date.UTC(2026, 9, 12, 11, 35),
    bookingId: 'booking-jules',
    category: 'City walk',
    companionDisplayName: 'Jules Rivera',
  },
]

const topUps: MemberTopUp[] = [
  {
    _id: 'top-up-1',
    amountCentavos: 100_000,
    status: 'paid',
    createdAt: Date.UTC(2026, 9, 18, 8, 0),
    paidAt: Date.UTC(2026, 9, 18, 8, 3),
  },
  {
    _id: 'top-up-2',
    amountCentavos: 50_000,
    status: 'expired',
    createdAt: Date.UTC(2026, 9, 15, 12, 0),
    expiresAt: Date.UTC(2026, 9, 15, 12, 15),
  },
]

const pageItems: WalletHistoryItem[] = [
  ...transactions.map((transaction) => ({ type: 'booking' as const, transaction })),
  ...topUps.map((topUp) => ({ type: 'top_up' as const, topUp })),
].sort((left, right) => {
  const time = (item: WalletHistoryItem) => item.type === 'booking'
    ? item.transaction.createdAt
    : item.topUp.paidAt ?? item.topUp.createdAt
  return time(right) - time(left)
})

const meta = {
  title: 'Web/Booking/Transactions',
  globals: { viewport: { value: 'desktop', isRotated: false } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const RecentTransactions: Story = {
  render: () => (
    <StoryRouter>
      <div style={{ width: 'min(100%, 48rem)', padding: '2rem' }}>
        <BookingTransactionsPreview transactions={transactions} />
      </div>
    </StoryRouter>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Recent transactions' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'View more' }).getAttribute('href')).toBe('/transactions')
    await expect(canvas.getByRole('link', { name: /Booking completed/ }).getAttribute('href')).toContain('/app?bookingId=booking-dana')
    await expect(canvas.getByText('−₱575.00')).toBeVisible()
    await expect(canvas.getByText('+₱320.00')).toBeVisible()
  },
}

export const FullList: Story = {
  render: () => (
    <StoryRouter>
      <div style={{ width: 'min(100%, 48rem)', padding: '2rem' }}>
        <div className="panel booking-transactions-panel">
          <BookingTransactionList transactions={transactions} />
        </div>
      </div>
    </StoryRouter>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Returned to wallet')).toBeVisible()
    await expect(canvas.getByText('Refunded to wallet')).toBeVisible()
    await expect(canvas.getAllByRole('link')).toHaveLength(5)
  },
}

export const Empty: Story = {
  render: () => (
    <StoryRouter>
      <div style={{ width: 'min(100%, 48rem)', padding: '2rem' }}>
        <BookingTransactionsPreview transactions={[]} />
      </div>
    </StoryRouter>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No booking transactions yet.')).toBeVisible()
    await expect(canvas.queryByRole('link', { name: 'View more' })).not.toBeInTheDocument()
  },
}

export const Page: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <StoryRouter>
      <TransactionsPageView items={pageItems} />
    </StoryRouter>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Transactions' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Back to bookings' }).getAttribute('href')).toBe('/app')
    await expect(canvas.getByText('Booking completed')).toBeVisible()
    await expect(canvas.getByText('Wallet top-up')).toBeVisible()
    await expect(canvas.getByText('Top-up expired')).toBeVisible()
  },
}

export const WalletHistory: Story = {
  render: () => (
    <StoryRouter>
      <div style={{ width: 'min(100%, 48rem)', padding: '2rem' }}>
        <div className="panel booking-transactions-panel">
          <WalletHistoryList items={pageItems} />
        </div>
      </div>
    </StoryRouter>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Wallet top-up')).toBeVisible()
    await expect(canvas.getByText('Booking completed')).toBeVisible()
    await expect(canvas.getByText('Top-up expired')).toBeVisible()
  },
}
