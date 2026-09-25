import { useCallback, useState } from 'react'

export function usePinnedBookingDismissal(scope: { conversationId?: string; bookingId?: string }) {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const key = scope.bookingId ? `${scope.conversationId ?? ''}:${scope.bookingId}` : null
  const dismissed = key !== null && dismissedKey === key

  const dismiss = useCallback(() => {
    if (key) setDismissedKey(key)
  }, [key])

  return { dismissed, dismiss }
}
