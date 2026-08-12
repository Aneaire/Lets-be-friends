export type ProductOperation = 'create_booking' | 'cancel_booking' | 'complete_booking' | 'send_message'

const fallbackCopy: Record<ProductOperation, string> = {
  create_booking: 'Your booking request could not be sent. Please review the details and try again.',
  cancel_booking: 'This booking could not be cancelled. Refresh the booking and try again.',
  complete_booking: 'Completion could not be confirmed. Please try again later.',
  send_message: 'Your message could not be sent. Please try again.',
}

export function safeProductError(operation: ProductOperation, error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (operation === 'create_booking') {
    if (message.includes('insufficient booking balance')) return 'Your booking balance is not enough for this request.'
    if (message.includes('identity check') || message.includes('verification')) return 'Identity verification must be approved before you can request a booking.'
    if (message.includes('not available') || message.includes('not offered')) return 'This Friend Host or plan is no longer available. Return to the profile and try another option.'
    if (message.includes('future')) return 'Choose a future date and time.'
  }
  if (operation === 'send_message' && message.includes('not available')) {
    return 'This conversation is not available for new messages.'
  }
  if (operation === 'complete_booking' && message.includes('evidence')) {
    return 'Completion needs an additional safety step that is not available in the mobile app yet.'
  }
  return fallbackCopy[operation]
}
