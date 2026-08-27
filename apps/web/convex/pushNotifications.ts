import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { internalAction, internalMutation, mutation, query } from './_generated/server'
import { requireViewer } from './lib'
import { buildNativePushPresentation, fallbackNativePushBody, type NativePushBody, type NativePushPresentation } from './notificationCatalog'

export type { NativePushBody, NativePushPresentation } from './notificationCatalog'

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send'
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts'
const MAX_SEND_BATCH = 100
const MAX_RECEIPT_BATCH = 1_000
const MAX_SEND_ATTEMPTS = 5
const MAX_RECEIPT_ATTEMPTS = 5
const SEND_LEASE_MS = 2 * 60 * 1_000
const RECEIPT_LEASE_MS = 2 * 60 * 1_000
const HTTP_TIMEOUT_MS = 30_000
const RECEIPT_DELAY_MS = 15 * 60 * 1_000
const DAY_MS = 24 * 60 * 60 * 1_000
const MAX_DELIVERY_AGE_MS = 7 * DAY_MS
const OPERATIONAL_RETENTION_MS = 30 * DAY_MS
const INSTALLATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EXPO_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/

const platformValidator = v.union(v.literal('ios'), v.literal('android'))
export type PushMessage = {
  to: string
  title: string
  body: string
  data: { version: 1; notificationId: string }
  badge: number
  sound: 'default'
  priority: 'high'
  channelId?: 'account-updates-v2'
}

type PushConfiguration =
  | { enabled: false; reason: 'disabled' | 'misconfigured' }
  | { enabled: true; projectId: string; accessToken?: string }

type PreparedDelivery = {
  deliveryId: Id<'pushDeliveries'>
  notificationId: Id<'notifications'>
  deviceId: Id<'pushDevices'>
  expoPushToken: string
  platform: 'ios' | 'android'
  sendGeneration: number
  tokenRevision: number
  message: PushMessage
}

type ExpoTicket = { status?: unknown; id?: unknown; message?: unknown; details?: { error?: unknown } }
type ExpoReceipt = { status?: unknown; message?: unknown; details?: { error?: unknown } }

export const state = query({
  args: { installationId: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (!INSTALLATION_ID.test(args.installationId)) throw new Error('Invalid installation ID')
    const config = pushConfiguration()
    const devices = await ctx.db.query('pushDevices')
      .withIndex('by_installation', (q) => q.eq('installationId', args.installationId))
      .collect()
    return {
      available: config.enabled,
      registered: devices.some((device) => device.userId === viewer._id && device.enabled),
    }
  },
})

export const registerDevice = mutation({
  args: {
    installationId: v.string(),
    expoPushToken: v.string(),
    platform: platformValidator,
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const config = pushConfiguration()
    if (!config.enabled) throw new Error('Push notifications are unavailable')
    validateRegistration(args, config.projectId)

    const now = Date.now()
    const [installationRows, tokenRows] = await Promise.all([
      ctx.db.query('pushDevices').withIndex('by_installation', (q) => q.eq('installationId', args.installationId)).collect(),
      ctx.db.query('pushDevices').withIndex('by_token', (q) => q.eq('expoPushToken', args.expoPushToken)).collect(),
    ])
    const target = installationRows.find((row) => row.userId === viewer._id) ?? installationRows[0]
    const conflicts = new Map([...installationRows, ...tokenRows].map((row) => [String(row._id), row]))

    for (const row of conflicts.values()) {
      if (target && row._id === target._id) continue
      await ctx.db.patch(row._id, {
        enabled: false,
        disabledAt: now,
        tokenRevision: row.tokenRevision + 1,
        updatedAt: now,
      })
    }

    if (target) {
      const registrationChanged = !target.enabled
        || target.userId !== viewer._id
        || target.expoPushToken !== args.expoPushToken
        || target.platform !== args.platform
        || target.projectId !== args.projectId
      await ctx.db.patch(target._id, {
        userId: viewer._id,
        expoPushToken: args.expoPushToken,
        platform: args.platform,
        projectId: args.projectId,
        enabled: true,
        disabledAt: undefined,
        tokenRevision: target.tokenRevision + (registrationChanged ? 1 : 0),
        updatedAt: now,
      })
      return { registered: true, deviceId: target._id }
    }

    const deviceId = await ctx.db.insert('pushDevices', {
      installationId: args.installationId,
      userId: viewer._id,
      expoPushToken: args.expoPushToken,
      platform: args.platform,
      projectId: args.projectId,
      enabled: true,
      tokenRevision: 1,
      createdAt: now,
      updatedAt: now,
    })
    return { registered: true, deviceId }
  },
})

export const disableDevice = mutation({
  args: { installationId: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (!INSTALLATION_ID.test(args.installationId)) throw new Error('Invalid installation ID')
    const devices = await ctx.db.query('pushDevices').withIndex('by_installation', (q) => q.eq('installationId', args.installationId)).collect()
    const device = devices.find((row) => row.userId === viewer._id)
    if (!device) return { disabled: false }
    if (device.enabled) {
      const now = Date.now()
      await ctx.db.patch(device._id, {
        enabled: false,
        disabledAt: now,
        tokenRevision: device.tokenRevision + 1,
        updatedAt: now,
      })
    }
    return { disabled: true }
  },
})

export const deliverNotification = internalAction({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, args) => {
    const config = pushConfiguration()
    if (!config.enabled) return { sent: 0 }
    await ctx.runMutation(internal.pushNotifications.prepareDeliveries, {
      notificationId: args.notificationId,
      projectId: config.projectId,
    })
    return await sendDueDeliveries(ctx, config, args.notificationId)
  },
})

export const reconcile = internalAction({
  args: {},
  handler: async (ctx): Promise<{ sent: number; receipts: number }> => {
    const config = pushConfiguration()
    if (!config.enabled) return { sent: 0, receipts: 0 }
    const sent = await sendDueDeliveries(ctx, config)
    const receipts: number = await checkReceipts(ctx, config)
    return { sent: sent.sent, receipts }
  },
})

export const prepareDeliveries = internalMutation({
  args: { notificationId: v.id('notifications'), projectId: v.string() },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId)
    if (!notification) return { created: 0 }
    const recipient = await ctx.db.get(notification.recipientUserId)
    if (!recipient || recipient.suspended) return { created: 0 }
    const devices = await ctx.db.query('pushDevices')
      .withIndex('by_user_enabled', (q) => q.eq('userId', notification.recipientUserId).eq('enabled', true))
      .collect()
    let created = 0
    const now = Date.now()
    for (const device of devices) {
      if (device.projectId !== args.projectId) continue
      const idempotencyKey = `${notification._id}:${device._id}`
      const existing = await ctx.db.query('pushDeliveries').withIndex('by_idempotency_key', (q) => q.eq('idempotencyKey', idempotencyKey)).unique()
      if (existing) continue
      await ctx.db.insert('pushDeliveries', {
        notificationId: notification._id,
        userId: notification.recipientUserId,
        deviceId: device._id,
        idempotencyKey,
        state: 'pending',
        sendAttempts: 0,
        receiptAttempts: 0,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      })
      created += 1
    }
    return { created }
  },
})

export const claimDeliveries = internalMutation({
  args: { now: v.number(), projectId: v.string(), notificationId: v.optional(v.id('notifications')) },
  handler: async (ctx, args) => {
    await terminalizeExpiredForStates(ctx, ['pending', 'retry', 'sending'], args.now, MAX_SEND_BATCH)
    const candidates = [
      ...await dueDeliveries(ctx, 'pending', args.now),
      ...await dueDeliveries(ctx, 'retry', args.now),
      ...await dueDeliveries(ctx, 'sending', args.now),
    ]
      .filter((delivery) => !args.notificationId || delivery.notificationId === args.notificationId)
      .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)
      .slice(0, MAX_SEND_BATCH)
    const claimed: Array<{ deliveryId: Id<'pushDeliveries'>; notificationId: Id<'notifications'>; deviceId: Id<'pushDevices'>; expoPushToken: string; platform: 'ios' | 'android'; sendGeneration: number; tokenRevision: number; kind: Doc<'notifications'>['kind']; unreadCount: number; presentation: NativePushPresentation }> = []

    for (const delivery of candidates) {
      if (delivery.createdAt <= args.now - MAX_DELIVERY_AGE_MS) {
        await permanentlyFail(ctx, delivery, 'delivery_expired', args.now)
        continue
      }
      if (delivery.state === 'sending' && delivery.leaseExpiresAt !== undefined && delivery.leaseExpiresAt > args.now) continue
      const [notification, device, recipient] = await Promise.all([
        ctx.db.get('notifications', delivery.notificationId),
        ctx.db.get('pushDevices', delivery.deviceId),
        ctx.db.get('users', delivery.userId),
      ])
      if (!notification || notification.recipientUserId !== delivery.userId || !recipient || recipient.suspended) {
        await permanentlyFail(ctx, delivery, 'notification_unavailable', args.now)
        continue
      }
      if (!device || !device.enabled || device.userId !== delivery.userId || device.projectId !== args.projectId) {
        await permanentlyFail(ctx, delivery, 'device_unavailable', args.now)
        continue
      }
      const unread = await ctx.db.query('notifications')
        .withIndex('by_recipient_read_at', (q) => q.eq('recipientUserId', delivery.userId).eq('readAt', undefined))
        .collect()
      const presentation = await notificationPushPresentation(ctx, notification)
      const leaseExpiresAt = args.now + SEND_LEASE_MS
      const sendGeneration = (delivery.sendGeneration ?? 0) + 1
      await ctx.db.patch(delivery._id, {
        state: 'sending',
        sendAttempts: delivery.sendAttempts + 1,
        sendGeneration,
        nextAttemptAt: leaseExpiresAt,
        leaseExpiresAt,
        receiptLeaseExpiresAt: undefined,
        sentTokenRevision: device.tokenRevision,
        errorCode: undefined,
        updatedAt: args.now,
      })
      claimed.push({
        deliveryId: delivery._id,
        notificationId: notification._id,
        deviceId: device._id,
        expoPushToken: device.expoPushToken,
        platform: device.platform,
        sendGeneration,
        tokenRevision: device.tokenRevision,
        kind: notification.kind,
        unreadCount: unread.length,
        presentation,
      })
    }
    return claimed
  },
})

export const applyTickets = internalMutation({
  args: {
    results: v.array(v.object({
      deliveryId: v.id('pushDeliveries'),
      sendGeneration: v.number(),
      sentTokenRevision: v.number(),
      status: v.union(v.literal('ticket'), v.literal('retry'), v.literal('permanent')),
      ticketId: v.optional(v.string()),
      errorCode: v.optional(v.string()),
    })),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    for (const result of args.results.slice(0, MAX_SEND_BATCH)) {
      const delivery = await ctx.db.get(result.deliveryId)
      if (
        !delivery
        || delivery.state !== 'sending'
        || delivery.sendGeneration !== result.sendGeneration
        || delivery.sentTokenRevision !== result.sentTokenRevision
      ) continue
      if (result.status === 'ticket' && result.ticketId) {
        await ctx.db.patch(delivery._id, {
          state: 'ticketed',
          expoTicketId: result.ticketId,
          ticketedAt: args.now,
          nextAttemptAt: args.now + RECEIPT_DELAY_MS,
          leaseExpiresAt: undefined,
          errorCode: undefined,
          updatedAt: args.now,
        })
        continue
      }
      if (result.errorCode === 'device_not_registered') {
        await disableStaleSafe(ctx, delivery.deviceId, result.sentTokenRevision, args.now)
      }
      if (result.status === 'retry' && delivery.sendAttempts < MAX_SEND_ATTEMPTS) {
        await ctx.db.patch(delivery._id, {
          state: 'retry',
          nextAttemptAt: args.now + retryDelay(delivery.sendAttempts),
          leaseExpiresAt: undefined,
          errorCode: result.errorCode ?? 'temporary_provider_error',
          updatedAt: args.now,
        })
      } else {
        await permanentlyFail(ctx, delivery, result.errorCode ?? 'provider_rejected', args.now)
      }
    }
  },
})

export const claimReceipts = internalMutation({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    await terminalizeExpiredForStates(ctx, ['ticketed'], args.now, MAX_RECEIPT_BATCH)
    const rows = await ctx.db.query('pushDeliveries')
      .withIndex('by_state_next_attempt', (q) => q.eq('state', 'ticketed').lte('nextAttemptAt', args.now))
      .take(MAX_RECEIPT_BATCH)
    const claimed: Array<{ deliveryId: Id<'pushDeliveries'>; ticketId: string; receiptGeneration: number; sentTokenRevision: number }> = []
    for (const delivery of rows) {
      if (delivery.createdAt <= args.now - MAX_DELIVERY_AGE_MS) {
        await permanentlyFail(ctx, delivery, 'delivery_expired', args.now)
        continue
      }
      if (delivery.receiptLeaseExpiresAt !== undefined && delivery.receiptLeaseExpiresAt > args.now) continue
      if (!delivery.expoTicketId || delivery.sentTokenRevision === undefined) {
        await permanentlyFail(ctx, delivery, 'ticket_unavailable', args.now)
        continue
      }
      const receiptGeneration = (delivery.receiptGeneration ?? 0) + 1
      const receiptLeaseExpiresAt = args.now + RECEIPT_LEASE_MS
      await ctx.db.patch(delivery._id, {
        receiptGeneration,
        receiptLeaseExpiresAt,
        nextAttemptAt: receiptLeaseExpiresAt,
        updatedAt: args.now,
      })
      claimed.push({
        deliveryId: delivery._id,
        ticketId: delivery.expoTicketId,
        receiptGeneration,
        sentTokenRevision: delivery.sentTokenRevision,
      })
    }
    return claimed
  },
})

export const applyReceipts = internalMutation({
  args: {
    results: v.array(v.object({
      deliveryId: v.id('pushDeliveries'),
      receiptGeneration: v.number(),
      ticketId: v.string(),
      sentTokenRevision: v.number(),
      status: v.union(v.literal('delivered'), v.literal('retry_receipt'), v.literal('retry_send'), v.literal('permanent')),
      errorCode: v.optional(v.string()),
    })),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    for (const result of args.results.slice(0, MAX_RECEIPT_BATCH)) {
      const delivery = await ctx.db.get(result.deliveryId)
      if (
        !delivery
        || delivery.state !== 'ticketed'
        || delivery.receiptGeneration !== result.receiptGeneration
        || delivery.expoTicketId !== result.ticketId
        || delivery.sentTokenRevision !== result.sentTokenRevision
      ) continue
      const receiptAttempts = delivery.receiptAttempts + 1
      if (result.status === 'delivered') {
        await ctx.db.patch(delivery._id, { state: 'delivered', receiptAttempts, receiptLeaseExpiresAt: undefined, completedAt: args.now, errorCode: undefined, updatedAt: args.now })
        continue
      }
      if (result.errorCode === 'device_not_registered') {
        await disableStaleSafe(ctx, delivery.deviceId, result.sentTokenRevision, args.now)
      }
      if (result.status === 'retry_receipt' && receiptAttempts < MAX_RECEIPT_ATTEMPTS) {
        await ctx.db.patch(delivery._id, {
          receiptAttempts,
          receiptLeaseExpiresAt: undefined,
          nextAttemptAt: args.now + retryDelay(receiptAttempts),
          errorCode: result.errorCode ?? 'receipt_pending',
          updatedAt: args.now,
        })
      } else if (result.status === 'retry_send' && delivery.sendAttempts < MAX_SEND_ATTEMPTS) {
        await ctx.db.patch(delivery._id, {
          state: 'retry',
          receiptAttempts,
          receiptLeaseExpiresAt: undefined,
          expoTicketId: undefined,
          ticketedAt: undefined,
          nextAttemptAt: args.now + retryDelay(delivery.sendAttempts),
          errorCode: result.errorCode ?? 'temporary_provider_error',
          updatedAt: args.now,
        })
      } else {
        await permanentlyFail(
          ctx,
          delivery,
          result.status === 'retry_receipt' ? 'receipt_attempts_exhausted' : result.errorCode ?? 'provider_rejected',
          args.now,
          receiptAttempts,
        )
      }
    }
  },
})

export const purgeOperationalData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const ageCutoff = now - MAX_DELIVERY_AGE_MS
    const retentionCutoff = now - OPERATIONAL_RETENTION_MS
    const expired = await ctx.db.query('pushDeliveries').withIndex('by_created_at', (q) => q.lt('createdAt', ageCutoff)).take(1_000)
    let terminalizedDeliveries = 0
    let deletedDeliveries = 0
    for (const delivery of expired) {
      if (delivery.state !== 'delivered' && delivery.state !== 'permanent_failure') {
        await permanentlyFail(ctx, delivery, 'delivery_expired', now)
        terminalizedDeliveries += 1
      }
      if (delivery.createdAt < retentionCutoff) {
        await ctx.db.delete(delivery._id)
        deletedDeliveries += 1
      }
    }
    const devices = await ctx.db.query('pushDevices').withIndex('by_updated_at', (q) => q.lt('updatedAt', retentionCutoff)).take(1_000)
    let deletedDevices = 0
    for (const device of devices) {
      if (device.enabled) continue
      const linked = await ctx.db.query('pushDeliveries').withIndex('by_device', (q) => q.eq('deviceId', device._id)).first()
      if (!linked) {
        await ctx.db.delete(device._id)
        deletedDevices += 1
      }
    }
    return { terminalizedDeliveries, deletedDeliveries, deletedDevices }
  },
})

async function sendDueDeliveries(
  ctx: { runMutation: any },
  config: Extract<PushConfiguration, { enabled: true }>,
  notificationId?: Id<'notifications'>,
) {
  const now = Date.now()
  const rows = await ctx.runMutation(internal.pushNotifications.claimDeliveries, { now, projectId: config.projectId, notificationId })
  if (rows.length === 0) return { sent: 0 }
  const prepared: PreparedDelivery[] = rows.map((row: any) => ({
    deliveryId: row.deliveryId,
    notificationId: row.notificationId,
    deviceId: row.deviceId,
    expoPushToken: row.expoPushToken,
    platform: row.platform,
    sendGeneration: row.sendGeneration,
    tokenRevision: row.tokenRevision,
    message: pushMessage({
      token: row.expoPushToken,
      platform: row.platform,
      notificationId: row.notificationId,
      kind: row.kind,
      unreadCount: row.unreadCount,
      presentation: row.presentation,
    }),
  }))
  let results: Array<{ deliveryId: Id<'pushDeliveries'>; sendGeneration: number; sentTokenRevision: number; status: 'ticket' | 'retry' | 'permanent'; ticketId?: string; errorCode?: string }>
  try {
    const response = await fetch(EXPO_SEND_URL, {
      method: 'POST',
      headers: expoHeaders(config),
      body: JSON.stringify(prepared.map((item) => item.message)),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    })
    if (!response.ok) {
      const classification = classifyHttpFailure(response.status)
      results = prepared.map((item) => ({ deliveryId: item.deliveryId, sendGeneration: item.sendGeneration, sentTokenRevision: item.tokenRevision, ...classification }))
    } else {
      const payload = await safeJson(response)
      const tickets = Array.isArray(payload?.data) ? payload.data : []
      results = prepared.map((item, index) => ({ deliveryId: item.deliveryId, sendGeneration: item.sendGeneration, sentTokenRevision: item.tokenRevision, ...classifyTicket(tickets[index]) }))
    }
  } catch {
    results = prepared.map((item) => ({ deliveryId: item.deliveryId, sendGeneration: item.sendGeneration, sentTokenRevision: item.tokenRevision, status: 'retry' as const, errorCode: 'network_error' }))
  }
  await ctx.runMutation(internal.pushNotifications.applyTickets, { results, now: Date.now() })
  return { sent: prepared.length }
}

async function checkReceipts(ctx: { runMutation: any }, config: Extract<PushConfiguration, { enabled: true }>): Promise<number> {
  const candidates: Array<{ deliveryId: Id<'pushDeliveries'>; ticketId: string; receiptGeneration: number; sentTokenRevision: number }> = await ctx.runMutation(internal.pushNotifications.claimReceipts, { now: Date.now() })
  if (candidates.length === 0) return 0
  let results: Array<{ deliveryId: Id<'pushDeliveries'>; ticketId: string; receiptGeneration: number; sentTokenRevision: number; status: 'delivered' | 'retry_receipt' | 'retry_send' | 'permanent'; errorCode?: string }>
  try {
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: expoHeaders(config),
      body: JSON.stringify({ ids: candidates.map((candidate) => candidate.ticketId) }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    })
    if (!response.ok) {
      const temporary = response.status === 429 || response.status >= 500
      results = candidates.map((candidate) => ({
        ...candidate,
        status: temporary ? 'retry_receipt' as const : 'permanent' as const,
        errorCode: sanitizeHttpCode(response.status),
      }))
    } else {
      const payload = await safeJson(response)
      const receipts = payload?.data && typeof payload.data === 'object' ? payload.data : {}
      results = candidates.map((candidate) => ({
        ...candidate,
        ...classifyReceipt(receipts[candidate.ticketId]),
      }))
    }
  } catch {
    results = candidates.map((candidate) => ({ ...candidate, status: 'retry_receipt' as const, errorCode: 'network_error' }))
  }
  await ctx.runMutation(internal.pushNotifications.applyReceipts, { results, now: Date.now() })
  return candidates.length
}

export function pushMessage(input: {
  token: string
  platform: 'ios' | 'android'
  notificationId: Id<'notifications'> | string
  kind: Doc<'notifications'>['kind']
  unreadCount: number
  presentation?: NativePushPresentation
}): PushMessage {
  const presentation = input.presentation ?? nativePushPresentation({ kind: input.kind })
  return {
    to: input.token,
    title: presentation.title,
    body: presentation.body,
    data: { version: 1, notificationId: String(input.notificationId) },
    badge: Math.max(0, Math.floor(input.unreadCount)),
    sound: 'default',
    priority: 'high',
    ...(input.platform === 'android' ? { channelId: 'account-updates-v2' as const } : {}),
  }
}

export function nativePushPresentation(input: {
  kind: Doc<'notifications'>['kind']
  actorName?: string
  messageBody?: string
  messageAttachmentCount?: number
  commentBody?: string
  isComment?: boolean
}): NativePushPresentation {
  return buildNativePushPresentation(input.kind, input)
}

export function nativePushBody(kind: Doc<'notifications'>['kind']): NativePushBody {
  return fallbackNativePushBody(kind)
}

async function notificationPushPresentation(ctx: { db: any }, notification: Doc<'notifications'>): Promise<NativePushPresentation> {
  const [actor, message, comment] = await Promise.all([
    notification.actorUserId ? ctx.db.get(notification.actorUserId) as Promise<Doc<'users'> | null> : null,
    notification.messageId ? ctx.db.get(notification.messageId) as Promise<Doc<'directMessages'> | null> : null,
    notification.commentId ? ctx.db.get(notification.commentId) as Promise<Doc<'postComments'> | null> : null,
  ])
  const actorAvailable = Boolean(actor && !actor.suspended)
  const messageMatches = Boolean(
    actorAvailable
    && message
    && message.senderId === notification.actorUserId
    && message.conversationId === notification.conversationId,
  )
  const commentMatches = Boolean(
    actorAvailable
    && comment
    && !comment.hidden
    && comment.authorId === notification.actorUserId
    && comment.postId === notification.postId,
  )
  return nativePushPresentation({
    kind: notification.kind,
    actorName: actorAvailable ? actor!.displayName : undefined,
    messageBody: messageMatches ? message!.body : undefined,
    messageAttachmentCount: messageMatches ? message!.attachments?.length ?? 0 : 0,
    commentBody: commentMatches ? comment!.body : undefined,
    isComment: Boolean(notification.commentId),
  })
}

export function classifyTicket(ticket: ExpoTicket | undefined): { status: 'ticket' | 'retry' | 'permanent'; ticketId?: string; errorCode?: string } {
  if (ticket?.status === 'ok' && typeof ticket.id === 'string' && ticket.id) return { status: 'ticket', ticketId: ticket.id }
  const code = providerErrorCode(ticket?.details?.error)
  if (code === 'device_not_registered') return { status: 'permanent', errorCode: code }
  if (code === 'message_rate_exceeded') return { status: 'retry', errorCode: code }
  return { status: 'permanent', errorCode: code ?? 'provider_rejected' }
}

export function classifyReceipt(receipt: ExpoReceipt | undefined): { status: 'delivered' | 'retry_receipt' | 'retry_send' | 'permanent'; errorCode?: string } {
  if (!receipt) return { status: 'retry_receipt', errorCode: 'receipt_pending' }
  if (receipt.status === 'ok') return { status: 'delivered' }
  const code = providerErrorCode(receipt.details?.error)
  if (code === 'message_rate_exceeded') return { status: 'retry_send', errorCode: code }
  if (code === 'device_not_registered') return { status: 'permanent', errorCode: code }
  return { status: 'permanent', errorCode: code ?? 'provider_rejected' }
}

function pushConfiguration(): PushConfiguration {
  if (process.env.EXPO_PUSH_ENABLED !== 'true') return { enabled: false, reason: 'disabled' }
  const projectId = process.env.EXPO_PROJECT_ID?.trim()
  if (!projectId) return { enabled: false, reason: 'misconfigured' }
  const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN?.trim()
  return { enabled: true, projectId, accessToken: accessToken || undefined }
}

function validateRegistration(input: { installationId: string; expoPushToken: string; projectId: string }, expectedProjectId: string) {
  if (!INSTALLATION_ID.test(input.installationId)) throw new Error('Invalid installation ID')
  if (!EXPO_TOKEN.test(input.expoPushToken)) throw new Error('Invalid Expo push token')
  if (input.projectId !== expectedProjectId) throw new Error('Push project does not match this server')
}

function expoHeaders(config: Extract<PushConfiguration, { enabled: true }>) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    ...(config.accessToken ? { authorization: `Bearer ${config.accessToken}` } : {}),
  }
}

function providerErrorCode(value: unknown) {
  if (typeof value !== 'string') return undefined
  switch (value) {
    case 'DeviceNotRegistered': return 'device_not_registered'
    case 'MessageRateExceeded': return 'message_rate_exceeded'
    case 'MismatchSenderId': return 'credential_mismatch'
    case 'InvalidCredentials': return 'invalid_credentials'
    case 'MessageTooBig': return 'payload_too_large'
    default: return 'provider_rejected'
  }
}

function classifyHttpFailure(status: number): { status: 'retry' | 'permanent'; errorCode: string } {
  return {
    status: status === 429 || status >= 500 ? 'retry' : 'permanent',
    errorCode: sanitizeHttpCode(status),
  }
}

function sanitizeHttpCode(status: number) {
  if (status === 429) return 'http_429'
  if (status >= 500) return 'http_5xx'
  if (status === 401 || status === 403) return 'http_auth'
  if (status >= 400) return 'http_4xx'
  return 'http_error'
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function dueDeliveries(ctx: { db: any }, state: Doc<'pushDeliveries'>['state'], now: number) {
  return await ctx.db.query('pushDeliveries')
    .withIndex('by_state_next_attempt', (q: any) => q.eq('state', state).lte('nextAttemptAt', now))
    .take(MAX_SEND_BATCH)
}

async function terminalizeExpiredForStates(
  ctx: { db: any },
  states: Array<Doc<'pushDeliveries'>['state']>,
  now: number,
  limit: number,
) {
  const cutoff = now - MAX_DELIVERY_AGE_MS
  for (const state of states) {
    const rows: Doc<'pushDeliveries'>[] = await ctx.db.query('pushDeliveries')
      .withIndex('by_state_created_at', (q: any) => q.eq('state', state).lte('createdAt', cutoff))
      .take(limit)
    for (const delivery of rows) await permanentlyFail(ctx, delivery, 'delivery_expired', now)
  }
}

async function permanentlyFail(
  ctx: { db: any },
  delivery: Doc<'pushDeliveries'>,
  errorCode: string,
  now: number,
  receiptAttempts?: number,
) {
  await ctx.db.patch(delivery._id, {
    state: 'permanent_failure',
    completedAt: now,
    leaseExpiresAt: undefined,
    receiptLeaseExpiresAt: undefined,
    errorCode,
    updatedAt: now,
    ...(receiptAttempts === undefined ? {} : { receiptAttempts }),
  })
}

async function disableStaleSafe(ctx: { db: any }, deviceId: Id<'pushDevices'>, sentTokenRevision: number | undefined, now: number) {
  if (sentTokenRevision === undefined) return
  const device = await ctx.db.get(deviceId)
  if (!device || device.tokenRevision !== sentTokenRevision) return
  await ctx.db.patch(device._id, { enabled: false, disabledAt: now, tokenRevision: device.tokenRevision + 1, updatedAt: now })
}

function retryDelay(attempt: number) {
  return Math.min(6 * 60 * 60 * 1_000, 30_000 * 2 ** Math.max(0, attempt - 1))
}
