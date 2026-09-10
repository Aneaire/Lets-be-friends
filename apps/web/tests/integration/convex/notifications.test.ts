import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { createNotification } from '../../../convex/notifications'
import { convexModules } from '../../helpers/convex'

const modules = convexModules

async function user(t: ReturnType<typeof convexTest>, subject: string, profileImageUrl?: string) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', { clerkUserId: subject, displayName: subject, profileImageUrl, role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
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

  it('rejects priorities that are not declared by the notification catalog', async () => {
    const t = convexTest(schema, modules)
    const alexId = await user(t, 'alex')
    await expect(t.run((ctx) => createNotification(ctx, {
      recipientUserId: alexId,
      kind: 'booking_accepted',
      priority: 'attention',
      dedupeKey: 'invalid-priority',
    }))).rejects.toThrow('Priority attention is not allowed for booking_accepted')
    expect(await t.run((ctx) => ctx.db.query('notifications').collect())).toEqual([])
  })

  it('paginates safe presentation and omits actor identity for system notifications', async () => {
    const t = convexTest(schema, modules)
    const alexId = await user(t, 'alex', 'https://example.com/alex.jpg')
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
    expect(second.page[0]).toMatchObject({ kind: 'new_follower', actor: { displayName: 'alex', profileImageUrl: 'https://example.com/alex.jpg', available: true } })
  })

  it.each(['muted', 'blocked'] as const)('hides actor details and profile destinations after the recipient %s the actor', async (relationship) => {
    const t = convexTest(schema, modules)
    const actorId = await user(t, `actor-${relationship}`, 'https://example.com/private.jpg')
    const recipientId = await user(t, `recipient-${relationship}`)
    const notificationId = await t.run(async (ctx) => {
      const id = await createNotification(ctx, { recipientUserId: recipientId, actorUserId: actorId, kind: 'new_follower', priority: 'standard', dedupeKey: `follow-${relationship}` })
      const now = Date.now()
      await ctx.db.insert('memberSafetyPreferences', {
        ownerUserId: recipientId,
        targetUserId: actorId,
        pairKey: `${recipientId}:${actorId}`,
        ...(relationship === 'muted' ? { mutedAt: now } : { blockedAt: now }),
        createdAt: now,
        updatedAt: now,
      })
      return id!
    })
    const recipient = t.withIdentity({ subject: `recipient-${relationship}` })

    const rows = await recipient.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(rows.page[0]).toMatchObject({
      actor: { displayName: "Let's Be Friends", available: false },
      destination: { type: 'notifications' },
      targetAvailable: false,
    })
    expect(rows.page[0].actor).not.toHaveProperty('profileImageUrl')
    expect(await recipient.mutation(api.notifications.open, { notificationId: String(notificationId) })).toEqual({ status: 'unavailable' })
  })

  it('hides a suspended actor and makes the actor profile destination unavailable', async () => {
    const t = convexTest(schema, modules)
    const actorId = await user(t, 'suspended-actor', 'https://example.com/private.jpg')
    const recipientId = await user(t, 'suspension-recipient')
    const notificationId = await t.run(async (ctx) => {
      const id = await createNotification(ctx, { recipientUserId: recipientId, actorUserId: actorId, kind: 'new_follower', priority: 'standard', dedupeKey: 'follow-before-suspension' })
      await ctx.db.patch(actorId, { suspended: true, updatedAt: Date.now() })
      return id!
    })
    const recipient = t.withIdentity({ subject: 'suspension-recipient' })

    const rows = await recipient.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(rows.page[0].actor).toEqual({ displayName: "Let's Be Friends", available: false })
    expect(rows.page[0].destination).toEqual({ type: 'notifications' })
    expect(await recipient.mutation(api.notifications.open, { notificationId: String(notificationId) })).toEqual({ status: 'unavailable' })
  })

  it('makes a deleted post notification unavailable', async () => {
    const t = convexTest(schema, modules)
    const actorId = await user(t, 'post-actor')
    const recipientId = await user(t, 'post-recipient')
    const notificationId = await t.run(async (ctx) => {
      const now = Date.now()
      const postId = await ctx.db.insert('posts', { authorId: recipientId, body: 'A post', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      const id = await createNotification(ctx, { recipientUserId: recipientId, actorUserId: actorId, kind: 'post_liked', priority: 'standard', postId, dedupeKey: 'like-before-deletion' })
      await ctx.db.patch(postId, { deletedAt: now + 1, updatedAt: now + 1 })
      return id!
    })
    const recipient = t.withIdentity({ subject: 'post-recipient' })

    const rows = await recipient.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(rows.page[0]).toMatchObject({ destination: { type: 'notifications' }, targetAvailable: false })
    expect(await recipient.mutation(api.notifications.open, { notificationId: String(notificationId) })).toEqual({ status: 'unavailable' })
  })

  it('makes a comment notification unavailable after the recipient blocks its author', async () => {
    const t = convexTest(schema, modules)
    const actorId = await user(t, 'comment-actor', 'https://example.com/private.jpg')
    const recipientId = await user(t, 'comment-recipient')
    const notificationId = await t.run(async (ctx) => {
      const now = Date.now()
      const postId = await ctx.db.insert('posts', { authorId: recipientId, body: 'A post', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      const commentId = await ctx.db.insert('postComments', { postId, authorId: actorId, body: 'A comment', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      const id = await createNotification(ctx, { recipientUserId: recipientId, actorUserId: actorId, kind: 'post_commented', priority: 'standard', postId, commentId, dedupeKey: 'comment-before-block' })
      await ctx.db.insert('memberSafetyPreferences', { ownerUserId: recipientId, targetUserId: actorId, pairKey: `${recipientId}:${actorId}`, blockedAt: now + 1, createdAt: now + 1, updatedAt: now + 1 })
      return id!
    })
    const recipient = t.withIdentity({ subject: 'comment-recipient' })

    const rows = await recipient.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(rows.page[0]).toMatchObject({
      actor: { displayName: "Let's Be Friends", available: false },
      destination: { type: 'notifications' },
      targetAvailable: false,
    })
    expect(await recipient.mutation(api.notifications.open, { notificationId: String(notificationId) })).toEqual({ status: 'unavailable' })
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

  it('notifies the post author when another member likes the post and never on unlike', async () => {
    const t = convexTest(schema, modules)
    const authorId = await user(t, 'author')
    await user(t, 'reader')
    const postId = await t.run((ctx) => ctx.db.insert('posts', {
      authorId,
      body: 'A post',
      reportable: true,
      hidden: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }))
    const reader = t.withIdentity({ subject: 'reader' })
    const author = t.withIdentity({ subject: 'author' })

    expect(await reader.mutation(api.social.toggleLike, { postId })).toBe(true)
    const first = await author.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(first.page).toHaveLength(1)
    expect(first.page[0]).toMatchObject({
      kind: 'post_liked',
      title: 'New like',
      body: 'reader liked your post.',
      destination: { type: 'post', postId: String(postId) },
    })
    expect(await reader.mutation(api.social.toggleLike, { postId })).toBe(false)
    expect(await author.query(api.notifications.unreadCount, {})).toBe(1)
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
    expect(commentMention).toMatchObject({ body: 'Actor mentioned you in a comment.', destination: { type: 'post', postId: String(postId), commentId: String(commentId) } })
    expect(commentMention?.kind).toBe('mention')
    expect(await recipient.mutation(api.notifications.open, { notificationId: commentMention!.id })).toEqual({
      status: 'ready',
      destination: { type: 'post', postId: String(postId), commentId: String(commentId) },
    })
  })

  it('opens a direct message at the exact message and marks its notification read', async () => {
    const t = convexTest(schema, modules)
    const senderId = await user(t, 'sender')
    const recipientId = await user(t, 'recipient')
    const { conversationId, messageId, notificationId } = await t.run(async (ctx) => {
      const now = Date.now()
      const pairKey = [String(senderId), String(recipientId)].sort().join(':')
      const conversationId = await ctx.db.insert('directConversations', { participantOneId: senderId, participantTwoId: recipientId, pairKey, createdAt: now, updatedAt: now })
      const messageId = await ctx.db.insert('directMessages', { conversationId, senderId, body: 'Hello', reportable: true, createdAt: now })
      const notificationId = await createNotification(ctx, { recipientUserId: recipientId, actorUserId: senderId, kind: 'direct_message', priority: 'standard', conversationId, messageId, dedupeKey: `message:${messageId}` })
      return { conversationId, messageId, notificationId: notificationId! }
    })
    const recipient = t.withIdentity({ subject: 'recipient' })

    expect(await recipient.mutation(api.notifications.open, { notificationId: String(notificationId) })).toEqual({
      status: 'ready',
      destination: { type: 'conversation', conversationId: String(conversationId), messageId: String(messageId) },
    })
    expect(await recipient.query(api.notifications.unreadCount, {})).toBe(0)
  })
})

describe('Circle notification privacy', () => {
  async function circleWorld(t: ReturnType<typeof convexTest>) {
    const recipientId = await user(t, 'circle-recipient')
    const actorId = await user(t, 'circle-actor')
    return await t.run(async (ctx) => {
      const now = Date.now()
      const circleId = await ctx.db.insert('circles', {
        slug: 'private-name', name: 'Private Circle Name', purpose: 'Private', category: 'Private', rules: ['Private'], mode: 'online',
        state: 'active', hostUserId: actorId, createdByUserId: actorId, createdAt: now, updatedAt: now,
      })
      const membershipId = await ctx.db.insert('circleMemberships', { circleId, userId: recipientId, state: 'active', role: 'member', rulesAcceptedAt: now, createdAt: now, updatedAt: now })
      await ctx.db.insert('circleMemberships', { circleId, userId: actorId, state: 'active', role: 'host', rulesAcceptedAt: now, createdAt: now, updatedAt: now })
      const postId = await ctx.db.insert('posts', { authorId: actorId, circleId, circleKind: 'discussion', body: 'Secret post text', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      const commentId = await ctx.db.insert('postComments', { postId, authorId: actorId, body: 'Secret comment text', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      return { recipientId, actorId, circleId, membershipId, postId, commentId }
    })
  }

  it('deduplicates activity, honors Circle mute, and uses a Circle destination without private copy', async () => {
    const t = convexTest(schema, modules)
    const world = await circleWorld(t)
    const notificationId = await t.run(async (ctx) => {
      const input = { recipientUserId: world.recipientId, actorUserId: world.actorId, kind: 'circle_reply' as const, priority: 'standard' as const, circleId: world.circleId, postId: world.postId, commentId: world.commentId, dedupeKey: 'circle-reply:one' }
      const first = await createNotification(ctx, input)
      expect(await createNotification(ctx, input)).toBe(first)
      return first!
    })
    const recipient = t.withIdentity({ subject: 'circle-recipient' })
    const row = (await recipient.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })).page[0]
    expect(row).toMatchObject({ kind: 'circle_reply', destination: { type: 'circle', circleId: String(world.circleId), postId: String(world.postId), commentId: String(world.commentId) } })
    expect(`${row.title} ${row.body}`).not.toContain('Private Circle Name')
    expect(`${row.title} ${row.body}`).not.toContain('Secret')
    expect(await recipient.mutation(api.notifications.open, { notificationId: String(notificationId) })).toMatchObject({ status: 'ready', destination: { type: 'circle' } })

    await t.run(async (ctx) => ctx.db.patch(world.membershipId, { mutedAt: Date.now() }))
    expect(await t.run((ctx) => createNotification(ctx, { recipientUserId: world.recipientId, actorUserId: world.actorId, kind: 'circle_announcement', priority: 'standard', circleId: world.circleId, postId: world.postId, dedupeKey: 'circle-announcement:muted' }))).toBeNull()
    expect(await t.run((ctx) => createNotification(ctx, { recipientUserId: world.recipientId, actorUserId: world.actorId, kind: 'circle_member_removed', priority: 'attention', circleId: world.circleId, dedupeKey: 'circle-removal:not-muted' }))).toBeTruthy()
  })

  it('removes private activity from list, unread, and open after access revocation or suspension', async () => {
    const t = convexTest(schema, modules)
    const world = await circleWorld(t)
    const notificationId = await t.run((ctx) => createNotification(ctx, { recipientUserId: world.recipientId, actorUserId: world.actorId, kind: 'circle_mention', priority: 'standard', circleId: world.circleId, postId: world.postId, commentId: world.commentId, dedupeKey: 'circle-mention:revoke' }))
    await t.run(async (ctx) => ctx.db.patch(world.membershipId, { state: 'left' }))
    const recipient = t.withIdentity({ subject: 'circle-recipient' })
    expect((await recipient.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })).page).toEqual([])
    expect(await recipient.query(api.notifications.unreadCount, {})).toBe(0)
    expect(await recipient.mutation(api.notifications.open, { notificationId: String(notificationId) })).toEqual({ status: 'unavailable' })

    await t.run(async (ctx) => {
      await ctx.db.patch(world.membershipId, { state: 'active' })
      await ctx.db.patch(world.circleId, { state: 'suspended' })
    })
    expect((await recipient.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })).page).toEqual([])
  })

  it('delivers join decisions despite Circle mute and suppresses blocked activity', async () => {
    const t = convexTest(schema, modules)
    const world = await circleWorld(t)
    await t.run(async (ctx) => {
      await ctx.db.patch(world.membershipId, { state: 'rejected', mutedAt: Date.now() })
      expect(await createNotification(ctx, { recipientUserId: world.recipientId, actorUserId: world.actorId, kind: 'circle_join_rejected', priority: 'attention', circleId: world.circleId, dedupeKey: 'join-rejected' })).toBeTruthy()
      const now = Date.now()
      await ctx.db.patch(world.membershipId, { state: 'active', mutedAt: undefined })
      await ctx.db.insert('memberSafetyPreferences', { ownerUserId: world.recipientId, targetUserId: world.actorId, pairKey: `${world.recipientId}:${world.actorId}`, blockedAt: now, createdAt: now, updatedAt: now })
      expect(await createNotification(ctx, { recipientUserId: world.recipientId, actorUserId: world.actorId, kind: 'circle_reply', priority: 'standard', circleId: world.circleId, postId: world.postId, dedupeKey: 'blocked-reply' })).toBeNull()
    })
    const rows = await t.withIdentity({ subject: 'circle-recipient' }).query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    expect(rows.page.map((row) => row.kind)).toContain('circle_join_rejected')
  })
})
