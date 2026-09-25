import { describe, expect, it } from 'vitest'
import { compactConvexError, extractConvexErrorMessage } from '../../src/lib/convexErrors'

describe('extractConvexErrorMessage', () => {
  it('keeps the meaningful server line and drops the Convex envelope, request ID, and stack', () => {
    const error = new Error(
      '[CONVEX M(bookings:markCompleted)] [Request ID: c5b4ed1b6a010a1f] Server Error Uncaught Error: Booking cannot be completed before the scheduled session ends at handler (../../convex/bookings.ts:401:27) Called by client',
    )

    expect(extractConvexErrorMessage(error, 'Completion could not be confirmed. Try again.'))
      .toBe('Booking cannot be completed before the scheduled session ends')
  })

  it('extracts an uncaught ConvexError payload', () => {
    const error = new Error(
      '[CONVEX M(bookings:markCompleted)] [Request ID: 1a2b3c] Server Error Uncaught ConvexError: Only accepted bookings can be completed at handler (../../convex/bookings.ts:372:13) Called by client',
    )

    expect(extractConvexErrorMessage(error, 'fallback')).toBe('Only accepted bookings can be completed')
  })

  it('strips the envelope when the runtime omits the uncaught marker', () => {
    const error = new Error(
      '[CONVEX A(withdrawals:listReceivingInstitutions)] [Request ID: 9f8e] Server Error Uncaught PaymongoRequestError: failed to get transfers resource at paymongoRequest (../../convex/paymongo.ts:807:27) Called by client',
    )

    expect(extractConvexErrorMessage(error, 'fallback'))
      .toBe('Uncaught PaymongoRequestError: failed to get transfers resource')
  })

  it('does not truncate a clean message that contains the word at', () => {
    expect(extractConvexErrorMessage(new Error('Evidence cannot be uploaded at this time.'), 'fallback'))
      .toBe('Evidence cannot be uploaded at this time.')
  })

  it('prefers structured data attached to an error object', () => {
    expect(extractConvexErrorMessage({ data: 'Booking schedule is invalid' }, 'fallback'))
      .toBe('Booking schedule is invalid')
  })

  it('falls back for missing, empty, or unrecognized errors', () => {
    expect(extractConvexErrorMessage(undefined, 'fallback')).toBe('fallback')
    expect(extractConvexErrorMessage(new Error(''), 'fallback')).toBe('fallback')
    expect(extractConvexErrorMessage({}, 'fallback')).toBe('fallback')
    expect(compactConvexError('   ')).toBe('')
  })
})
