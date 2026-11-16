export type MobileNotificationDestination =
  | { type: 'booking'; audience: 'member' | 'companion'; bookingId: string }
  | { type: 'conversation'; conversationId: string; messageId?: string }
  | { type: 'post'; postId: string; commentId?: string }
  | { type: 'circle'; circleId: string; postId?: string; commentId?: string; section?: 'joinRequests' | 'pendingPosts' | 'members' | 'hostTransfer' }
  | { type: 'review'; reviewId: string; companionProfileId?: string; bookingId?: string; commentId?: string }
  | { type: 'companion' }
  | { type: 'identity'; outcome: 'verified' | 'status' }
  | { type: 'profile'; userId: string }
  | { type: 'safety' }
  | { type: 'notifications' }

export function notificationReadAction(unread: boolean) {
  return unread
    ? { label: 'Mark as read', icon: 'checkmark-circle-outline' as const }
    : { label: 'Mark as unread', icon: 'mail-unread-outline' as const }
}

export type NotificationVisualIcon =
  | 'heart'
  | 'chatbubble'
  | 'chatbubble-ellipses'
  | 'person-add'
  | 'calendar-outline'
  | 'star'
  | 'shield-checkmark'
  | 'flag'
  | 'gift'
  | 'people'
  | 'notifications'

/**
 * Chooses the small badge icon shown over a notification actor stack. The
 * icon explains why the notification exists without repeating the copy, which
 * keeps the row readable when several actors are stacked together.
 */export function notificationVisualIcon(kind?: string): NotificationVisualIcon {
  switch (kind) {
    case 'post_liked':
    case 'comment_liked':
    case 'circle_reaction':
    case 'circle_comment_liked':
    case 'review_liked':
      return 'heart'
    case 'direct_message':
      return 'chatbubble'
    case 'post_commented':
    case 'comment_reply':
    case 'mention':
    case 'circle_reply':
    case 'circle_mention':
      return 'chatbubble-ellipses'
    case 'new_follower':
      return 'person-add'
    case 'booking_request':
    case 'booking_request_updated':
    case 'booking_accepted':
    case 'booking_declined':
    case 'booking_cancelled':
    case 'booking_completion_confirmed':
    case 'booking_review_window_opened':
    case 'booking_reminder':
      return 'calendar-outline'
    case 'review_received':
    case 'review_commented':
      return 'star'
    case 'identity_verification_approved':
    case 'identity_verification_rejected':
    case 'identity_verification_expiring':
    case 'identity_verification_expired':
      return 'shield-checkmark'
    case 'report_reviewing':
    case 'report_resolved':
    case 'report_dismissed':
      return 'flag'
    case 'referral_credit':
    case 'referral_reversal':
      return 'gift'
    case 'circle_join_requested':
    case 'circle_join_approved':
    case 'circle_join_rejected':
    case 'circle_post_review_requested':
    case 'circle_post_approved':
    case 'circle_post_rejected':
    case 'circle_announcement':
    case 'circle_member_removed':
    case 'circle_member_banned':
    case 'circle_role_changed':
    case 'circle_host_transfer':
    case 'circle_lifecycle':
    case 'companion_application_approved':
    case 'companion_application_rejected':
      return 'people'
    default:
      return 'notifications'
  }
}

/**
 * Initials stand in for members who have not uploaded a profile photo, so an
 * aggregate stack still reads as several distinct people instead of repeating
 * the same placeholder portrait.
 */
export function notificationInitials(displayName: string) {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? '')
    .join('')
}

export function mobileNotificationRoute(destination: MobileNotificationDestination) {
  switch (destination.type) {
    case 'booking': return destination.audience === 'companion'
      ? { pathname: '/companion-booking/[id]' as const, params: { id: destination.bookingId } }
      : { pathname: '/booking/[id]' as const, params: { id: destination.bookingId } }
    case 'conversation': return { pathname: '/conversation/[id]' as const, params: { id: destination.conversationId, ...(destination.messageId ? { messageId: destination.messageId } : {}) } }
    case 'companion': return { pathname: '/companion' as const }
    case 'identity': return destination.outcome === 'verified'
      ? { pathname: '/verified' as const }
      : { pathname: '/get-verified' as const }
    case 'profile': return { pathname: '/member-profile/[id]' as const, params: { id: destination.userId } }
    case 'post': return destination.commentId
      ? { pathname: '/post-comments/[id]' as const, params: { id: destination.postId, commentId: destination.commentId } }
      : { pathname: '/' as const, params: { postId: destination.postId } }
    case 'circle': return { pathname: '/circles/[id]' as const, params: { id: destination.circleId, ...(destination.postId ? { postId: destination.postId } : {}), ...(destination.commentId ? { commentId: destination.commentId } : {}), ...(destination.section ? { section: destination.section } : {}) } }
    case 'review': return destination.companionProfileId
      ? { pathname: '/companion-profile/[id]' as const, params: { id: destination.companionProfileId, reviewId: destination.reviewId, ...(destination.commentId ? { commentId: destination.commentId } : {}) } }
      : destination.bookingId
        ? { pathname: '/booking/[id]' as const, params: { id: destination.bookingId } }
        : { pathname: '/notifications' as const }
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
