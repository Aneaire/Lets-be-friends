import {
  bookingActivityRow,
  topUpActivityRow,
  walletActivityRows,
  type MemberBookingTransaction,
  type MemberTopUpRecord,
} from '@/data/walletActivity'

const bookingTransaction: MemberBookingTransaction = {
  _id: 'transaction-1',
  kind: 'booking_reserve',
  amountCentavos: 50_000,
  createdAt: 1_000,
  bookingId: 'booking-1',
  category: 'Coffee and a walk',
  companionDisplayName: 'Mika Santos',
}

const paidTopUp: MemberTopUpRecord = {
  _id: 'paid-1',
  amountCentavos: 100_000,
  status: 'paid',
  createdAt: 2_000,
  paidAt: 3_000,
}

describe('wallet activity presentation', () => {
  it('maps booking holds, payments, and refunds to member-facing movements', () => {
    expect(bookingActivityRow(bookingTransaction)).toMatchObject({
      label: 'Reserved for booking',
      detail: 'Mika Santos · Coffee and a walk',
      amountLabel: '₱500.00',
      direction: 'hold',
      tone: 'social',
      bookingId: 'booking-1',
      time: 1_000,
    })
    expect(bookingActivityRow({ ...bookingTransaction, kind: 'booking_complete' })).toMatchObject({
      label: 'Booking completed',
      amountLabel: '−₱500.00',
      direction: 'debit',
      tone: 'neutral',
    })
    expect(bookingActivityRow({ ...bookingTransaction, kind: 'booking_release' })).toMatchObject({
      label: 'Returned to wallet',
      amountLabel: '+₱500.00',
      direction: 'credit',
      tone: 'success',
    })
    expect(bookingActivityRow({ ...bookingTransaction, kind: 'booking_admin_refund' })).toMatchObject({
      label: 'Refunded to wallet',
      amountLabel: '+₱500.00',
      direction: 'credit',
      tone: 'success',
    })
  })

  it('credits a top-up only after provider confirmation', () => {
    expect(topUpActivityRow(paidTopUp)).toMatchObject({
      label: 'Wallet top-up',
      detail: 'Added to your available balance',
      amountLabel: '+₱1,000.00',
      direction: 'credit',
      tone: 'success',
      time: 3_000,
    })
    expect(topUpActivityRow({ ...paidTopUp, paidAt: undefined, status: 'processing', createdAt: 4_000 })).toMatchObject({
      label: 'Top-up pending',
      detail: 'Waiting for payment confirmation',
      amountLabel: '₱1,000.00',
      direction: 'hold',
      tone: 'warning',
      time: 4_000,
    })
    expect(topUpActivityRow({ ...paidTopUp, paidAt: undefined, status: 'failed', createdAt: 5_000 })).toMatchObject({
      label: 'Top-up failed',
      amountLabel: '₱1,000.00',
      direction: 'hold',
      tone: 'danger',
    })
  })

  it('shows an overdue unpaid top-up as expired instead of pending', () => {
    expect(topUpActivityRow({
      ...paidTopUp,
      paidAt: undefined,
      status: 'awaiting_payment',
      createdAt: 5_000,
      expiresAt: 6_000,
    }, 7_000)).toMatchObject({
      label: 'Top-up expired',
      detail: 'The payment window expired',
      direction: 'hold',
      tone: 'danger',
    })
  })

  it('merges booking movements and top-ups newest first and keeps booking links', () => {
    const rows = walletActivityRows(
      [{ ...bookingTransaction, createdAt: 9_000 }],
      [paidTopUp, { ...paidTopUp, _id: 'pending-1', status: 'processing', paidAt: undefined, createdAt: 8_000 }],
      10_000,
    )
    expect(rows.map((row) => row.key)).toEqual(['booking-transaction-1', 'top-up-pending-1', 'top-up-paid-1'])
    expect(rows[0]?.bookingId).toBe('booking-1')
    expect(rows[1]?.bookingId).toBeUndefined()
  })
})
