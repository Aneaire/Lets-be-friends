import geospatialTest from '@convex-dev/geospatial/test'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { createNotification } from '../../../convex/notifications'
import { localMinuteOfDay, NOTIFICATION_PREFERENCE_DEFAULTS } from '../../../convex/notificationPreferences'
import { convexModules } from '../../helpers/convex'

type TestConvex = ReturnType<typeof createTest>

function createTest() {
  const t = convexTest(schema, convexModules)
  geospatialTest.register(t)
  return t
}

async function insertUser(t: TestConvex, subject: string) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      role: 'member',
      verificationStatus: 'not_started',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function insertPost(t: TestConvex, authorId: any, circleId?: any) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('posts', {
      authorId,
      ...(circleId ? { circleId, circleKind: 'discussion' as const } : {}),
      body: 'A post that can receive notifications.',
      reportable: true,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function insertComment(t: TestConvex, postId: any, authorId: any) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('postComments', {
      postId,
      authorId,
      body: 'A comment that can receive reactions.',
      reportable: true,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function scheduledPushCount(t: TestConvex) {
  const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
  return scheduled.filter((row) => row.name === 'pushNotifications:deliverNotification').length
}

async function notificationRows(t: TestConvex, subject: string) {
  return await t.run(async (ctx) => {
    const user = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', subject)).unique()
    if (!user) return []
    return await ctx.db.query('notifications').withIndex('by_recipient_created_at', (q) => q.eq('recipientUserId', user._id)).collect()
  })
}

async function circleWorld(t: TestConvex) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const hostId = await ctx.db.insert('users', {
      clerkUserId: 'circle-host', displayName: 'circle-host', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now,
    })
    const commentAuthorId = await ctx.db.insert('users', {
      clerkUserId: 'circle-comment-author', displayName: 'circle-comment-author', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now,
    })
    const likerOneId = await ctx.db.insert('users', {
      clerkUserId: 'circle-liker-one', displayName: 'circle-liker-one', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now,
    })
    const likerTwoId = await ctx.db.insert('users', {
      clerkUserId: 'circle-liker-two', displayName: 'circle-liker-two', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now,
    })
    const circleId = await ctx.db.insert('circles', {
      slug: 'quiet-circle', name: 'Quiet Circle', purpose: 'A Circle for notification tests', category: 'Hobbies', rules: ['Be kind'],
      mode: 'online', state: 'active', hostUserId: hostId, createdByUserId: hostId, createdAt: now, updatedAt: now,
    })
    for (const [userId, role] of [[hostId, 'host'], [commentAuthorId, 'member'], [likerOneId, 'member'], [likerTwoId, 'member']] as const) {
      await ctx.db.insert('circleMemberships', {
        circleId, userId, state: 'active', role, rulesAcceptedAt: now, createdAt: now, updatedAt: now,
      })
    }
    const postId = await ctx.db.insert('posts', {
      authorId: hostId, circleId, circleKind: 'discussion', body: 'A Circle post', reportable: true, hidden: false, createdAt: now, updatedAt: now,
    })
    const commentId = await ctx.db.insert('postComments', {
      postId, authorId: commentAuthorId, body: 'A Circle comment', reportable: true, hidden: false, createdAt: now, updatedAt: now,
    })
    return { hostId, commentAuthorId, likerOneId, likerTwoId, circleId, postId, commentId }
  })
}

/** A quiet-hours window of 90 minutes that always contains the current UTC minute and crosses midnight. */
function activeQuietWindow() {
  const minute = localMinuteOfDay(Date.now(), 'UTC')
  return {
    quietHoursStartMinute: (minute + 60) % 1440,
    quietHoursEndMinute: (minute + 30) % 1440,
  }
}

async function enableDigest(
  t: TestConvex,
  subject: string,
  extra: Partial<{ quietHoursEnabled: boolean; quietHoursStartMinute: number; quietHoursEndMinute: number; timeZone: string }> = {},
) {
  const hour = Math.floor(localMinuteOfDay(Date.now(), 'UTC') / 60)
  await t.withIdentity({ subject }).mutation(api.notificationPreferences.update, {
    digestEnabled: true,
    digestHourMinute: hour * 60,
    timeZone: 'UTC',
    ...extra,
  })
}

describe('comment like aggregation', () => {
  it('aggregates post comment likes per comment window and keeps a repeat actor idempotent', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'comment-author')
    await insertUser(t, 'comment-member')
    await insertUser(t, 'comment-outsider')
    await insertUser(t, 'comment-late')
    const postId = await insertPost(t, authorId)
    const commentId = await insertComment(t, postId, authorId)

    await t.withIdentity({ subject: 'comment-member' }).mutation(api.social.toggleCommentLike, { commentId })
    const first = await notificationRows(t, 'comment-author')
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({
      kind: 'comment_liked',
      aggregateCount: 1,
      recipientUserId: authorId,
    })
    expect(first[0].readAt).toBeUndefined()
    expect(first[0].dedupeKey).toMatch(new RegExp(`^comment:${commentId}:likes:\\d+$`))

    await t.withIdentity({ subject: 'comment-outsider' }).mutation(api.social.toggleCommentLike, { commentId })
    const page = await t.withIdentity({ subject: 'comment-author' }).query(api.notifications.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    })
    const collapsed = page.page.find((row) => row.kind === 'comment_liked')
    expect(collapsed).toMatchObject({
      title: 'New likes',
      body: 'comment-outsider and 1 other liked your comment.',
      destination: { type: 'post', postId: String(postId) },
    })

    await t.run(async (ctx) => {
      const row = await ctx.db.query('notifications').withIndex('by_recipient_created_at', (q) => q.eq('recipientUserId', authorId)).first()
      if (row) await ctx.db.patch(row._id, { readAt: Date.now() })
    })
    await t.withIdentity({ subject: 'comment-late' }).mutation(api.social.toggleCommentLike, { commentId })
    const moved = await t.run((ctx) => ctx.db.query('notifications').withIndex('by_recipient_created_at', (q) => q.eq('recipientUserId', authorId)).collect())
    expect(moved).toHaveLength(1)
    expect(moved[0]).toMatchObject({ aggregateCount: 3 })
    expect(moved[0].readAt).toBeUndefined()
    expect(await t.withIdentity({ subject: 'comment-author' }).query(api.notifications.unreadCount, {})).toBe(1)

    // Toggling off and liking again from an actor already counted does not inflate the aggregate.
    await t.withIdentity({ subject: 'comment-member' }).mutation(api.social.toggleCommentLike, { commentId })
    await t.withIdentity({ subject: 'comment-member' }).mutation(api.social.toggleCommentLike, { commentId })
    const repeated = await notificationRows(t, 'comment-author')
    expect(repeated).toHaveLength(1)
    expect(repeated[0]).toMatchObject({ aggregateCount: 3 })
  })

  it('aggregates Circle comment reactions with the Circle copy and destination', async () => {
    const t = createTest()
    const world = await circleWorld(t)

    await t.withIdentity({ subject: 'circle-liker-one' }).mutation(api.social.toggleCommentLike, { commentId: world.commentId })
    await t.withIdentity({ subject: 'circle-liker-two' }).mutation(api.social.toggleCommentLike, { commentId: world.commentId })

    const rows = await notificationRows(t, 'circle-comment-author')
    const reaction = rows.filter((row) => row.kind === 'circle_comment_liked')
    expect(reaction).toHaveLength(1)
    expect(reaction[0]).toMatchObject({ aggregateCount: 2, recipientUserId: world.commentAuthorId })
    expect(reaction[0].readAt).toBeUndefined()
    expect(reaction[0].dedupeKey).toMatch(new RegExp(`^circle-comment:${world.commentId}:likes:\\d+$`))

    await t.withIdentity({ subject: 'circle-liker-one' }).mutation(api.social.toggleCommentLike, { commentId: world.commentId })
    await t.withIdentity({ subject: 'circle-liker-one' }).mutation(api.social.toggleCommentLike, { commentId: world.commentId })
    const repeated = (await notificationRows(t, 'circle-comment-author')).filter((row) => row.kind === 'circle_comment_liked')
    expect(repeated).toHaveLength(1)
    expect(repeated[0].aggregateCount).toBe(2)

    const page = await t.withIdentity({ subject: 'circle-comment-author' }).query(api.notifications.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    })
    const presented = page.page.find((row) => row.kind === 'circle_comment_liked')
    expect(presented).toMatchObject({
      title: 'New Circle comment reactions',
      body: 'circle-liker-two and 1 other reacted to your comment.',
      destination: { type: 'circle', circleId: String(world.circleId), postId: String(world.postId), commentId: String(world.commentId) },
    })
  })
})

describe('notification category preferences', () => {
  it('suppresses a disabled social category row and push while transactional kinds still arrive', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'pref-author')
    const memberId = await insertUser(t, 'pref-member')
    const postId = await insertPost(t, authorId)

    expect(await t.withIdentity({ subject: 'pref-author' }).query(api.notificationPreferences.mine, {}))
      .toEqual(NOTIFICATION_PREFERENCE_DEFAULTS)
    await t.withIdentity({ subject: 'pref-author' }).mutation(api.notificationPreferences.update, { socialReactions: false })
    expect(await t.withIdentity({ subject: 'pref-author' }).query(api.notificationPreferences.mine, {}))
      .toMatchObject({ socialReactions: false })
    await t.withIdentity({ subject: 'pref-member' }).mutation(api.social.toggleLike, { postId })

    expect(await notificationRows(t, 'pref-author')).toEqual([])
    expect(await scheduledPushCount(t)).toBe(0)

    await t.withIdentity({ subject: 'pref-author' }).mutation(api.notificationPreferences.update, {
      socialComments: false,
      socialFollows: false,
      circleActivity: false,
    })
    await t.run(async (ctx) => {
      expect(await createNotification(ctx, {
        recipientUserId: authorId,
        actorUserId: memberId,
        kind: 'booking_accepted',
        priority: 'standard',
        dedupeKey: 'booking:accepted:category-preference',
      })).toBeTruthy()
      expect(await createNotification(ctx, {
        recipientUserId: authorId,
        actorUserId: memberId,
        kind: 'direct_message',
        priority: 'standard',
        dedupeKey: 'message:category-preference',
      })).toBeTruthy()
      expect(await createNotification(ctx, {
        recipientUserId: authorId,
        kind: 'report_resolved',
        priority: 'attention',
        dedupeKey: 'report:resolved:category-preference',
      })).toBeTruthy()
      expect(await createNotification(ctx, {
        recipientUserId: authorId,
        kind: 'identity_verification_expired',
        priority: 'attention',
        dedupeKey: 'identity:expired:category-preference',
      })).toBeTruthy()
    })

    const kinds = (await notificationRows(t, 'pref-author')).map((row) => row.kind).sort()
    expect(kinds).toEqual(['booking_accepted', 'direct_message', 'identity_verification_expired', 'report_resolved'])
    expect(await scheduledPushCount(t)).toBe(4)

    // A social kind stays suppressed even after the transactional rows were written.
    await t.run(async (ctx) => {
      expect(await createNotification(ctx, {
        recipientUserId: authorId,
        actorUserId: memberId,
        kind: 'post_liked',
        priority: 'standard',
        postId,
        dedupeKey: 'post:likes:category-preference',
      })).toBeNull()
    })
    expect((await notificationRows(t, 'pref-author')).filter((row) => row.kind === 'post_liked')).toEqual([])
  })
})

describe('per-target notification mutes', () => {
  it('mutes one post for one viewer without hiding other posts or other viewers', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'mute-author')
    await insertUser(t, 'mute-reader')
    const otherRecipientId = await insertUser(t, 'mute-other-recipient')
    await insertUser(t, 'mute-late-reader')
    const mutedPostId = await insertPost(t, authorId)
    const openPostId = await insertPost(t, authorId)

    const author = t.withIdentity({ subject: 'mute-author' })
    expect(await author.mutation(api.notificationMutes.setMuted, { targetType: 'post', targetId: String(mutedPostId), muted: true })).toBe(true)
    expect(await author.mutation(api.notificationMutes.setMuted, { targetType: 'post', targetId: String(mutedPostId), muted: true })).toBe(true)
    expect(await author.query(api.notificationMutes.mine, {})).toHaveLength(1)

    await t.withIdentity({ subject: 'mute-reader' }).mutation(api.social.toggleLike, { postId: mutedPostId })
    expect((await notificationRows(t, 'mute-author')).filter((row) => row.kind === 'post_liked')).toEqual([])

    await t.withIdentity({ subject: 'mute-reader' }).mutation(api.social.toggleLike, { postId: openPostId })
    const postLikes = (await notificationRows(t, 'mute-author')).filter((row) => row.kind === 'post_liked')
    expect(postLikes).toHaveLength(1)
    expect(String(postLikes[0].postId)).toBe(String(openPostId))

    // The mute belongs to the recipient, so another member still gets a notification about the muted post.
    await t.run(async (ctx) => {
      expect(await createNotification(ctx, {
        recipientUserId: otherRecipientId,
        actorUserId: authorId,
        kind: 'post_commented',
        priority: 'standard',
        postId: mutedPostId,
        dedupeKey: 'comment:other-recipient:post-mute',
      })).toBeTruthy()
    })

    expect(await author.mutation(api.notificationMutes.setMuted, { targetType: 'post', targetId: String(mutedPostId), muted: false })).toBe(false)
    expect(await author.mutation(api.notificationMutes.setMuted, { targetType: 'post', targetId: String(mutedPostId), muted: false })).toBe(false)
    expect(await author.query(api.notificationMutes.mine, {})).toEqual([])

    await t.withIdentity({ subject: 'mute-late-reader' }).mutation(api.social.toggleLike, { postId: mutedPostId })
    const afterUnmute = (await notificationRows(t, 'mute-author')).filter((row) => row.kind === 'post_liked' && String(row.postId) === String(mutedPostId))
    expect(afterUnmute).toHaveLength(1)
  })

  it('rejects unknown mute targets and mutes a Circle without touching other notification kinds', async () => {
    const t = createTest()
    const world = await circleWorld(t)
    const recipient = t.withIdentity({ subject: 'circle-comment-author' })

    await expect(recipient.mutation(api.notificationMutes.setMuted, { targetType: 'post', targetId: 'not-a-real-id', muted: true }))
      .rejects.toThrow('Post not found')
    await expect(recipient.mutation(api.notificationMutes.setMuted, { targetType: 'circle', targetId: 'not-a-real-id', muted: true }))
      .rejects.toThrow('Circle not found')

    expect(await recipient.mutation(api.notificationMutes.setMuted, { targetType: 'circle', targetId: String(world.circleId), muted: true })).toBe(true)
    expect(await recipient.mutation(api.notificationMutes.setMuted, { targetType: 'circle', targetId: String(world.circleId), muted: true })).toBe(true)
    expect(await recipient.query(api.notificationMutes.mine, {})).toHaveLength(1)

    await t.run(async (ctx) => {
      expect(await createNotification(ctx, {
        recipientUserId: world.commentAuthorId,
        actorUserId: world.hostId,
        kind: 'circle_reply',
        priority: 'standard',
        circleId: world.circleId,
        postId: world.postId,
        commentId: world.commentId,
        dedupeKey: 'circle-reply:muted-circle',
      })).toBeNull()
      expect(await createNotification(ctx, {
        recipientUserId: world.commentAuthorId,
        actorUserId: world.hostId,
        kind: 'identity_verification_approved',
        priority: 'attention',
        dedupeKey: 'identity:approved:muted-circle',
      })).toBeTruthy()
      expect(await createNotification(ctx, {
        recipientUserId: world.commentAuthorId,
        actorUserId: world.hostId,
        kind: 'booking_accepted',
        priority: 'standard',
        dedupeKey: 'booking:accepted:muted-circle',
      })).toBeTruthy()
    })

    expect((await notificationRows(t, 'circle-comment-author')).map((row) => row.kind).sort())
      .toEqual(['booking_accepted', 'identity_verification_approved'])
  })
})

describe('member level notification suppression', () => {
  it('keeps suppressing social notifications from a muted member', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'member-mute-author')
    const recipientId = await insertUser(t, 'member-mute-recipient')
    await insertUser(t, 'member-mute-outsider')
    const postId = await insertPost(t, recipientId)

    await t.withIdentity({ subject: 'member-mute-recipient' }).mutation(api.safety.setMuted, { userId: authorId, muted: true })
    await t.withIdentity({ subject: 'member-mute-author' }).mutation(api.social.toggleLike, { postId })
    expect(await notificationRows(t, 'member-mute-recipient')).toEqual([])

    await t.withIdentity({ subject: 'member-mute-recipient' }).mutation(api.safety.setMuted, { userId: authorId, muted: false })
    await t.withIdentity({ subject: 'member-mute-outsider' }).mutation(api.social.toggleLike, { postId })
    const rows = await notificationRows(t, 'member-mute-recipient')
    expect(rows.filter((row) => row.kind === 'post_liked')).toHaveLength(1)
  })
})

describe('quiet hours', () => {
  it('suppresses the social push but keeps the in-app row, including a window that crosses midnight', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'quiet-author')
    await insertUser(t, 'quiet-reader')
    const postId = await insertPost(t, authorId)
    const window = activeQuietWindow()
    expect(window.quietHoursStartMinute).toBeGreaterThan(window.quietHoursEndMinute)

    await t.withIdentity({ subject: 'quiet-author' }).mutation(api.notificationPreferences.update, {
      quietHoursEnabled: true,
      timeZone: 'UTC',
      quietHoursStartMinute: window.quietHoursStartMinute,
      quietHoursEndMinute: window.quietHoursEndMinute,
    })

    await t.withIdentity({ subject: 'quiet-reader' }).mutation(api.social.toggleLike, { postId })

    const rows = await notificationRows(t, 'quiet-author')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'post_liked' })
    expect(rows[0].readAt).toBeUndefined()
    expect(await scheduledPushCount(t)).toBe(0)
    expect(await t.withIdentity({ subject: 'quiet-author' }).query(api.notifications.unreadCount, {})).toBe(1)
  })
})

describe('daily social digest', () => {
  it('creates one digest per local day, skips zero activity, and never counts itself', async () => {
    const t = createTest()
    const memberId = await insertUser(t, 'digest-member')
    await insertUser(t, 'digest-silent')
    await insertUser(t, 'digest-actor')
    await enableDigest(t, 'digest-member')
    await enableDigest(t, 'digest-silent')

    // No unread social activity yet, so the sweep writes nothing.
    expect(await t.mutation(internal.notifications.sendDueSocialDigests, {})).toEqual({ created: 0 })

    const actorId = await t.run(async (ctx) => (await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'digest-actor')).unique())!._id)
    await t.run(async (ctx) => {
      for (const [index, kind] of (['post_liked', 'comment_liked', 'review_commented', 'new_follower'] as const).entries()) {
        await createNotification(ctx, {
          recipientUserId: memberId,
          actorUserId: actorId,
          kind,
          priority: 'standard',
          dedupeKey: `digest-source:${index}`,
        })
      }
    })
    // Digest enabled, so individual social pushes are suppressed.
    expect(await scheduledPushCount(t)).toBe(0)

    expect(await t.mutation(internal.notifications.sendDueSocialDigests, {})).toEqual({ created: 1 })
    const digests = (await notificationRows(t, 'digest-member')).filter((row) => row.kind === 'social_digest')
    expect(digests).toHaveLength(1)
    expect(digests[0]).toMatchObject({
      priority: 'standard',
      aggregateCount: 4,
      dedupeKey: expect.stringMatching(/^social-digest:.+:\d{4}-\d{2}-\d{2}$/),
    })

    const page = await t.withIdentity({ subject: 'digest-member' }).query(api.notifications.list, {
      paginationOpts: { cursor: null, numItems: 20 },
    })
    expect(page.page.find((row) => row.kind === 'social_digest')).toMatchObject({
      title: 'Your daily update',
      body: 'You have 4 new updates from your feed and Circles.',
      destination: { type: 'notifications' },
    })
    expect(await notificationRows(t, 'digest-silent')).toEqual([])

    // A second sweep in the same local day never creates a second digest.
    expect(await t.mutation(internal.notifications.sendDueSocialDigests, {})).toEqual({ created: 0 })
    expect((await notificationRows(t, 'digest-member')).filter((row) => row.kind === 'social_digest')).toHaveLength(1)

    // Mark the source updates read and drop the day key. If the digest counted
    // itself, this sweep would create another digest from that unread row.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query('notifications').withIndex('by_recipient_created_at', (q) => q.eq('recipientUserId', memberId)).collect()
      for (const row of rows) {
        if (row.kind === 'social_digest') await ctx.db.patch(row._id, { dedupeKey: 'social-digest:test-reset' })
        else await ctx.db.patch(row._id, { readAt: Date.now() })
      }
    })
    expect(await t.mutation(internal.notifications.sendDueSocialDigests, {})).toEqual({ created: 0 })
    expect((await notificationRows(t, 'digest-member')).filter((row) => row.kind === 'social_digest')).toHaveLength(1)
  })

  it('keeps the digest row while quiet hours suppress only its push', async () => {
    const t = createTest()
    const memberId = await insertUser(t, 'digest-quiet-member')
    await insertUser(t, 'digest-quiet-actor')
    const window = activeQuietWindow()
    await enableDigest(t, 'digest-quiet-member', {
      quietHoursEnabled: true,
      quietHoursStartMinute: window.quietHoursStartMinute,
      quietHoursEndMinute: window.quietHoursEndMinute,
    })

    const actorId = await t.run(async (ctx) => (await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'digest-quiet-actor')).unique())!._id)
    await t.run(async (ctx) => {
      for (const [index, kind] of (['post_liked', 'new_follower'] as const).entries()) {
        await createNotification(ctx, {
          recipientUserId: memberId,
          actorUserId: actorId,
          kind,
          priority: 'standard',
          dedupeKey: `digest-quiet-source:${index}`,
        })
      }
    })

    expect(await t.mutation(internal.notifications.sendDueSocialDigests, {})).toEqual({ created: 1 })
    const digests = (await notificationRows(t, 'digest-quiet-member')).filter((row) => row.kind === 'social_digest')
    expect(digests).toHaveLength(1)
    expect(digests[0]).toMatchObject({ aggregateCount: 2 })
    expect(await scheduledPushCount(t)).toBe(0)
  })
})

describe('notification preference mutations', () => {
  it('resolves defaults for a member with no stored row and merges partial updates', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'preference-member')
    await insertUser(t, 'preference-other')
    const viewer = t.withIdentity({ subject: 'preference-member' })

    expect(await viewer.query(api.notificationPreferences.mine, {})).toEqual(NOTIFICATION_PREFERENCE_DEFAULTS)

    const updated = await viewer.mutation(api.notificationPreferences.update, {
      socialComments: false,
      timeZone: 'Asia/Manila',
      quietHoursStartMinute: 1230,
    })
    expect(updated).toEqual({
      ...NOTIFICATION_PREFERENCE_DEFAULTS,
      socialComments: false,
      timeZone: 'Asia/Manila',
      quietHoursStartMinute: 1230,
    })
    expect(await viewer.query(api.notificationPreferences.mine, {})).toEqual(updated)
    expect(await t.withIdentity({ subject: 'preference-other' }).query(api.notificationPreferences.mine, {}))
      .toEqual(NOTIFICATION_PREFERENCE_DEFAULTS)

    const stored = await t.run((ctx) => ctx.db.query('notificationPreferences').withIndex('by_user', (q) => q.eq('userId', userId)).unique())
    expect(stored).toMatchObject({ userId, socialComments: false })
    expect(stored?.socialReactions).toBeUndefined()

    await viewer.mutation(api.notificationPreferences.update, { socialComments: true })
    const second = await t.run((ctx) => ctx.db.query('notificationPreferences').withIndex('by_user', (q) => q.eq('userId', userId)).unique())
    expect(second?._id).toBe(stored?._id)
    expect(second?.socialReactions).toBeUndefined()
    expect(await viewer.query(api.notificationPreferences.mine, {})).toMatchObject({ socialComments: true, timeZone: 'Asia/Manila' })

    await expect(viewer.mutation(api.notificationPreferences.update, { quietHoursStartMinute: 1440 }))
      .rejects.toThrow('Quiet hours start must be a whole minute between 0 and 1439')
    await expect(viewer.mutation(api.notificationPreferences.update, { digestHourMinute: -1 }))
      .rejects.toThrow('Digest hour must be a whole minute between 0 and 1439')
    await expect(viewer.mutation(api.notificationPreferences.update, { timeZone: 'Mars/Olympus' }))
      .rejects.toThrow('Unknown time zone')
  })
})
