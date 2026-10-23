import { safeProductError } from '@/data/productErrors'

describe('safe product error mapping', () => {
  it('maps known booking failures to fixed product copy', () => {
    expect(safeProductError('create_booking', new Error('Insufficient booking balance. Add at least ₱123.45 to your wallet before sending.'))).toBe(
      'Your booking balance is not enough. Add at least ₱123.45 to your wallet before continuing.',
    )
    expect(safeProductError('create_booking', new Error('A current identity check is required'))).toBe('Identity verification must be approved before you can request a booking.')
  })

  it('keeps a safe peso shortfall and rejects malformed amounts', () => {
    expect(safeProductError('edit_booking', new Error('Insufficient booking balance. Add at least ₱1,234.00 to your wallet before updating.'))).toBe(
      'Your booking balance is not enough. Add at least ₱1,234.00 to your wallet before continuing.',
    )
    expect(safeProductError('create_booking', new Error('Insufficient booking balance. Add at least PHP 45.00 to your wallet before sending.'))).toBe(
      'Your booking balance is not enough. Add at least PHP 45.00 to your wallet before continuing.',
    )
    expect(safeProductError('create_booking', new Error('Insufficient booking balance. Add at least <script> to your wallet before sending.'))).toBe(
      'Your booking balance is not enough for this request.',
    )
  })

  it.each([
    'This booking has an active safety hold.',
    'Cancellation is unavailable for blocked funds.',
    'A full admin must resolve the reserved funds.',
  ])('maps cancellation holds to fixed non-retry guidance: %s', (message) => {
    expect(safeProductError('cancel_booking', new Error(message))).toBe('Cancellation is unavailable while an admin resolves the booking safety hold.')
  })

  it('never returns unknown backend diagnostics', () => {
    const raw = 'internal member id abc123 and 90210 centavos'
    expect(safeProductError('cancel_booking', new Error(raw))).toBe('This booking could not be cancelled. Refresh the booking and try again.')
    expect(safeProductError('cancel_booking', new Error(raw))).not.toContain('abc123')
  })

  it('maps recognized completion failures to fixed product copy, never raw errors', () => {
    expect(safeProductError('complete_booking', new Error('Choose end evidence or explicitly skip it before confirming completion.'))).toBe(
      'Upload end evidence or explicitly skip it before confirming completion.',
    )
    expect(safeProductError('complete_booking', new Error('Booking cannot be completed before the scheduled session ends.'))).toBe(
      'Completion becomes available after the listed session duration. The server checks the schedule again when you confirm.',
    )
    expect(safeProductError('complete_booking', new Error('Only accepted bookings can be completed.'))).toBe(
      'Only an accepted booking can be confirmed complete. Refresh the booking for its current state.',
    )
    expect(safeProductError('complete_booking', new Error('Uncaught Error: Booking schedule is invalid. Called by client'))).toBe(
      'Completion is unavailable because the scheduled session could not be verified. Refresh the booking or contact support.',
    )
  })

  it('falls back to generic copy for unrecognized completion errors', () => {
    const raw = 'internal member id abc123 and 90210 centavos'
    expect(safeProductError('complete_booking', new Error(raw))).toBe('Completion could not be confirmed. Please try again later.')
    expect(safeProductError('complete_booking', new Error('Server Error'))).toBe('Completion could not be confirmed. Please try again later.')
  })

  it('uses fixed copy for safety-setting failures', () => {
    const raw = 'private user id member_123 is unavailable'
    expect(safeProductError('update_safety', new Error(raw))).toBe('Your safety setting could not be updated. Please try again.')
    expect(safeProductError('update_safety', new Error(raw))).not.toContain('member_123')
  })
})
