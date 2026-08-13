import { safeProductError } from '@/data/productErrors'

describe('safe product error mapping', () => {
  it('maps known booking failures to fixed product copy', () => {
    expect(safeProductError('create_booking', new Error('Insufficient booking balance. Add at least 12345 more centavos.'))).toBe('Your booking balance is not enough for this request.')
    expect(safeProductError('create_booking', new Error('A current identity check is required'))).toBe('Identity verification must be approved before you can request a booking.')
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

  it('explains the unsupported completion safety step without raw errors', () => {
    expect(safeProductError('complete_booking', new Error('Choose end evidence or explicitly skip it.'))).toBe('Completion needs an additional safety step that is not available in the mobile app yet.')
  })
})
