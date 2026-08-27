export type MobileNotificationDestination =
  | { type: 'booking'; audience: 'member' | 'companion'; bookingId: string }
  | { type: 'conversation'; conversationId: string }
  | { type: 'post'; postId: string }
  | { type: 'companion' }
  | { type: 'identity' }
  | { type: 'profile'; userId: string }
  | { type: 'safety' }
  | { type: 'notifications' }

export function notificationReadAction(unread: boolean) {
  return unread
    ? { label: 'Mark as read', icon: 'checkmark-circle-outline' as const }
    : { label: 'Mark as unread', icon: 'mail-unread-outline' as const }
}

export function mobileNotificationRoute(destination: MobileNotificationDestination) {
  switch (destination.type) {
    case 'booking': return destination.audience === 'companion'
      ? { pathname: '/companion-booking/[id]' as const, params: { id: destination.bookingId } }
      : { pathname: '/booking/[id]' as const, params: { id: destination.bookingId } }
    case 'conversation': return { pathname: '/conversation/[id]' as const, params: { id: destination.conversationId } }
    case 'companion': return { pathname: '/companion' as const }
    case 'identity': return { pathname: '/profile' as const }
    case 'profile': return { pathname: '/member-profile/[id]' as const, params: { id: destination.userId } }
    case 'post': return { pathname: '/' as const, params: { postId: destination.postId } }
    case 'safety': return { pathname: '/safety' as const }
    case 'notifications': return { pathname: '/notifications' as const }
  }
}

export function notificationGroup(notification: { priority: 'attention' | 'standard'; readAt?: number }, now = Date.now()) {
  if (notification.priority === 'attention' && notification.readAt === undefined) return 'attention' as const
  if (notification.readAt === undefined || now - notification.readAt < 24 * 60 * 60 * 1000) return 'new' as const
  return 'earlier' as const
}

export function notificationAge(createdAt: number, now = Date.now()) {
  const minutes = Math.floor(Math.max(0, now - createdAt) / 60_000)
  if (minutes < 1) return 'Now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
