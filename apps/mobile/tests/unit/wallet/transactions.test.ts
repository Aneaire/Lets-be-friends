import {
  TRANSACTIONS_BOOKING_LIMIT,
  TRANSACTIONS_DESCRIPTION,
  TRANSACTIONS_ROUTE,
  TRANSACTIONS_TOPUP_LIMIT,
  transactionsActivityState,
  transactionsBookingQueryArgs,
  transactionsPreviewRows,
  transactionsTopUpQueryArgs,
  WALLET_ACTIVITY_PREVIEW_LIMIT,
} from '@/features/finance/transactions'
import { walletActivityRows, type MemberBookingTransaction, type MemberTopUpRecord } from '@/data/walletActivity'

function booking(id: string, createdAt: number): MemberBookingTransaction {
  return {
    _id: id,
    kind: 'booking_reserve',
    amountCentavos: 50_000,
    createdAt,
    bookingId: `booking-${id}`,
    category: 'Coffee and a walk',
    companionDisplayName: 'Mika Santos',
  }
}

function topUp(id: string, createdAt: number): MemberTopUpRecord {
  return {
    _id: id,
    amountCentavos: 100_000,
    status: 'paid',
    createdAt,
    paidAt: createdAt,
  }
}

describe('mobile transactions history parity', () => {
  it('matches the web query limits and describes holder-visible history', () => {
    expect(TRANSACTIONS_BOOKING_LIMIT).toBe(50)
    expect(TRANSACTIONS_TOPUP_LIMIT).toBe(50)
    expect(WALLET_ACTIVITY_PREVIEW_LIMIT).toBe(5)
    expect(TRANSACTIONS_ROUTE).toBe('/transactions')
    expect(TRANSACTIONS_DESCRIPTION).toBe('Holds, payments, top-ups, and refunds from your wallet.')
  })

  it('gates both finance queries until the member is ready', () => {
    expect(transactionsBookingQueryArgs('ready')).toEqual({ limit: 50 })
    expect(transactionsTopUpQueryArgs('ready')).toEqual({ limit: 50 })
    for (const status of ['loading', 'syncing', 'signed_out', 'unconfigured', 'unavailable', 'error'] as const) {
      expect(transactionsBookingQueryArgs(status)).toBe('skip')
      expect(transactionsTopUpQueryArgs(status)).toBe('skip')
    }
  })

  it('waits for both wallet sources before showing history', () => {
    expect(transactionsActivityState({ bookingTransactions: undefined, topUps: [] }).state).toBe('loading')
    expect(transactionsActivityState({ bookingTransactions: [], topUps: undefined }).state).toBe('loading')
    expect(transactionsActivityState({ bookingTransactions: undefined, topUps: undefined }).state).toBe('loading')
  })

  it('reports an empty history only after both sources resolve', () => {
    const result = transactionsActivityState({ bookingTransactions: [], topUps: [] })
    expect(result.state).toBe('ready')
    if (result.state === 'ready') expect(result.rows).toEqual([])
  })

  it('merges booking and top-up activity newest first for the full history page', () => {
    const result = transactionsActivityState({
      bookingTransactions: [booking('older', 1_000), booking('newest-booking', 9_000)],
      topUps: [topUp('middle', 5_000)],
      now: 10_000,
    })
    expect(result.state).toBe('ready')
    if (result.state !== 'ready') throw new Error('expected ready history')
    expect(result.rows.map((row) => row.key)).toEqual(['booking-newest-booking', 'top-up-middle', 'booking-older'])
    expect(result.rows[0]?.bookingId).toBe('booking-newest-booking')
  })

  it('keeps booking rows first when timestamps tie, using a stable merge order', () => {
    const result = transactionsActivityState({
      bookingTransactions: [booking('tied-booking', 4_000)],
      topUps: [topUp('tied-topup', 4_000)],
      now: 5_000,
    })
    if (result.state !== 'ready') throw new Error('expected ready history')
    expect(result.rows.map((row) => row.key)).toEqual(['booking-tied-booking', 'top-up-tied-topup'])
  })

  it('caps the combined history at 100 rows while previews show only 5', () => {
    const bookings = Array.from({ length: 60 }, (_, index) => booking(`b-${index}`, 1_000 + index))
    const topUps = Array.from({ length: 60 }, (_, index) => topUp(`t-${index}`, 2_000 + index))
    const full = walletActivityRows(bookings, topUps, 99_999)
    expect(full).toHaveLength(100)

    const result = transactionsActivityState({ bookingTransactions: bookings, topUps, now: 99_999 })
    if (result.state !== 'ready') throw new Error('expected ready history')
    expect(result.rows).toHaveLength(100)
    const preview = transactionsPreviewRows(result.rows)
    expect(preview).toHaveLength(5)
    expect(preview.map((row) => row.key)).toEqual(result.rows.slice(0, 5).map((row) => row.key))
    const times = result.rows.map((row) => row.time)
    expect([...times].sort((left, right) => right - left)).toEqual(times)
  })
})
