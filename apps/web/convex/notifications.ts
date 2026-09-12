import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { mutation, query, type MutationCtx } from './_generated/server'
import { requireViewer } from './lib'
import { buildInAppNotificationCopy, notificationDefinition, type NotificationKind as CatalogNotificationKind } from './notificationCatalog'
import { areUsersBlocked, isHiddenByPreference, preference } from './safety'
import { hasCurrentIdentityApproval } from './identityVerification'
import { isCircleParticipantRole, getCircleAuthorization } from './circleAuthorization'

export type NotificationKind = CatalogNotificationKind
export type NotificationPriority = Doc<'notifications'>['priority']

export type NotificationDestination =
  | { type: 'booking'; audience: 'member' | 'companion'; bookingId: string }
  | { type: 'conversation'; conversationId: string; messageId?: string }
  | { type: 'post'; postId: string; commentId?: string }
  | { type: 'circle'; circleId: string; postId?: string; commentId?: string }
  | { type: 'gathering'; gatheringId: string }
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
  circleId?: Id<'circles'>
  gatheringId?: Id<'gatherings'>
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
  if (input.circleId && !await canDeliverCircleNotification(ctx, input, input.recipientUserId)) return null
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
    const visible = await visibleNotifications(ctx, rows, viewer._id)
    return await Promise.all(visible.map((row) => presentNotification(ctx, row, viewer._id)))
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
      page: await Promise.all((await visibleNotifications(ctx, result.page, viewer._id)).map((row) => presentNotification(ctx, row, viewer._id))),
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
    return (await visibleNotifications(ctx, unread, viewer._id)).length
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

async function presentNotification(ctx: { db: any; auth: any }, notification: Doc<'notifications'>, viewerId: Id<'users'>) {
  const actor = notification.actorUserId ? await ctx.db.get(notification.actorUserId) as Doc<'users'> | null : null
  const actorHidden = actor && notification.actorUserId
    ? await isHiddenByPreference(ctx, viewerId, notification.actorUserId)
    : false
  const actorAvailable = Boolean(actor && !actor.suspended && !actorHidden)
  const actorProfileImageUrl = actorAvailable ? await profileImageUrl(ctx, actor!) : undefined
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
      ...(actorAvailable ? { userId: String(notification.actorUserId) } : {}),
      displayName: actorName,
      ...(actorProfileImageUrl ? { profileImageUrl: actorProfileImageUrl } : {}),
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

async function resolveTarget(ctx: { db: any; auth: any }, notification: Doc<'notifications'>, viewerId: Id<'users'>): Promise<{
  available: boolean
  destination: NotificationDestination
  category?: string
}> {
  const destination = notificationDefinition(notification.kind).destination
  if (destination === 'circle') {
    if (!notification.circleId || !await canDeliverCircleNotification(ctx, notification, viewerId)) return { available: false, destination: { type: 'notifications' } }
    const circle = await ctx.db.get(notification.circleId) as Doc<'circles'> | null
    if (!circle || circle.state === 'suspended') return { available: false, destination: { type: 'notifications' } }
    if (circle.state === 'archived') {
      const membership = await ctx.db.query('circleMemberships').withIndex('by_circle_user', (q: any) => q.eq('circleId', circle._id).eq('userId', viewerId)).unique() as Doc<'circleMemberships'> | null
      if (membership?.state !== 'active') return { available: false, destination: { type: 'notifications' } }
    }
    if (notification.postId) {
      const post = await ctx.db.get(notification.postId) as Doc<'posts'> | null
      if (!post || post.circleId !== circle._id || post.hidden || post.deletedAt || post.circleRemovedAt) return { available: false, destination: { type: 'notifications' } }
      const postAuthor = await ctx.db.get(post.authorId) as Doc<'users'> | null
      if (!postAuthor || postAuthor.suspended) return { available: false, destination: { type: 'notifications' } }
      if (post.authorId !== viewerId && await isHiddenByPreference(ctx, viewerId, post.authorId)) return { available: false, destination: { type: 'notifications' } }
      if (notification.commentId) {
        const comment = await ctx.db.get(notification.commentId) as Doc<'postComments'> | null
        if (!comment || comment.postId !== post._id || comment.hidden || comment.circleRemovedAt) return { available: false, destination: { type: 'notifications' } }
        const commentAuthor = await ctx.db.get(comment.authorId) as Doc<'users'> | null
        if (!commentAuthor || commentAuthor.suspended) return { available: false, destination: { type: 'notifications' } }
        if (comment.authorId !== viewerId && await isHiddenByPreference(ctx, viewerId, comment.authorId)) return { available: false, destination: { type: 'notifications' } }
      }
    }
    return { available: true, destination: { type: 'circle', circleId: String(circle._id), ...(notification.postId ? { postId: String(notification.postId) } : {}), ...(notification.commentId ? { commentId: String(notification.commentId) } : {}) } }
  }
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
    if (!post || post.hidden || post.deletedAt || !author || author.suspended) {
      return { available: false, destination: { type: 'notifications' } }
    }
    if (notification.commentId) {
      const comment = await ctx.db.get(notification.commentId) as Doc<'postComments'> | null
      const commentAuthor = comment ? await ctx.db.get(comment.authorId) as Doc<'users'> | null : null
      const commentHiddenByPreference = commentAuthor && commentAuthor._id !== viewerId
        ? await isHiddenByPreference(ctx, viewerId, commentAuthor._id)
        : false
      if (!comment || comment.postId !== post._id || comment.hidden || !commentAuthor || commentAuthor.suspended || commentHiddenByPreference) {
        return { available: false, destination: { type: 'notifications' } }
      }
    }
    if (post.authorId !== viewerId && await isHiddenByPreference(ctx, viewerId, post.authorId)) {
      return { available: false, destination: { type: 'notifications' } }
    }
    return {
      available: true,
      destination: {
        type: 'post',
        postId: String(post._id),
        ...(notification.commentId ? { commentId: String(notification.commentId) } : {}),
      },
    }
  }
  if (destination === 'conversation') {
    if (!notification.conversationId) return { available: false, destination: { type: 'notifications' } }
    const conversation = await ctx.db.get(notification.conversationId) as Doc<'directConversations'> | null
    const participant = conversation && (conversation.participantOneId === viewerId || conversation.participantTwoId === viewerId)
    if (!participant) return { available: false, destination: { type: 'notifications' } }
    if (notification.messageId) {
      const message = await ctx.db.get(notification.messageId) as Doc<'directMessages'> | null
      if (!message || message.conversationId !== conversation._id) {
        return { available: false, destination: { type: 'notifications' } }
      }
    }
    return {
      available: true,
      destination: {
        type: 'conversation',
        conversationId: String(conversation._id),
        ...(notification.messageId ? { messageId: String(notification.messageId) } : {}),
      },
    }
  }
  if (destination === 'gathering') {
    if (!notification.gatheringId) return { available: false, destination: { type: 'notifications' } }
    const gathering = await ctx.db.get(notification.gatheringId) as Doc<'gatherings'> | null
    if (!gathering) return { available: false, destination: { type: 'notifications' } }
    const isHost = gathering.hostUserId === viewerId
    const participant = isHost
      ? null
      : await ctx.db.query('gatheringParticipants').withIndex('by_gathering_user', (q: any) => q.eq('gatheringId', gathering._id).eq('userId', viewerId)).unique() as Doc<'gatheringParticipants'> | null
    if (!isHost && !participant) {
      // An Invite notification can reach a Circle member before they request a
      // seat. Keep the target available while they can still read an Invite.
      const invites = await ctx.db.query('posts').withIndex('by_gathering', (q: any) => q.eq('gatheringId', gathering._id)).collect() as Doc<'posts'>[]
      let canReadInvite = false
      for (const post of invites) {
        if (post.hidden || post.deletedAt || post.circleRemovedAt) continue
        if (!post.circleId) { canReadInvite = true; break }
        const access = await getCircleAuthorization(ctx, post.circleId)
        if (access.canReadDiscussion) { canReadInvite = true; break }
      }
      if (!canReadInvite) return { available: false, destination: { type: 'notifications' } }
    }
    return { available: true, destination: { type: 'gathering', gatheringId: String(gathering._id) }, category: gathering.category }
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
    const actor = await ctx.db.get(notification.actorUserId) as Doc<'users'> | null
    if (!actor || actor.suspended || await isHiddenByPreference(ctx, viewerId, actor._id)) {
      return { available: false, destination: { type: 'notifications' } }
    }
    return { available: true, destination: { type: 'profile', userId: String(actor._id) } }
  }
  return { available: false, destination: { type: 'notifications' } }
}

const circleActivityKinds = new Set<NotificationKind>(['circle_reply', 'circle_mention', 'circle_announcement', 'circle_reaction', 'gathering_invite'])

async function visibleNotifications(ctx: { db: any }, rows: Doc<'notifications'>[], viewerId: Id<'users'>) {
  const checks = await Promise.all(rows.map(async (row) => {
    if (!row.circleId || !circleActivityKinds.has(row.kind)) return row
    return await canDeliverCircleNotification(ctx, row, viewerId) ? row : null
  }))
  return checks.filter((row): row is Doc<'notifications'> => row !== null)
}

export async function canDeliverCircleNotification(
  ctx: { db: any },
  notification: Pick<Doc<'notifications'>, 'kind' | 'circleId' | 'actorUserId' | 'postId' | 'commentId'> | CreateNotificationInput,
  recipientUserId: Id<'users'>,
) {
  if (!notification.circleId) return true
  const circle = await ctx.db.get(notification.circleId) as Doc<'circles'> | null
  if (!circle) return false
  const recipient = await ctx.db.get(recipientUserId) as Doc<'users'> | null
  if (!recipient || recipient.suspended || !isCircleParticipantRole(recipient.role)) return false
  const membership = await ctx.db.query('circleMemberships').withIndex('by_circle_user', (q: any) => q.eq('circleId', circle._id).eq('userId', recipientUserId)).unique() as Doc<'circleMemberships'> | null
  if (notification.postId) {
    const post = await ctx.db.get(notification.postId) as Doc<'posts'> | null
    if (!post || post.circleId !== circle._id || post.hidden || post.deletedAt || post.circleRemovedAt) return false
    const author = await ctx.db.get(post.authorId) as Doc<'users'> | null
    if (!author || author.suspended) return false
    if (notification.commentId) {
      const comment = await ctx.db.get(notification.commentId) as Doc<'postComments'> | null
      if (!comment || comment.postId !== post._id || comment.hidden || comment.circleRemovedAt) return false
      const commentAuthor = await ctx.db.get(comment.authorId) as Doc<'users'> | null
      if (!commentAuthor || commentAuthor.suspended) return false
    }
  }
  if (circleActivityKinds.has(notification.kind)) {
    if (circle.state === 'suspended' || membership?.state !== 'active' || membership.mutedAt) return false
    if (notification.actorUserId && await areUsersBlocked(ctx, recipientUserId, notification.actorUserId)) return false
    return true
  }
  if (notification.kind === 'circle_join_requested') {
    if (circle.state !== 'active' || membership?.state !== 'active' || (membership.role !== 'host' && membership.role !== 'moderator')) return false
    return hasCurrentIdentityApproval(recipient)
  }
  return true
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number) {
  if (value === undefined) return fallback
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.floor(value), 1), maximum)
}

async function profileImageUrl(ctx: { db: any; storage?: { getUrl: (id: Id<'_storage'>) => Promise<string | null> } }, user: Doc<'users'>) {
  if (!user.profileImageStorageId || !ctx.storage) return user.profileImageUrl
  return await ctx.storage.getUrl(user.profileImageStorageId) ?? user.profileImageUrl
}
