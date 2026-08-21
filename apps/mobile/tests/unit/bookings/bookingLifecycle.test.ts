import {
  bookingActionVisibility,
  bookingLifecyclePresentation,
  formatLifecycleTimestamp,
  validateCancellationReason,
  type BookingLifecycleInput,
  type BookingSettlementState,
} from '@/data/bookingLifecycle'

const base: BookingLifecycleInput = {
  status: 'request_sent',
  viewerRole: 'member',
  memberId: 'member-1',
  companionUserId: 'companion-1',
  memberDisplayName: 'Member Name',
  companionDisplayName: 'Companion Name',
}

describe('booking lifecycle presentation', () => {
  it('shows pending request editing only to the member for request_sent', () => {
    expect(bookingActionVisibility({ status: 'request_sent', viewerRole: 'member' }).canEditRequest).toBe(true)
    expect(bookingActionVisibility({ status: 'accepted', viewerRole: 'member' }).canEditRequest).toBe(false)
    expect(bookingActionVisibility({ status: 'request_sent', viewerRole: 'companion' }).canEditRequest).toBe(false)
  })

  it.each(['verification_required', 'request_sent', 'accepted'] as const)('shows shared cancellation for members and companions in %s', (status) => {
    expect(bookingActionVisibility({ status, viewerRole: 'member' }).canCancel).toBe(true)
    expect(bookingActionVisibility({ status, viewerRole: 'companion' }).canCancel).toBe(true)
  })

  it('hides cancellation after either completion confirmation or a blocked settlement', () => {
    expect(bookingActionVisibility({ status: 'accepted', viewerRole: 'member', memberCompletedAt: 1 }).canCancel).toBe(false)
    expect(bookingActionVisibility({ status: 'accepted', viewerRole: 'companion', companionCompletedAt: 1 }).canCancel).toBe(false)
    expect(bookingActionVisibility({ status: 'accepted', viewerRole: 'member', settlementState: 'blocked' }).canCancel).toBe(false)
    expect(bookingActionVisibility({ status: 'accepted', viewerRole: 'companion', settlementState: 'blocked' }).canCancel).toBe(false)
  })

  it('derives known member, known companion, and unknown cancellation actors', () => {
    expect(bookingLifecyclePresentation({ ...base, cancelledByUserId: 'member-1' }).cancellation?.actor).toBe('You (member)')
    expect(bookingLifecyclePresentation({ ...base, cancelledByUserId: 'companion-1' }).cancellation?.actor).toBe('Companion Name')
    expect(bookingLifecyclePresentation({ ...base, cancelledByUserId: 'other-1' }).cancellation?.actor).toBe('A booking participant')
    expect(bookingLifecyclePresentation({ ...base, viewerRole: 'companion', cancelledByUserId: 'companion-1' }).cancellation?.actor).toBe('You (Companion)')
  })

  it('trims an optional reason and enforces the 1,000-character cap', () => {
    expect(validateCancellationReason('  Changed plans  ')).toEqual({ ok: true, reason: 'Changed plans' })
    expect(validateCancellationReason('   ')).toEqual({ ok: true, reason: undefined })
    expect(validateCancellationReason('x'.repeat(1_000))).toMatchObject({ ok: true })
    expect(validateCancellationReason('x'.repeat(1_001))).toEqual({ ok: false, message: 'Cancellation reason can be up to 1,000 characters.' })
  })

  it.each([
    ['unreserved', 'Not reserved'],
    ['reserved', 'Reserved in member booking wallet'],
    ['pending', 'Pending settlement'],
    ['blocked', 'Blocked for admin resolution'],
    ['settled', 'Settled to Companion earnings wallet'],
    ['refunded', 'Returned to member booking wallet'],
  ] as const)('presents truthful %s settlement state', (settlementState, label) => {
    const settlement = bookingLifecyclePresentation({ ...base, settlementState: settlementState as BookingSettlementState }).settlement
    expect(settlement?.label).toBe(label)
    expect(settlement?.explanation).toBeTruthy()
  })

  it('keeps cancelled unreserved settlement copy status-neutral', () => {
    const settlement = bookingLifecyclePresentation({ ...base, status: 'cancelled', settlementState: 'unreserved' }).settlement
    expect(settlement?.explanation).toBe('No funds are reserved from the member booking wallet for this booking.')
    expect(settlement?.explanation).not.toContain('awaiting acceptance')
  })

  it('does not describe wallet settlement as an external withdrawal or refund', () => {
    const reserved = bookingLifecyclePresentation({ ...base, settlementState: 'reserved' }).settlement
    const pending = bookingLifecyclePresentation({ ...base, settlementState: 'pending' }).settlement
    const settled = bookingLifecyclePresentation({ ...base, settlementState: 'settled' }).settlement
    const refunded = bookingLifecyclePresentation({ ...base, settlementState: 'refunded' }).settlement

    expect(reserved?.explanation).toContain('No Companion amount is externally withdrawable')
    expect(pending?.explanation).toContain('not externally withdrawable')
    expect(settled?.explanation).toContain('not an external payout or withdrawal')
    expect(refunded?.explanation).toContain('member booking wallet')
    expect(refunded?.explanation).toContain('not a PayMongo, card, bank, or other external refund')
  })

  it('formats lifecycle timestamps in Manila time deterministically', () => {
    expect(formatLifecycleTimestamp(Date.UTC(2026, 7, 12, 2, 30))).toBe('Aug 12, 2026, 10:30 AM')
  })
})
