import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { mutation, query, type MutationCtx } from './_generated/server'
import { requireViewer } from './lib'
import { buildInAppNotificationCopy, notificationDefinition, type NotificationKind as CatalogNotificationKind } from './notificationCatalog'
import { areUsersBlocked, preference } from './safety'

export type NotificationKind = CatalogNotificationKind
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
  messageId?: Id<'directMessages'>
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
  const definition = notificationDefinition(input.kind)
  if (!definition.allowedPriorities.includes(input.priority)) {
    throw new Error(`Priority ${input.priority} is not allowed for ${input.kind}`)
  }
  const recipient = await ctx.db.get(input.recipientUserId)
  if (!recipient) return null
  if (input.actorUserId && definition.respectsSocialPreferences) {
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
  const copy = buildInAppNotificationCopy(notification.kind, {
    actorName,
    targetAvailable: target.available,
    category: target.category,
    isComment: Boolean(notification.commentId),
  })
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
  const destination = notificationDefinition(notification.kind).destination
  if (destination === 'booking') {
    if (!notification.bookingId) return { available: false, destination: { type: 'notifications' } }
    const booking = await ctx.db.get(notification.bookingId) as Doc<'bookings'> | null
    if (!booking) return { available: false, destination: { type: 'notifications' } }
    const companion = await ctx.db.get(booking.companionProfileId) as Doc<'companionProfiles'> | null
    const audience = booking.memberId === viewerId ? 'member' : companion?.userId === viewerId ? 'companion' : null
    if (!audience) return { available: false, destination: { type: 'notifications' } }
    return { available: true, destination: { type: 'booking', audience, bookingId: String(booking._id) }, category: booking.category }
  }
  if (destination === 'post') {
    if (!notification.postId) return { available: false, destination: { type: 'notifications' } }
    const post = await ctx.db.get(notification.postId) as Doc<'posts'> | null
    const author = post ? await ctx.db.get(post.authorId) as Doc<'users'> | null : null
    return post && !post.hidden && !post.deletedAt && author && !author.suspended
      ? { available: true, destination: { type: 'post', postId: String(post._id) } }
      : { available: false, destination: { type: 'notifications' } }
  }
  if (destination === 'conversation') {
    if (!notification.conversationId) return { available: false, destination: { type: 'notifications' } }
    const conversation = await ctx.db.get(notification.conversationId) as Doc<'directConversations'> | null
    const participant = conversation && (conversation.participantOneId === viewerId || conversation.participantTwoId === viewerId)
    return participant
      ? { available: true, destination: { type: 'conversation', conversationId: String(conversation!._id) } }
      : { available: false, destination: { type: 'notifications' } }
  }
  if (destination === 'companion') {
    if (!notification.companionProfileId) return { available: false, destination: { type: 'notifications' } }
    const companion = await ctx.db.get(notification.companionProfileId)
    return { available: Boolean(companion), destination: { type: 'companion' } }
  }
  if (destination === 'identity') return { available: true, destination: { type: 'identity' } }
  if (destination === 'safety') {
    return notification.reportId
      ? { available: true, destination: { type: 'safety' } }
      : { available: false, destination: { type: 'notifications' } }
  }
  if (destination === 'profile' && notification.actorUserId) {
    return { available: true, destination: { type: 'profile', userId: String(notification.actorUserId) } }
  }
  return { available: false, destination: { type: 'notifications' } }
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number) {
  if (value === undefined) return fallback
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.floor(value), 1), maximum)
}
