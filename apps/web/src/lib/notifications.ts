export type NotificationDestination =
  | { type: 'booking'; audience: 'member' | 'companion'; bookingId: string }
  | { type: 'conversation'; conversationId: string }
  | { type: 'post'; postId: string }
  | { type: 'companion' }
  | { type: 'identity' }
  | { type: 'profile'; userId: string }
  | { type: 'safety' }
  | { type: 'notifications' }

export function webDestination(destination: NotificationDestination) {
  switch (destination.type) {
    case 'booking':
      return destination.audience === 'companion'
        ? { to: '/companion' as const, search: { bookingId: destination.bookingId } }
        : { to: '/app' as const, search: { bookingId: destination.bookingId } }
    case 'conversation': return { to: '/messages' as const, search: { conversationId: destination.conversationId } }
    case 'post': return { to: '/social' as const, search: { postId: destination.postId } }
    case 'companion': return { to: '/companion' as const, search: {} }
    case 'identity': return { to: '/profile' as const, search: {} }
    case 'profile': return { to: '/social' as const, search: {} }
    case 'safety': return { to: '/safety' as const, search: {} }
    case 'notifications': return { to: '/notifications' as const, search: {} }
  }
}

export function notificationSection(notification: { priority: 'attention' | 'standard'; readAt?: number }, now = Date.now()) {
  if (notification.priority === 'attention' && notification.readAt === undefined) return 'attention' as const
  if (notification.readAt === undefined || now - notification.readAt < 24 * 60 * 60 * 1000) return 'new' as const
  return 'earlier' as const
}

export function formatNotificationTime(createdAt: number, now = Date.now()) {
  const elapsed = Math.max(0, now - createdAt)
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(createdAt)
}
