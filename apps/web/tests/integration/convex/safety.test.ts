import geospatialTest from '@convex-dev/geospatial/test'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import { createNotification } from '../../../convex/notifications'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules

function createTest() { const t = convexTest(schema, modules); geospatialTest.register(t); return t }

async function user(t: ReturnType<typeof convexTest>, subject: string) {
  return await t.run(async (ctx) => { const now = Date.now(); return await ctx.db.insert('users', { clerkUserId: subject, displayName: subject, role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now }) })
}

describe('member safety preferences', () => {
  it('stops new contact in both directions while preserving existing messages', async () => {
    const t = createTest()
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    const conversationId = await t.withIdentity({ subject: 'alex' }).mutation(api.conversations.start, { otherUserId: samId })
    await t.withIdentity({ subject: 'alex' }).mutation(api.conversations.sendMessage, { conversationId, body: 'Preserved context' })
    await t.withIdentity({ subject: 'alex' }).mutation(api.safety.setBlocked, { userId: samId, blocked: true })

    await expect(t.withIdentity({ subject: 'alex' }).mutation(api.conversations.sendMessage, { conversationId, body: 'blocked' })).rejects.toThrow('blocked')
    await expect(t.withIdentity({ subject: 'sam' }).mutation(api.conversations.sendMessage, { conversationId, body: 'blocked' })).rejects.toThrow('blocked')
    const history = await t.withIdentity({ subject: 'sam' }).query(api.conversations.messages, { conversationId })
    expect(history.messages.map((message) => message.body)).toContain('Preserved context')
    expect(await t.withIdentity({ subject: 'alex' }).query(api.safety.relationship, { userId: samId })).toMatchObject({ blocked: true, blockedByOther: false })
    expect(await t.withIdentity({ subject: 'sam' }).query(api.safety.relationship, { userId: alexId })).toMatchObject({ blocked: false, blockedByOther: true })
  })

  it('suppresses muted social notifications but preserves critical booking notifications', async () => {
    const t = createTest()
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    await t.withIdentity({ subject: 'sam' }).mutation(api.safety.setMuted, { userId: alexId, muted: true })
    const created = await t.run(async (ctx) => ({
      follower: await createNotification(ctx, { recipientUserId: samId, actorUserId: alexId, kind: 'new_follower', priority: 'standard', dedupeKey: 'social-follow' }),
      like: await createNotification(ctx, { recipientUserId: samId, actorUserId: alexId, kind: 'post_liked', priority: 'standard', dedupeKey: 'social-like' }),
      critical: await createNotification(ctx, { recipientUserId: samId, actorUserId: alexId, kind: 'booking_cancelled', priority: 'attention', dedupeKey: 'critical' }),
    }))
    expect(created.follower).toBeNull()
    expect(created.like).toBeNull()
    expect(created.critical).toBeTruthy()
  })

  it('rejects saving a Companion profile when either member has blocked the other', async () => {
    const t = createTest()
    const alexId = await user(t, 'alex')
    const samId = await user(t, 'sam')
    const companionProfileId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('companionProfiles', {
        userId: samId,
        displayName: 'Sam',
        intro: 'Public activities with clear plans.',
        city: 'Cebu City',
        strengths: ['Good listener'],
        categories: ['Good company'],
        boundaries: ['Public places only'],
        mode: 'both',
        status: 'approved',
        rating: 5,
        reviewCount: 1,
        createdAt: now,
        updatedAt: now,
      })
    })
    await t.withIdentity({ subject: 'sam' }).mutation(api.safety.setBlocked, { userId: alexId, blocked: true })

    await expect(t.withIdentity({ subject: 'alex' }).mutation(api.companions.toggleSaveProfile, { companionProfileId }))
      .rejects.toThrow('blocked')
    expect(await t.run(async (ctx) => ctx.db.query('savedProfiles').collect())).toEqual([])
  })

  it('hides comments from blocked and muted authors in both direct comment queries', async () => {
    const t = createTest()
    const viewerId = await user(t, 'viewer')
    const visibleAuthorId = await user(t, 'visible-author')
    const blockedAuthorId = await user(t, 'blocked-author')
    const mutedAuthorId = await user(t, 'muted-author')
    const postId = await t.run(async (ctx) => {
      const now = Date.now()
      const id = await ctx.db.insert('posts', { authorId: viewerId, body: 'Conversation', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      await Promise.all([
        ctx.db.insert('postComments', { postId: id, authorId: visibleAuthorId, body: 'visible', reportable: true, hidden: false, createdAt: now + 1, updatedAt: now + 1 }),
        ctx.db.insert('postComments', { postId: id, authorId: blockedAuthorId, body: 'blocked', reportable: true, hidden: false, createdAt: now + 2, updatedAt: now + 2 }),
        ctx.db.insert('postComments', { postId: id, authorId: mutedAuthorId, body: 'muted', reportable: true, hidden: false, createdAt: now + 3, updatedAt: now + 3 }),
      ])
      return id
    })
    const viewer = t.withIdentity({ subject: 'viewer' })
    await viewer.mutation(api.safety.setBlocked, { userId: blockedAuthorId, blocked: true })
    await viewer.mutation(api.safety.setMuted, { userId: mutedAuthorId, muted: true })

    const allComments = await viewer.query(api.social.commentsForPost, { postId })
    const page = await viewer.query(api.social.commentPage, { postId, paginationOpts: { cursor: null, numItems: 10 } })
    expect(allComments.map((comment) => comment.body)).toEqual(['visible'])
    expect(page.page.map((comment) => comment.body)).toEqual(['visible'])

    const [blockedPostId, mutedPostId] = await t.run(async (ctx) => {
      const now = Date.now()
      const blockedPostId = await ctx.db.insert('posts', { authorId: blockedAuthorId, body: 'blocked post', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      const mutedPostId = await ctx.db.insert('posts', { authorId: mutedAuthorId, body: 'muted post', reportable: true, hidden: false, createdAt: now + 1, updatedAt: now + 1 })
      await Promise.all([
        ctx.db.insert('postComments', { postId: blockedPostId, authorId: visibleAuthorId, body: 'reply to blocked post', reportable: true, hidden: false, createdAt: now + 2, updatedAt: now + 2 }),
        ctx.db.insert('postComments', { postId: mutedPostId, authorId: visibleAuthorId, body: 'reply to muted post', reportable: true, hidden: false, createdAt: now + 3, updatedAt: now + 3 }),
      ])
      return [blockedPostId, mutedPostId]
    })
    for (const hiddenPostId of [blockedPostId, mutedPostId]) {
      expect(await viewer.query(api.social.commentsForPost, { postId: hiddenPostId })).toEqual([])
      expect(await viewer.query(api.social.commentPage, { postId: hiddenPostId, paginationOpts: { cursor: null, numItems: 10 } }))
        .toMatchObject({ page: [], isDone: true })
    }
    const safeFeed = await viewer.query(api.social.feedPage, { filter: 'for_you', paginationOpts: { cursor: null, numItems: 10 } })
    expect(safeFeed.page.filter((item: any) => item.kind === 'post').map((item: any) => item.post.body)).toEqual(['Conversation'])
  })
})
