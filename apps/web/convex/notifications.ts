import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { mutation, query, type MutationCtx } from './_generated/server'
import { requireViewer } from './lib'
import { areUsersBlocked, preference } from './safety'

export type NotificationKind = Doc<'notifications'>['kind']
export type NotificationPriority = Doc<'notifications'>['priority']

export type NotificationDestination =
  | { type: 'booking'; audience: 'member' | 'companion'; bookingId: string }
  | { type: 'conversation'; conversationId: string }
  | { type: 'post'; postId: string }
  | { type: 'companion' }
  | { type: 'identity' }
  | { type: 'profile'; userId: string }
  | { type: 'safety' }
  | { type: 'notifications' }

export type CreateNotificationInput = {
  recipientUserId: Id<'users'>
  actorUserId?: Id<'users'>
  kind: NotificationKind
  priority: NotificationPriority
  dedupeKey: string
  bookingId?: Id<'bookings'>
  conversationId?: Id<'directConversations'>
  postId?: Id<'posts'>
  commentId?: Id<'postComments'>
  reviewId?: Id<'reviews'>
  companionProfileId?: Id<'companionProfiles'>
  verificationRequestId?: Id<'verificationRequests'>
  reportId?: Id<'reports'>
}

export async function createNotification(ctx: MutationCtx, input: CreateNotificationInput): Promise<Id<'notifications'> | null>
export async function createNotification(ctx: { db: any; scheduler?: never }, input: CreateNotificationInput): Promise<Id<'notifications'> | null>
export async function createNotification(ctx: MutationCtx | { db: any; scheduler?: never }, input: CreateNotificationInput) {
  if (input.actorUserId === input.recipientUserId) return null
  if (!input.dedupeKey.trim()) throw new Error('Notification dedupe key is required')
  const recipient = await ctx.db.get(input.recipientUserId)
  if (!recipient) return null
  if (input.actorUserId && ['direct_message', 'post_commented', 'new_follower'].includes(input.kind)) {
    if (await areUsersBlocked(ctx, input.recipientUserId, input.actorUserId)) return null
    if ((await preference(ctx, input.recipientUserId, input.actorUserId))?.mutedAt) return null
  }
  const existing = await ctx.db.query('notifications')
    .withIndex('by_recipient_dedupe', (q: any) => q.eq('recipientUserId', input.recipientUserId).eq('dedupeKey', input.dedupeKey))
    .unique()
  if (existing) return existing._id
  const notificationId = await ctx.db.insert('notifications', { ...input, createdAt: Date.now() })
  if ('scheduler' in ctx && ctx.scheduler) {
    await ctx.scheduler.runAfter(0, internal.pushNotifications.deliverNotification, { notificationId })
  }
  return notificationId
}

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const limit = boundedLimit(args.limit, 8, 20)
    const rows = await ctx.db.query('notifications')
      .withIndex('by_recipient_created_at', (q) => q.eq('recipientUserId', viewer._id))
      .order('desc')
      .take(limit)
    return await Promise.all(rows.map((row) => presentNotification(ctx, row, viewer._id)))
  },
})

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const result = await ctx.db.query('notifications')
      .withIndex('by_recipient_created_at', (q) => q.eq('recipientUserId', viewer._id))
      .order('desc')
      .paginate(args.paginationOpts)
    return {
      ...result,
      page: await Promise.all(result.page.map((row) => presentNotification(ctx, row, viewer._id))),
    }
  },
})

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    const unread = await ctx.db.query('notifications')
      .withIndex('by_recipient_read_at', (q) => q.eq('recipientUserId', viewer._id).eq('readAt', undefined))
      .collect()
    return unread.length
  },
})

export const open = mutation({
  args: { notificationId: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    let notification: Doc<'notifications'> | null
    try {
      notification = await ctx.db.get('notifications', args.notificationId as Id<'notifications'>)
    } catch {
      return { status: 'unavailable' as const }
    }
    if (!notification || notification.recipientUserId !== viewer._id) return { status: 'unavailable' as const }
    if (!notification.readAt) await ctx.db.patch(notification._id, { readAt: Date.now() })
    const target = await resolveTarget(ctx, notification, viewer._id)
    return target.available
      ? { status: 'ready' as const, destination: target.destination }
      : { status: 'unavailable' as const }
  },
})

export const markRead = mutation({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const notification = await requireOwnedNotification(ctx, args.notificationId, viewer._id)
    if (!notification.readAt) await ctx.db.patch(notification._id, { readAt: Date.now() })
  },
})

export const markUnread = mutation({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const notification = await requireOwnedNotification(ctx, args.notificationId, viewer._id)
    if (notification.readAt) await ctx.db.patch(notification._id, { readAt: undefined })
  },
})

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    const unread = await ctx.db.query('notifications')
      .withIndex('by_recipient_read_at', (q) => q.eq('recipientUserId', viewer._id).eq('readAt', undefined))
      .collect()
    const readAt = Date.now()
    await Promise.all(unread.map((notification) => ctx.db.patch(notification._id, { readAt })))
    return { updated: unread.length }
  },
})

async function requireOwnedNotification(ctx: { db: any }, notificationId: Id<'notifications'>, viewerId: Id<'users'>) {
  const notification = await ctx.db.get(notificationId) as Doc<'notifications'> | null
  if (!notification) throw new Error('Notification not found')
  if (notification.recipientUserId !== viewerId) throw new Error('Not your notification')
  return notification
}

async function presentNotification(ctx: { db: any }, notification: Doc<'notifications'>, viewerId: Id<'users'>) {
  const actor = notification.actorUserId ? await ctx.db.get(notification.actorUserId) as Doc<'users'> | null : null
  const actorAvailable = Boolean(actor && !actor.suspended)
  const actorName = actorAvailable ? actor!.displayName : 'Let\'s Be Friends'
  const target = await resolveTarget(ctx, notification, viewerId)
  const copy = notificationCopy(notification.kind, actorName, target)
  return {
    id: String(notification._id),
    kind: notification.kind,
    priority: notification.priority,
    actor: notification.actorUserId ? {
      userId: actorAvailable ? String(notification.actorUserId) : undefined,
      displayName: actorName,
      available: actorAvailable,
    } : undefined,
    title: copy.title,
    body: copy.body,
    tone: copy.tone,
    destination: target.destination,
    targetAvailable: target.available,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  }
}

async function resolveTarget(ctx: { db: any }, notification: Doc<'notifications'>, viewerId: Id<'users'>): Promise<{
  available: boolean
  destination: NotificationDestination
  category?: string
}> {
  if (notification.bookingId) {
    const booking = await ctx.db.get(notification.bookingId) as Doc<'bookings'> | null
    if (!booking) return { available: false, destination: { type: 'notifications' } }
    const companion = await ctx.db.get(booking.companionProfileId) as Doc<'companionProfiles'> | null
    const audience = booking.memberId === viewerId ? 'member' : companion?.userId === viewerId ? 'companion' : null
    if (!audience) return { available: false, destination: { type: 'notifications' } }
    return { available: true, destination: { type: 'booking', audience, bookingId: String(booking._id) }, category: booking.category }
  }
  if (notification.postId) {
    const post = await ctx.db.get(notification.postId) as Doc<'posts'> | null
    const author = post ? await ctx.db.get(post.authorId) as Doc<'users'> | null : null
    return post && !post.hidden && !post.deletedAt && author && !author.suspended
      ? { available: true, destination: { type: 'post', postId: String(post._id) } }
      : { available: false, destination: { type: 'notifications' } }
  }
  if (notification.conversationId) {
    const conversation = await ctx.db.get(notification.conversationId) as Doc<'directConversations'> | null
    const participant = conversation && (conversation.participantOneId === viewerId || conversation.participantTwoId === viewerId)
    return participant
      ? { available: true, destination: { type: 'conversation', conversationId: String(conversation!._id) } }
      : { available: false, destination: { type: 'notifications' } }
  }
  if (notification.companionProfileId) {
    const companion = await ctx.db.get(notification.companionProfileId)
    return { available: Boolean(companion), destination: { type: 'companion' } }
  }
  if (notification.verificationRequestId) return { available: true, destination: { type: 'identity' } }
  if (notification.reportId) return { available: true, destination: { type: 'safety' } }
  if (notification.kind === 'new_follower' && notification.actorUserId) {
    return { available: true, destination: { type: 'profile', userId: String(notification.actorUserId) } }
  }
  return { available: true, destination: { type: 'notifications' } }
}

function notificationCopy(kind: NotificationKind, actorName: string, target: { available: boolean; category?: string }) {
  const category = target.category ? ` for ${target.category}` : ''
  const unavailable = target.available ? '' : ' This item is no longer available.'
  switch (kind) {
    case 'booking_request': return { title: 'New booking request', body: `${actorName} sent a booking request${category}.${unavailable}`, tone: 'social' as const }
    case 'booking_request_updated': return { title: 'Booking request updated', body: `${actorName} updated the booking request${category}.${unavailable}`, tone: 'social' as const }
    case 'booking_accepted': return { title: 'Booking accepted', body: `${actorName} accepted your booking request${category}.${unavailable}`, tone: 'social' as const }
    case 'booking_declined': return { title: 'Booking declined', body: `${actorName} declined your booking request${category}.${unavailable}`, tone: 'danger' as const }
    case 'booking_cancelled': return { title: 'Booking cancelled', body: `${actorName} cancelled the booking${category}.${unavailable}`, tone: 'social' as const }
    case 'booking_completion_confirmed': return { title: 'Completion confirmation needed', body: `${actorName} confirmed the experience is complete. Add your confirmation when ready.${unavailable}`, tone: 'social' as const }
    case 'booking_review_window_opened': return { title: 'Review window open', body: `Both participants confirmed the experience. You can now leave a review.${unavailable}`, tone: 'social' as const }
    case 'direct_message': return { title: 'New message', body: `${actorName} sent you a message.${unavailable}`, tone: 'social' as const }
    case 'post_commented': return { title: 'New comment', body: `${actorName} commented on your post.${unavailable}`, tone: 'social' as const }
    case 'new_follower': return { title: 'New follower', body: `${actorName} followed you.`, tone: 'social' as const }
    case 'review_received': return { title: 'Review received', body: `${actorName} left you a review.${unavailable}`, tone: 'social' as const }
    case 'companion_application_approved': return { title: 'Companion application approved', body: 'Your Companion application was approved.', tone: 'self' as const }
    case 'companion_application_rejected': return { title: 'Companion application not approved', body: 'Your Companion application was not approved. Open Companion tools for your current status.', tone: 'danger' as const }
    case 'identity_verification_approved': return { title: 'Identity verification approved', body: 'Your identity verification was approved.', tone: 'self' as const }
    case 'identity_verification_rejected': return { title: 'Identity verification not approved', body: 'Your identity verification was not approved. Open your account to review the next step.', tone: 'danger' as const }
    case 'report_reviewing': return { title: 'Report under review', body: 'The safety team is reviewing your report.', tone: 'self' as const }
    case 'report_resolved': return { title: 'Report resolved', body: 'The safety team resolved your report.', tone: 'self' as const }
    case 'report_dismissed': return { title: 'Report closed', body: 'The safety team closed your report.', tone: 'danger' as const }
  }
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number) {
  if (value === undefined) return fallback
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.floor(value), 1), maximum)
}
