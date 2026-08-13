export type ProductOperation = 'create_booking' | 'edit_booking' | 'cancel_booking' | 'complete_booking' | 'send_message'

const fallbackCopy: Record<ProductOperation, string> = {
  create_booking: 'Your booking request could not be sent. Please review the details and try again.',
  edit_booking: 'This booking request could not be updated. Refresh the booking and try again.',
  cancel_booking: 'This booking could not be cancelled. Refresh the booking and try again.',
  complete_booking: 'Completion could not be confirmed. Please try again later.',
  send_message: 'Your message could not be sent. Please try again.',
}

export function safeProductError(operation: ProductOperation, error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (operation === 'create_booking' || operation === 'edit_booking') {
    if (message.includes('insufficient booking balance')) return 'Your booking balance is not enough for this request.'
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
  if (operation === 'complete_booking' && message.includes('evidence')) {
    return 'Completion needs an additional safety step that is not available in the mobile app yet.'
  }
  return fallbackCopy[operation]
}
