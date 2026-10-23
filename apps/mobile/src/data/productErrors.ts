export type ProductOperation = 'create_booking' | 'edit_booking' | 'cancel_booking' | 'complete_booking' | 'send_message' | 'update_safety'

const fallbackCopy: Record<ProductOperation, string> = {
  create_booking: 'Your booking request could not be sent. Please review the details and try again.',
  edit_booking: 'This booking request could not be updated. Refresh the booking and try again.',
  cancel_booking: 'This booking could not be cancelled. Refresh the booking and try again.',
  complete_booking: 'Completion could not be confirmed. Please try again later.',
  send_message: 'Your message could not be sent. Please try again.',
  update_safety: 'Your safety setting could not be updated. Please try again.',
}

export function safeProductError(operation: ProductOperation, error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (operation === 'create_booking' || operation === 'edit_booking') {
    if (message.includes('insufficient booking balance')) {
      const shortfall = bookingBalanceShortfall(message)
      return shortfall
        ? `Your booking balance is not enough. Add at least ${shortfall} to your wallet before continuing.`
        : 'Your booking balance is not enough for this request.'
    }
    if (message.includes('identity check') || message.includes('verification')) return 'Identity verification must be approved before you can request a booking.'
    if (message.includes('not available') || message.includes('not offered')) return 'This Companion or plan is no longer available. Return to the profile and try another option.'
    if (message.includes('future')) return 'Choose a future date and time.'
    if (operation === 'edit_booking' && (message.includes('only') || message.includes('awaiting'))) {
      return 'This request can no longer be edited. Refresh the booking for its current state.'
    }
  }
  if (operation === 'cancel_booking' && (
    message.includes('active safety hold')
    || message.includes('blocked funds')
    || message.includes('full admin')
  )) {
    return 'Cancellation is unavailable while an admin resolves the booking safety hold.'
  }
  if (operation === 'send_message' && message.includes('not available')) {
    return 'This conversation is not available for new messages.'
  }
  if (operation === 'complete_booking') return completionErrorMessage(error)
  return fallbackCopy[operation]
}

function bookingBalanceShortfall(message: string) {
  const match = message.match(/insufficient booking balance\. add at least (₱\d[\d,]*(?:\.\d{2})?|php \d[\d,]*(?:\.\d{2})?) to your wallet/i)
  if (!match) return null
  return match[1].replace(/^php\s+/i, 'PHP ')
}

/**
 * Finite allowlist for booking-completion server failures. Only recognized
 * member-safe Convex messages map to fixed product copy; anything else,
 * including redacted provider errors, falls back to generic copy. Raw server
 * strings are never rendered.
 */
const completionErrorCopy: Array<{ match: string; message: string }> = [
  { match: 'Only accepted bookings can be completed', message: 'Only an accepted booking can be confirmed complete. Refresh the booking for its current state.' },
  { match: 'Booking cannot be completed before the scheduled session ends', message: 'Completion becomes available after the listed session duration. The server checks the schedule again when you confirm.' },
  { match: 'Booking schedule is invalid', message: 'Completion is unavailable because the scheduled session could not be verified. Refresh the booking or contact support.' },
  { match: 'Choose start evidence or explicitly skip it before confirming completion', message: 'Upload start evidence or explicitly skip it before confirming completion.' },
  { match: 'Choose end evidence or explicitly skip it before confirming completion', message: 'Upload end evidence or explicitly skip it before confirming completion.' },
  { match: 'Booking not found', message: 'This booking is no longer available. Return to your bookings list.' },
  { match: 'Companion profile not found', message: 'This Companion profile is no longer available.' },
  { match: 'Not your booking', message: 'Only the member and the Companion on this booking can confirm completion.' },
  { match: 'Refunded bookings cannot be completed', message: 'This booking was refunded and can no longer be completed.' },
]

export function completionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const recognized = completionErrorCopy.find((entry) => message.includes(entry.match))
  if (recognized) return recognized.message
  return fallbackCopy.complete_booking
}
