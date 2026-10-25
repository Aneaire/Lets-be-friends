import { walletActivityRows, type MemberBookingTransaction, type MemberTopUpRecord, type WalletActivityRow } from '@/data/walletActivity'
import type { MobileMemberState } from '@/member/MobileMember'

export const TRANSACTIONS_ROUTE = '/transactions' as const
export const TRANSACTIONS_BOOKING_LIMIT = 50 as const
export const TRANSACTIONS_TOPUP_LIMIT = 50 as const
export const WALLET_ACTIVITY_PREVIEW_LIMIT = 5 as const
export const TRANSACTIONS_DESCRIPTION = 'Holds, payments, top-ups, and refunds from your wallet.' as const

export function transactionsBookingQueryArgs(status: MobileMemberState['status']) {
  return status === 'ready' ? { limit: TRANSACTIONS_BOOKING_LIMIT } : ('skip' as const)
}

export function transactionsTopUpQueryArgs(status: MobileMemberState['status']) {
  return status === 'ready' ? { limit: TRANSACTIONS_TOPUP_LIMIT } : ('skip' as const)
}

export type TransactionsActivityInput = {
  bookingTransactions: readonly MemberBookingTransaction[] | undefined
  topUps: readonly MemberTopUpRecord[] | undefined
  now?: number
}

export function transactionsActivityState({ bookingTransactions, topUps, now = Date.now() }: TransactionsActivityInput): {
  state: 'loading'
  rows?: undefined
} | {
  state: 'ready'
  rows: WalletActivityRow[]
} {
  if (bookingTransactions === undefined || topUps === undefined) return { state: 'loading' }
  return { state: 'ready', rows: walletActivityRows(bookingTransactions, topUps, now) }
}

export function transactionsPreviewRows(rows: readonly WalletActivityRow[]): WalletActivityRow[] {
  return rows.slice(0, WALLET_ACTIVITY_PREVIEW_LIMIT)
}
