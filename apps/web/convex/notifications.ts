import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { mutation, query, internalMutation, type MutationCtx } from './_generated/server'
import { requireViewer } from './lib'
import { buildInAppNotificationCopy, isSocialAggregateKind, notificationDefinition, type BookingReminderWindow, type NotificationKind as CatalogNotificationKind } from './notificationCatalog'
import { areUsersBlocked, isHiddenByPreference, preference } from './safety'
import { hasCurrentIdentityApproval } from './identityVerification'
import { isCircleParticipantRole } from './circleAuthorization'
import { isNotificationTargetMuted } from './notificationMutes'
import {
  isNotificationKindEnabled,
  localDateKey,
  localHour,
  notificationKindCategory,
  resolveNotificationPreferences,
  resolveStoredNotificationPreferences,
  shouldSuppressNotificationPush,
} from './notificationPreferences'

export type NotificationKind = CatalogNotificationKind
export type NotificationPriority = Doc<'notifications'>['priority']

// An identity notification points at the member's own approval story. `verified`
// means the member holds a current approval and can see the congratulations
// page; `status` covers every other case, including an approval that has since
// expired or been replaced, and lands on the account overview instead.
export type IdentityDestinationOutcome = 'verified' | 'status'

export type CircleNotificationSection = 'joinRequests' | 'pendingPosts' | 'members' | 'hostTransfer'

export type NotificationDestination =
  | { type: 'booking'; audience: 'member' | 'companion'; bookingId: string }
  | { type: 'conversation'; conversationId: string; messageId?: string }
  | { type: 'post'; postId: string; commentId?: string }
  | { type: 'circle'; circleId: string; postId?: string; commentId?: string; section?: CircleNotificationSection }
  | { type: 'review'; reviewId: string; companionProfileId?: string; bookingId?: string; commentId?: string }
  | { type: 'companion' }
  | { type: 'identity'; outcome: IdentityDestinationOutcome }
  | { type: 'profile'; userId: string }
  | { type: 'safety' }
  | { type: 'notifications' }

export type CreateNotificationInput = {
  recipientUserId: Id<'users'>
  actorUserId?: Id<'users'>
  kind: NotificationKind
  priority: NotificationPriority
  reminderWindow?: BookingReminderWindow
  aggregateCount?: number
  aggregateActorIds?: Id<'users'>[]
  schedulePush?: boolean
  dedupeKey: string
  bookingId?: Id<'bookings'>
  conversationId?: Id<'directConversations'>
  messageId?: Id<'directMessages'>
  postId?: Id<'posts'>
  commentId?: Id<'postComments'>
  reviewCommentId?: Id<'reviewComments'>
  circleId?: Id<'circles'>
  reviewId?: Id<'reviews'>
  companionProfileId?: Id<'companionProfiles'>
  verificationRequestId?: Id<'verificationRequests'>
  reportId?: Id<'reports'>
}

export async function createNotification(ctx: MutationCtx, input: CreateNotificationInput): Promise<Id<'notifications'> | null>
export async function createNotification(ctx: { db: any; scheduler?: never }, input: CreateNotificationInput): Promise<Id<'notifications'> | null>
export async function createNotification(ctx: MutationCtx | { db: any; scheduler?: never }, input: CreateNotificationInput) {
  if (input.actorUserId === input.recipientUserId) return null
  if (!input.dedupeKey.trim()) throw new ConvexError('Notification dedupe key is required')
  const definition = notificationDefinition(input.kind)
  if (!definition.allowedPriorities.includes(input.priority)) {
    throw new ConvexError(`Priority ${input.priority} is not allowed for ${input.kind}`)
  }
  const recipient = await ctx.db.get(input.recipientUserId)
  if (!recipient) return null
  if (input.circleId && !await canDeliverCircleNotification(ctx, input, input.recipientUserId)) return null
  if (input.actorUserId && definition.respectsSocialPreferences) {
    if (await areUsersBlocked(ctx, input.recipientUserId, input.actorUserId)) return null
    if ((await preference(ctx, input.recipientUserId, input.actorUserId))?.mutedAt) return null
  }
  const now = Date.now()
  const preferences = await resolveNotificationPreferences(ctx, input.recipientUserId)
  if (definition.respectsSocialPreferences) {
    if (!isNotificationKindEnabled(preferences, input.kind)) return null
    if (await isNotificationTargetMuted(ctx, input.recipientUserId, { postId: input.postId, circleId: input.circleId })) return null
  }
  const existing = await ctx.db.query('notifications')
    .withIndex('by_recipient_dedupe', (q: any) => q.eq('recipientUserId', input.recipientUserId).eq('dedupeKey', input.dedupeKey))
    .unique()
  if (existing) return existing._id
  const { schedulePush: requestedPush = true, ...notification } = input
  const schedulePush = requestedPush && !shouldSuppressNotificationPush(preferences, input.kind, now)
  const notificationId = await ctx.db.insert('notifications', { ...notification, createdAt: now })
  if (schedulePush && 'scheduler' in ctx && ctx.scheduler) {
    await ctx.scheduler.runAfter(0, internal.pushNotifications.deliverNotification, { notificationId })
  }
  return notificationId
}

const SOCIAL_PUSH_COOLDOWN_MS = 15 * 60 * 1_000

/**
 * Social reactions and follows are aggregated per target and window. Updating
 * the existing row keeps the notification center quiet while preserving the
 * latest actor and a count. A recipient gets at most one social push per
 * fifteen minutes across targets; later activity is in-app only.
 */
export async function createOrUpdateNotification(
  ctx: MutationCtx,
  input: CreateNotificationInput,
): Promise<Id<'notifications'> | null> {
  if (input.actorUserId === input.recipientUserId) return null
  const now = Date.now()
  const existing = await ctx.db.query('notifications')
    .withIndex('by_recipient_dedupe', (q: any) => q.eq('recipientUserId', input.recipientUserId).eq('dedupeKey', input.dedupeKey))
    .unique()
  if (existing) {
    if (notificationDefinition(input.kind).respectsSocialPreferences) {
      const preferences = await resolveNotificationPreferences(ctx, input.recipientUserId)
      if (!isNotificationKindEnabled(preferences, input.kind)) return null
      if (await isNotificationTargetMuted(ctx, input.recipientUserId, { postId: input.postId, circleId: input.circleId })) return null
    }
    const actorIds = existing.aggregateActorIds ?? []
    const actorIsNew = !input.actorUserId || !actorIds.includes(input.actorUserId)
    if (!actorIsNew) return existing._id
    await ctx.db.patch(existing._id, {
      actorUserId: input.actorUserId,
      aggregateCount: (existing.aggregateCount ?? 1) + 1,
      aggregateActorIds: input.actorUserId ? [...actorIds, input.actorUserId].slice(-20) : actorIds,
      updatedAt: now,
      createdAt: now,
      readAt: undefined,
    })
    return existing._id
  }
  const recent = await ctx.db.query('notifications')
    .withIndex('by_recipient_created_at', (q: any) => q.eq('recipientUserId', input.recipientUserId).gte('createdAt', now - SOCIAL_PUSH_COOLDOWN_MS))
    .collect()
  const schedulePush = !recent.some((row: Doc<'notifications'>) => isSocialAggregateKind(row.kind))
  return await createNotification(ctx, {
    ...input,
    aggregateCount: 1,
    aggregateActorIds: input.actorUserId ? [input.actorUserId] : [],
    schedulePush,
  })
}

/**
 * Direct messages collapse into one row per conversation. A back and forth
 * bumps the count, points at the latest message, moves the row to the top, and
 * reopens it instead of adding another row. Reading the conversation clears it,
 * and the next message starts the same row again at a count of one.
 */
export function directMessageNotificationKey(conversationId: Id<'directConversations'>) {
  return `direct-message:${conversationId}`
}

export async function createOrUpdateMessageNotification(
  ctx: MutationCtx,
  input: {
    recipientUserId: Id<'users'>
    actorUserId: Id<'users'>
    conversationId: Id<'directConversations'>
    messageId: Id<'directMessages'>
    dedupeKey: string
  },
): Promise<Id<'notifications'> | null> {
  if (input.actorUserId === input.recipientUserId) return null
  if (await areUsersBlocked(ctx, input.recipientUserId, input.actorUserId)) return null
  if ((await preference(ctx, input.recipientUserId, input.actorUserId))?.mutedAt) return null
  const now = Date.now()
  const existing = await ctx.db.query('notifications')
    .withIndex('by_recipient_dedupe', (q) => q.eq('recipientUserId', input.recipientUserId).eq('dedupeKey', input.dedupeKey))
    .unique()
  if (!existing) {
    return await createNotification(ctx, {
      recipientUserId: input.recipientUserId,
      actorUserId: input.actorUserId,
      kind: 'direct_message',
      priority: 'standard',
      conversationId: input.conversationId,
      messageId: input.messageId,
      dedupeKey: input.dedupeKey,
      aggregateCount: 1,
    })
  }
  await ctx.db.patch(existing._id, {
    actorUserId: input.actorUserId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    aggregateCount: existing.readAt ? 1 : (existing.aggregateCount ?? 1) + 1,
    priority: 'standard',
    readAt: undefined,
    createdAt: now,
    updatedAt: now,
  })
  if ('scheduler' in ctx && ctx.scheduler) {
    await ctx.scheduler.runAfter(0, internal.pushNotifications.deliverNotification, { notificationId: existing._id })
  }
  return existing._id
}

/** Opening or replying in a conversation clears its notification row. */
export async function markConversationNotificationRead(
  ctx: MutationCtx,
  userId: Id<'users'>,
  conversationId: Id<'directConversations'>,
) {
  const row = await ctx.db.query('notifications')
    .withIndex('by_recipient_dedupe', (q) => q.eq('recipientUserId', userId).eq('dedupeKey', directMessageNotificationKey(conversationId)))
    .unique()
  if (row && !row.readAt) await ctx.db.patch(row._id, { readAt: Date.now() })
}

/**
 * One daily social digest per member and local day. The sweep walks stored
 * preference rows through the digest index, then counts only that member's
 * unread social and Circle notifications from the last day. The digest itself
 * has no category, so it never counts toward a later digest, and the dedupe key
 * makes a second run in the same local day a no-op.
 */
export const sendDueSocialDigests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const cutoff = now - 24 * 60 * 60 * 1_000
    const stored = await ctx.db.query('notificationPreferences')
      .withIndex('by_digest_enabled', (q) => q.eq('digestEnabled', true))
      .collect()
    let created = 0
    for (const row of stored) {
      const preferences = resolveStoredNotificationPreferences(row)
      if (!preferences.digestEnabled) continue
      if (localHour(now, preferences.timeZone) !== Math.floor(preferences.digestHourMinute / 60)) continue
      const dedupeKey = `social-digest:${row.userId}:${localDateKey(now, preferences.timeZone)}`
      const existing = await ctx.db.query('notifications')
        .withIndex('by_recipient_dedupe', (q) => q.eq('recipientUserId', row.userId).eq('dedupeKey', dedupeKey))
        .unique()
      if (existing) continue
      const recipient = await ctx.db.get(row.userId)
      if (!recipient || recipient.suspended) continue
      const unread = await ctx.db.query('notifications')
        .withIndex('by_recipient_read_at', (q) => q.eq('recipientUserId', row.userId).eq('readAt', undefined))
        .collect()
      const count = unread.filter((notification) => (
        notification.createdAt >= cutoff && notificationKindCategory(notification.kind) !== null
      )).length
      if (count === 0) continue
      const notificationId = await createNotification(ctx, {
        recipientUserId: row.userId,
        kind: 'social_digest',
        priority: 'standard',
        aggregateCount: count,
        dedupeKey,
      })
      if (notificationId) created += 1
    }
    return { created }
  },
})

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

function circleSectionForKind(kind: NotificationKind): CircleNotificationSection | undefined {
  switch (kind) {
    case 'circle_join_requested': return 'joinRequests'
    case 'circle_post_review_requested': return 'pendingPosts'
    case 'circle_role_changed': return 'members'
    case 'circle_host_transfer': return 'hostTransfer'
    default: return undefined
  }
}

async function requireOwnedNotification(ctx: { db: any }, notificationId: Id<'notifications'>, viewerId: Id<'users'>) {  const notification = await ctx.db.get(notificationId) as Doc<'notifications'> | null
  if (!notification) throw new ConvexError('Notification not found')
  if (notification.recipientUserId !== viewerId) throw new ConvexError('Not your notification')
  return notification
}

async function presentNotification(ctx: { db: any }, notification: Doc<'notifications'>, viewerId: Id<'users'>) {
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
    reminderWindow: notification.reminderWindow,
    aggregateCount: notification.aggregateCount,
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

async function resolveTarget(ctx: { db: any }, notification: Doc<'notifications'>, viewerId: Id<'users'>): Promise<{
  available: boolean
  destination: NotificationDestination
  category?: string
}> {
  const destination = notificationDefinition(notification.kind).destination
  if (destination === 'notifications') return { available: true, destination: { type: 'notifications' } }
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
    return { available: true, destination: { type: 'circle', circleId: String(circle._id), ...(notification.postId ? { postId: String(notification.postId) } : {}), ...(notification.commentId ? { commentId: String(notification.commentId) } : {}), ...(circleSectionForKind(notification.kind) ? { section: circleSectionForKind(notification.kind) } : {}) } }
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
      if (!message || message.conversationId !== conversation._id || message.unsentAt) {
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
  if (destination === 'companion') {
    if (!notification.companionProfileId) return { available: false, destination: { type: 'notifications' } }
    const companion = await ctx.db.get(notification.companionProfileId)
    return { available: Boolean(companion), destination: { type: 'companion' } }
  }
  if (destination === 'identity') {
    // The approval notification is the entry point to the verification
    // congratulations page. It only leads there while the approval is still
    // current, so a stale notification never promises access the member no
    // longer has.
    if (notification.kind === 'identity_verification_approved') {
      const viewer = await ctx.db.get(viewerId) as Doc<'users'> | null
      if (viewer && hasCurrentIdentityApproval(viewer)) {
        return { available: true, destination: { type: 'identity', outcome: 'verified' } }
      }
    }
    return { available: true, destination: { type: 'identity', outcome: 'status' } }
  }
  if (destination === 'safety') {
    return notification.reportId
      ? { available: true, destination: { type: 'safety' } }
      : { available: false, destination: { type: 'notifications' } }
  }
  if (destination === 'review') {
    if (!notification.reviewId) return { available: false, destination: { type: 'notifications' } }
    const review = await ctx.db.get(notification.reviewId) as Doc<'reviews'> | null
    if (!review || review.hidden) return { available: false, destination: { type: 'notifications' } }
    const reviewer = await ctx.db.get(review.reviewerId) as Doc<'users'> | null
    if (!reviewer || reviewer.suspended) return { available: false, destination: { type: 'notifications' } }
    if (notification.reviewCommentId) {
      const comment = await ctx.db.get(notification.reviewCommentId) as Doc<'reviewComments'> | null
      if (!comment || comment.reviewId !== review._id || comment.hidden) {
        return { available: false, destination: { type: 'notifications' } }
      }
    }
    return {
      available: true,
      destination: {
        type: 'review',
        reviewId: String(review._id),
        bookingId: String(review.bookingId),
        ...(review.companionProfileId ? { companionProfileId: String(review.companionProfileId) } : {}),
        ...(notification.reviewCommentId ? { commentId: String(notification.reviewCommentId) } : {}),
      },
    }
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

const circleActivityKinds = new Set<NotificationKind>(['circle_reply', 'circle_mention', 'circle_announcement', 'circle_reaction'])

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
