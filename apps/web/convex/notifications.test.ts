import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { createNotification } from './notifications'

const modules = import.meta.glob('./**/*.ts')

async function user(t: ReturnType<typeof convexTest>, subject: string) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', { clerkUserId: subject, displayName: subject, role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
  })
}

describe('notifications', () => {
  it('suppresses self notifications and deduplicates by recipient and event key', async () => {
    const t = convexTest(schema, modules)
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    await t.run(async (ctx) => {
      expect(await createNotification(ctx, { recipientUserId: alexId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'self' })).toBeNull()
      const first = await createNotification(ctx, { recipientUserId: samId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'follow:1' })
      const duplicate = await createNotification(ctx, { recipientUserId: samId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'follow:1' })
      expect(duplicate).toBe(first)
    })
    expect(await t.withIdentity({ subject: 'sam' }).query(api.notifications.unreadCount, {})).toBe(1)
    const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].name).toBe('pushNotifications:deliverNotification')
  })

  it('paginates safe presentation and omits actor identity for system notifications', async () => {
    const t = convexTest(schema, modules)
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    await t.run(async (ctx) => {
      await createNotification(ctx, { recipientUserId: samId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'follow' })
      await createNotification(ctx, { recipientUserId: samId, kind: 'identity_verification_approved', priority: 'attention', dedupeKey: 'system' })
    })
    const sam = t.withIdentity({ subject: 'sam' })
    const first = await sam.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 1 } })
    expect(first.page).toHaveLength(1)
    expect(first.isDone).toBe(false)
    expect(first.page[0]).not.toHaveProperty('actor')
    const second = await sam.query(api.notifications.list, { paginationOpts: { cursor: first.continueCursor, numItems: 1 } })
    expect(second.page[0]).toMatchObject({ kind: 'new_follower', actor: { displayName: 'alex', available: true } })
  })

  it('enforces ownership and supports read, unread, and all-read actions', async () => {
    const t = convexTest(schema, modules)
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    const ids = await t.run(async (ctx) => Promise.all([
      createNotification(ctx, { recipientUserId: samId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'one' }),
      createNotification(ctx, { recipientUserId: samId, kind: 'identity_verification_approved', priority: 'attention', dedupeKey: 'two' }),
    ]))
    const sam = t.withIdentity({ subject: 'sam' })
    const alex = t.withIdentity({ subject: 'alex' })
    expect(await alex.mutation(api.notifications.open, { notificationId: String(ids[0]!) })).toEqual({ status: 'unavailable' })
    expect(await alex.mutation(api.notifications.open, { notificationId: 'not-an-id' })).toEqual({ status: 'unavailable' })
    expect(await sam.mutation(api.notifications.open, { notificationId: String(ids[0]!) })).toEqual({ status: 'ready', destination: { type: 'profile', userId: String(alexId) } })
    expect(await sam.query(api.notifications.unreadCount, {})).toBe(1)
    await sam.mutation(api.notifications.markUnread, { notificationId: ids[0]! })
    expect(await sam.query(api.notifications.unreadCount, {})).toBe(2)
    expect(await sam.mutation(api.notifications.markAllRead, {})).toEqual({ updated: 2 })
    expect(await sam.query(api.notifications.unreadCount, {})).toBe(0)
  })

  it('creates a notification through the follow producer and never through unfollow', async () => {
    const t = convexTest(schema, modules)
    await user(t, 'alex')
    await user(t, 'sam')
    const samId = await t.run(async (ctx) => (await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'sam')).unique())!._id)
    const alex = t.withIdentity({ subject: 'alex' })
    const sam = t.withIdentity({ subject: 'sam' })
    expect(await alex.mutation(api.social.toggleFollow, { userId: samId })).toBe(true)
    expect(await sam.query(api.notifications.unreadCount, {})).toBe(1)
    expect(await alex.mutation(api.social.toggleFollow, { userId: samId })).toBe(false)
    expect(await sam.query(api.notifications.unreadCount, {})).toBe(1)
  })

  it('notifies only the other participant when the second completion opens reviews', async () => {
    const t = convexTest(schema, modules)
    const memberId = await user(t, 'member')
    const companionId = await user(t, 'companion')
    const now = Date.now()
    const companionProfileId = await t.run(async (ctx) => ctx.db.insert('companionProfiles', {
      userId: companionId, displayName: 'Companion', intro: 'intro', city: 'City', strengths: [], categories: ['Coffee'], boundaries: [], mode: 'online', status: 'approved', rating: 0, reviewCount: 0, createdAt: now, updatedAt: now,
    }))
    const bookingId = await t.run(async (ctx) => ctx.db.insert('bookings', {
      memberId, companionProfileId, category: 'Coffee', mode: 'online', requestedAt: now - 3_600_001, durationMinutes: 60, status: 'accepted', createdAt: now, updatedAt: now,
    }))
    const member = t.withIdentity({ subject: 'member' })
    const companion = t.withIdentity({ subject: 'companion' })
    await member.mutation(api.bookings.markCompleted, { bookingId })
    await companion.mutation(api.bookings.markCompleted, { bookingId })
    const memberRows = await member.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    const companionRows = await companion.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(memberRows.page.map((row) => row.kind)).toEqual(['booking_review_window_opened'])
    expect(memberRows.page[0].actor).toMatchObject({ userId: String(companionId), displayName: 'companion' })
    expect(companionRows.page.map((row) => row.kind)).toEqual(['booking_completion_confirmed'])
    expect(companionRows.page.some((row) => row.kind === 'booking_review_window_opened')).toBe(false)
  })

  it('creates representative producer notifications and keeps booking system messages out of message unread', async () => {
    const t = convexTest(schema, modules)
    const memberId = await user(t, 'member')
    const companionId = await user(t, 'companion')
    const now = Date.now()
    const companionProfileId = await t.run(async (ctx) => ctx.db.insert('companionProfiles', {
      userId: companionId, displayName: 'Companion', intro: 'intro', city: 'City', strengths: [], categories: ['Coffee'], boundaries: [], mode: 'online', hourlyRateCentavos: 10000, status: 'approved', rating: 0, reviewCount: 0, createdAt: now, updatedAt: now,
    }))
    const bookingId = await t.run(async (ctx) => ctx.db.insert('bookings', {
      memberId, companionProfileId, category: 'Coffee', mode: 'online', requestedAt: now + 100000, durationMinutes: 60, status: 'request_sent', createdAt: now, updatedAt: now,
    }))
    const conversationId = await t.run(async (ctx) => {
      const pairKey = [String(memberId), String(companionId)].sort().join(':')
      const id = await ctx.db.insert('directConversations', { participantOneId: memberId, participantTwoId: companionId, pairKey, createdAt: now, updatedAt: now })
      await ctx.db.insert('directMessages', { conversationId: id, senderId: memberId, body: 'Booking request', reportable: true, bookingId, createdAt: now })
      await createNotification(ctx, { recipientUserId: companionId, actorUserId: memberId, kind: 'booking_request', priority: 'attention', bookingId, conversationId: id, dedupeKey: `booking:${bookingId}:request` })
      return id
    })
    const companion = t.withIdentity({ subject: 'companion' })
    expect(await companion.query(api.notifications.unreadCount, {})).toBe(1)
    expect(await companion.query(api.conversations.list, {})).toMatchObject([{ _id: conversationId, unreadCount: 0 }])
  })

  it('presents identity expiry copy with an identity destination and no request ID', async () => {
    const t = convexTest(schema, modules)
    const samId = await user(t, 'sam')
    await t.run(async (ctx) => {
      await createNotification(ctx, { recipientUserId: samId, kind: 'identity_verification_expiring', priority: 'standard', dedupeKey: 'expiring-1' })
      await createNotification(ctx, { recipientUserId: samId, kind: 'identity_verification_expired', priority: 'attention', dedupeKey: 'expired-1' })
    })
    const rows = await t.withIdentity({ subject: 'sam' }).query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    const expiring = rows.page.find((row) => row.kind === 'identity_verification_expiring')
    const expired = rows.page.find((row) => row.kind === 'identity_verification_expired')
    expect(expiring).toMatchObject({ title: 'Identity verification expiring soon', destination: { type: 'identity' } })
    expect(expired).toMatchObject({ title: 'Identity verification expired', destination: { type: 'identity' } })
    expect(expiring?.body).not.toContain('no longer available')
    expect(expired?.body).not.toContain('no longer available')
  })

  it('presents mention copy that distinguishes post from comment and routes to the post', async () => {
    const t = convexTest(schema, modules)
    const now = Date.now()
    const { postId, commentId } = await t.run(async (ctx) => {
      const actorId = await ctx.db.insert('users', { clerkUserId: 'actor', displayName: 'Actor', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const recipientId = await ctx.db.insert('users', { clerkUserId: 'recipient', displayName: 'Recipient', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const pid = await ctx.db.insert('posts', { authorId: actorId, body: 'A post', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      const cid = await ctx.db.insert('postComments', { postId: pid, authorId: actorId, body: 'A comment', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      await createNotification(ctx, { recipientUserId: recipientId, actorUserId: actorId, kind: 'mention', priority: 'standard', postId: pid, dedupeKey: 'post-mention:1' })
      await createNotification(ctx, { recipientUserId: recipientId, actorUserId: actorId, kind: 'mention', priority: 'standard', postId: pid, commentId: cid, dedupeKey: 'comment-mention:1' })
      return { postId: pid, commentId: cid }
    })
    const recipient = t.withIdentity({ subject: 'recipient' })
    const rows = await recipient.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    const postMention = rows.page.find((row) => row.body.includes('in a post'))
    const commentMention = rows.page.find((row) => row.body.includes('in a comment'))
    expect(postMention).toMatchObject({ title: 'You were mentioned', body: 'Actor mentioned you in a post.', destination: { type: 'post', postId: String(postId) } })
    expect(commentMention).toMatchObject({ body: 'Actor mentioned you in a comment.', destination: { type: 'post', postId: String(postId) } })
    expect(commentMention?.kind).toBe('mention')
    void commentId
  })
})
