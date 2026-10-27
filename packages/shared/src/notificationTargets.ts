/**
 * How long a notification target stays visibly highlighted after the app
 * scrolls to it. Long enough to notice, short enough not to look like a
 * permanent state.
 */
export const NOTIFICATION_HIGHLIGHT_MS = 3_500

export type CircleNotificationSection = 'joinRequests' | 'pendingPosts' | 'members' | 'hostTransfer'

export function circleNotificationTab(section: string | undefined, canModerate: boolean) {
  if (section === 'pendingPosts' && canModerate) return 'pending' as const
  if (section === 'joinRequests' && canModerate || section === 'members') return 'members' as const
  // The invitation is above the tabs. About lets the recipient review the Circle.
  if (section === 'hostTransfer') return 'about' as const
  return 'discussions' as const
}
