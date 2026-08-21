import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { classifyReceipt, classifyTicket, nativePushBody, pushMessage } from '../../../convex/pushNotifications'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
const projectId = 'a32cb8bc-1021-43b6-82ea-d5376ba33340'
const tokenOne = 'ExponentPushToken[device_one]'
const tokenTwo = 'ExpoPushToken[device_two]'
const installOne = '10000000-0000-4000-8000-000000000001'
const installTwo = '10000000-0000-4000-8000-000000000002'
const DAY_MS = 24 * 60 * 60 * 1_000

async function user(t: ReturnType<typeof convexTest>, subject: string) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', { clerkUserId: subject, displayName: subject, role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
  })
}

beforeEach(() => {
  process.env.EXPO_PUSH_ENABLED = 'true'
  process.env.EXPO_PROJECT_ID = projectId
})

afterEach(() => {
  delete process.env.EXPO_PUSH_ENABLED
  delete process.env.EXPO_PROJECT_ID
  delete process.env.EXPO_PUSH_ACCESS_TOKEN
})

describe('push notification registration and delivery', () => {
  it('reports actual installation registration without exposing a token, even when delivery is disabled', async () => {
    const t = convexTest(schema, modules)
    await user(t, 'alex')
    const alex = t.withIdentity({ subject: 'alex' })
    expect(await alex.query(api.pushNotifications.state, { installationId: installOne })).toEqual({ available: true, registered: false })
    await alex.mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenOne, platform: 'android', projectId })
    process.env.EXPO_PUSH_ENABLED = 'false'
    const state = await alex.query(api.pushNotifications.state, { installationId: installOne })
    expect(state).toEqual({ available: false, registered: true })
    expect(JSON.stringify(state)).not.toContain(tokenOne)
    expect(await alex.mutation(api.pushNotifications.disableDevice, { installationId: installOne })).toEqual({ disabled: true })
    expect(await alex.query(api.pushNotifications.state, { installationId: installOne })).toEqual({ available: false, registered: false })
  })

  it('requires EXPO_PUSH_ENABLED to be exactly true', async () => {
    const t = convexTest(schema, modules)
    await user(t, 'alex')
    const alex = t.withIdentity({ subject: 'alex' })
    process.env.EXPO_PUSH_ENABLED = 'TRUE'
    expect(await alex.query(api.pushNotifications.state, { installationId: installOne })).toEqual({ available: false, registered: false })
  })

  it('reports registration only for the viewer current installation', async () => {
    const t = convexTest(schema, modules)
    await user(t, 'alex')
    await user(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const sam = t.withIdentity({ subject: 'sam' })
    await alex.mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenOne, platform: 'android', projectId })
    await alex.mutation(api.pushNotifications.registerDevice, { installationId: installTwo, expoPushToken: tokenTwo, platform: 'android', projectId })
    expect(await alex.query(api.pushNotifications.state, { installationId: installOne })).toEqual({ available: true, registered: true })
    expect(await alex.query(api.pushNotifications.state, { installationId: installTwo })).toEqual({ available: true, registered: true })
    expect(await sam.query(api.pushNotifications.state, { installationId: installOne })).toEqual({ available: true, registered: false })
    await alex.mutation(api.pushNotifications.disableDevice, { installationId: installOne })
    expect(await alex.query(api.pushNotifications.state, { installationId: installOne })).toEqual({ available: true, registered: false })
    expect(await alex.query(api.pushNotifications.state, { installationId: installTwo })).toEqual({ available: true, registered: true })
  })

  it('supports token refresh, account reassignment, and owner-only disable', async () => {
    const t = convexTest(schema, modules)
    await user(t, 'alex')
    await user(t, 'sam')
    const alex = t.withIdentity({ subject: 'alex' })
    const sam = t.withIdentity({ subject: 'sam' })
    await alex.mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenOne, platform: 'android', projectId })
    await alex.mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenTwo, platform: 'android', projectId })
    let device = await t.run((ctx) => ctx.db.query('pushDevices').withIndex('by_installation', (q) => q.eq('installationId', installOne)).first())
    expect(device).toMatchObject({ expoPushToken: tokenTwo, tokenRevision: 2, enabled: true })
    await sam.mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenTwo, platform: 'android', projectId })
    device = await t.run((ctx) => ctx.db.query('pushDevices').withIndex('by_installation', (q) => q.eq('installationId', installOne)).first())
    const samId = await t.run((ctx) => ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'sam')).unique())
    expect(device).toMatchObject({ userId: samId!._id, tokenRevision: 3, enabled: true })
    expect(await alex.mutation(api.pushNotifications.disableDevice, { installationId: installOne })).toEqual({ disabled: false })
    expect(await sam.mutation(api.pushNotifications.disableDevice, { installationId: installOne })).toEqual({ disabled: true })
  })

  it('creates one delivery per notification and device without copying the token', async () => {
    const t = convexTest(schema, modules)
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    await t.withIdentity({ subject: 'sam' }).mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenOne, platform: 'android', projectId })
    const notificationId = await t.run((ctx) => ctx.db.insert('notifications', { recipientUserId: samId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'follow:1', createdAt: Date.now() }))
    expect(await t.mutation(internal.pushNotifications.prepareDeliveries, { notificationId, projectId })).toEqual({ created: 1 })
    expect(await t.mutation(internal.pushNotifications.prepareDeliveries, { notificationId, projectId })).toEqual({ created: 0 })
    const deliveries = await t.run((ctx) => ctx.db.query('pushDeliveries').withIndex('by_notification', (q) => q.eq('notificationId', notificationId)).collect())
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).not.toHaveProperty('expoPushToken')
  })

  it('does not reclaim an active send lease and ignores a late first result after reclaim', async () => {
    const t = convexTest(schema, modules)
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    await t.withIdentity({ subject: 'sam' }).mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenOne, platform: 'android', projectId })
    const notificationId = await t.run((ctx) => ctx.db.insert('notifications', { recipientUserId: samId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'lease', createdAt: Date.now() }))
    await t.mutation(internal.pushNotifications.prepareDeliveries, { notificationId, projectId })
    const now = Date.now()
    const first = await t.mutation(internal.pushNotifications.claimDeliveries, { now, projectId, notificationId })
    expect(first).toHaveLength(1)
    expect(await t.mutation(internal.pushNotifications.claimDeliveries, { now: now + 1_000, projectId, notificationId })).toEqual([])
    const second = await t.mutation(internal.pushNotifications.claimDeliveries, { now: now + 2 * 60 * 1_000, projectId, notificationId })
    expect(second[0]).toMatchObject({ sendGeneration: first[0].sendGeneration + 1 })
    await t.mutation(internal.pushNotifications.applyTickets, {
      results: [{ deliveryId: first[0].deliveryId, sendGeneration: first[0].sendGeneration, sentTokenRevision: first[0].tokenRevision, status: 'permanent', errorCode: 'device_not_registered' }],
      now: now + 2 * 60 * 1_000 + 1,
    })
    expect(await t.run((ctx) => ctx.db.get(first[0].deliveryId))).toMatchObject({ state: 'sending', sendGeneration: second[0].sendGeneration })
    const device = await t.run((ctx) => ctx.db.get(first[0].deviceId))
    expect(device).toMatchObject({ enabled: true, tokenRevision: first[0].tokenRevision })
  })

  it('protects receipt checks with a reclaimable generation lease and ignores late results', async () => {
    const t = convexTest(schema, modules)
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    await t.withIdentity({ subject: 'sam' }).mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenOne, platform: 'android', projectId })
    const deliveryId = await t.run(async (ctx) => {
      const device = await ctx.db.query('pushDevices').withIndex('by_installation', (q) => q.eq('installationId', installOne)).unique()
      const notificationId = await ctx.db.insert('notifications', { recipientUserId: samId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'receipt-lease', createdAt: Date.now() })
      return await ctx.db.insert('pushDeliveries', { notificationId, userId: samId, deviceId: device!._id, idempotencyKey: `${notificationId}:${device!._id}`, state: 'ticketed', sendAttempts: 1, sendGeneration: 1, receiptAttempts: 0, nextAttemptAt: Date.now(), expoTicketId: 'ticket-one', sentTokenRevision: device!.tokenRevision, createdAt: Date.now(), updatedAt: Date.now() })
    })
    const now = Date.now() + 1_000
    const first = await t.mutation(internal.pushNotifications.claimReceipts, { now })
    expect(first).toHaveLength(1)
    expect(await t.mutation(internal.pushNotifications.claimReceipts, { now: now + 1_000 })).toEqual([])
    const second = await t.mutation(internal.pushNotifications.claimReceipts, { now: now + 2 * 60 * 1_000 })
    expect(second[0]).toMatchObject({ deliveryId, ticketId: 'ticket-one', receiptGeneration: first[0].receiptGeneration + 1 })
    await t.mutation(internal.pushNotifications.applyReceipts, {
      results: [{ ...first[0], status: 'delivered' }],
      now: now + 2 * 60 * 1_000 + 1,
    })
    expect(await t.run((ctx) => ctx.db.get(deliveryId))).toMatchObject({ state: 'ticketed', receiptGeneration: second[0].receiptGeneration, receiptAttempts: 0 })
  })

  it('prevents stale DeviceNotRegistered results from disabling a refreshed generation', async () => {
    const t = convexTest(schema, modules)
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    const sam = t.withIdentity({ subject: 'sam' })
    await sam.mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenOne, platform: 'android', projectId })
    const notificationId = await t.run((ctx) => ctx.db.insert('notifications', { recipientUserId: samId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'disable-generation', createdAt: Date.now() }))
    await t.mutation(internal.pushNotifications.prepareDeliveries, { notificationId, projectId })
    const claim = (await t.mutation(internal.pushNotifications.claimDeliveries, { now: Date.now(), projectId, notificationId }))[0]
    await sam.mutation(api.pushNotifications.disableDevice, { installationId: installOne })
    await sam.mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenOne, platform: 'android', projectId })
    await t.mutation(internal.pushNotifications.applyTickets, { results: [{ deliveryId: claim.deliveryId, sendGeneration: claim.sendGeneration, sentTokenRevision: claim.tokenRevision, status: 'permanent', errorCode: 'device_not_registered' }], now: Date.now() })
    expect(await t.run((ctx) => ctx.db.get(claim.deviceId))).toMatchObject({ enabled: true, tokenRevision: claim.tokenRevision + 2 })
  })

  it('expires old nonterminal work and purge progresses past it', async () => {
    const t = convexTest(schema, modules)
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    await t.withIdentity({ subject: 'sam' }).mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenOne, platform: 'android', projectId })
    const now = Date.now()
    const deliveryId = await t.run(async (ctx) => {
      const device = await ctx.db.query('pushDevices').withIndex('by_installation', (q) => q.eq('installationId', installOne)).unique()
      const notificationId = await ctx.db.insert('notifications', { recipientUserId: samId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'expired', createdAt: now - 40 * DAY_MS })
      return await ctx.db.insert('pushDeliveries', { notificationId, userId: samId, deviceId: device!._id, idempotencyKey: `${notificationId}:${device!._id}`, state: 'pending', sendAttempts: 0, receiptAttempts: 0, nextAttemptAt: now - 40 * DAY_MS, createdAt: now - 40 * DAY_MS, updatedAt: now - 40 * DAY_MS })
    })
    expect(await t.mutation(internal.pushNotifications.claimDeliveries, { now, projectId })).toEqual([])
    expect(await t.run((ctx) => ctx.db.get(deliveryId))).toMatchObject({ state: 'permanent_failure', errorCode: 'delivery_expired' })
    const purged = await t.mutation(internal.pushNotifications.purgeOperationalData, {})
    expect(purged.deletedDeliveries).toBe(1)
    expect(await t.run((ctx) => ctx.db.get(deliveryId))).toBeNull()
  })

  it('counts receipt checks and stops after the bounded attempt limit', async () => {
    const t = convexTest(schema, modules)
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    await t.withIdentity({ subject: 'sam' }).mutation(api.pushNotifications.registerDevice, { installationId: installOne, expoPushToken: tokenOne, platform: 'android', projectId })
    const deliveryId = await t.run(async (ctx) => {
      const device = await ctx.db.query('pushDevices').withIndex('by_installation', (q) => q.eq('installationId', installOne)).unique()
      const notificationId = await ctx.db.insert('notifications', { recipientUserId: samId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'receipt-attempts', createdAt: Date.now() })
      return await ctx.db.insert('pushDeliveries', { notificationId, userId: samId, deviceId: device!._id, idempotencyKey: `${notificationId}:${device!._id}`, state: 'ticketed', sendAttempts: 1, receiptAttempts: 4, nextAttemptAt: Date.now(), expoTicketId: 'ticket-retry', sentTokenRevision: device!.tokenRevision, createdAt: Date.now(), updatedAt: Date.now() })
    })
    const claim = (await t.mutation(internal.pushNotifications.claimReceipts, { now: Date.now() + 1_000 }))[0]
    await t.mutation(internal.pushNotifications.applyReceipts, { results: [{ ...claim, status: 'retry_receipt', errorCode: 'receipt_pending' }], now: Date.now() + 2_000 })
    expect(await t.run((ctx) => ctx.db.get(deliveryId))).toMatchObject({ state: 'permanent_failure', receiptAttempts: 5, errorCode: 'receipt_attempts_exhausted' })
  })

  it('keeps payloads generic and classifies bounded retry cases', () => {
    const direct = pushMessage({ token: tokenOne, platform: 'android', notificationId: 'notification-1', kind: 'direct_message', unreadCount: 3 })
    expect(direct).toEqual({
      to: tokenOne,
      title: "Let's Be Friends",
      body: 'You have a new message.',
      data: { version: 1, notificationId: 'notification-1' },
      badge: 3,
      sound: 'default',
      priority: 'default',
      channelId: 'account-updates',
    })
    expect(Object.keys(direct.data)).toEqual(['version', 'notificationId'])
    expect(JSON.stringify(direct)).not.toMatch(/actor|conversation|booking|route|url|attachment|text|note|location|price|category/i)
    expect(nativePushBody('mention')).toBe('Someone mentioned you.')
    expect(nativePushBody('post_commented')).toBe('You have a new update.')
    expect(nativePushBody('identity_verification_expiring')).toBe('Your identity approval expires soon.')
    expect(nativePushBody('identity_verification_expired')).toBe('Your identity approval has expired.')
    const expiring = pushMessage({ token: tokenOne, platform: 'ios', notificationId: 'notification-expiring', kind: 'identity_verification_expiring', unreadCount: 0 })
    expect(expiring.body).toBe('Your identity approval expires soon.')
    expect(expiring).not.toHaveProperty('channelId')
    expect(classifyTicket({ status: 'error', details: { error: 'MessageRateExceeded' } })).toEqual({ status: 'retry', errorCode: 'message_rate_exceeded' })
    expect(classifyReceipt(undefined)).toEqual({ status: 'retry_receipt', errorCode: 'receipt_pending' })
  })
})
