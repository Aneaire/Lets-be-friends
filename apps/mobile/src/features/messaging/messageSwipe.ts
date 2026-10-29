export const MESSAGE_SWIPE_CLAIM_DISTANCE = 10
export const MESSAGE_SWIPE_THRESHOLD = 56

/** A horizontal drag must lead the vertical drag before the row claims it. */
export function isMessageSwipeGesture(dx: number, dy: number) {
  return Math.abs(dx) > MESSAGE_SWIPE_CLAIM_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5
}

/**
 * Right swipe replies to any message. Left swipe opens message options only
 * when the row has actions, which the caller decides.
 */
export function messageSwipeAction(dx: number) {
  if (dx >= MESSAGE_SWIPE_THRESHOLD) return 'reply' as const
  if (dx <= -MESSAGE_SWIPE_THRESHOLD) return 'actions' as const
  return 'none' as const
}
