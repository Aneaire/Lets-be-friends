import geospatialTest from '@convex-dev/geospatial/test'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const user = (clerkUserId: string, suspended = false) => ({
      clerkUserId,
      displayName: clerkUserId,
      role: 'member' as const,
      verificationStatus: 'not_started' as const,
      suspended,
      createdAt: now,
      updatedAt: now,
    })
    const reporterId = await ctx.db.insert('users', user('reporter'))
    const targetId = await ctx.db.insert('users', user('target'))
    const outsiderId = await ctx.db.insert('users', user('outsider'))
    const suspendedId = await ctx.db.insert('users', user('suspended', true))
    const companionUserId = await ctx.db.insert('users', user('companion'))
    await ctx.db.insert('memberSafetyPreferences', {
      ownerUserId: reporterId,
      targetUserId: targetId,
      pairKey: `${reporterId}:${targetId}`,
      blockedAt: now,
      mutedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Companion',
      intro: 'Public profile',
      city: 'Test City',
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode: 'both',
      status: 'approved',
      rating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    const draftProfileId = await ctx.db.insert('companionProfiles', {
      userId: targetId,
      displayName: 'Draft',
      intro: 'Draft profile',
      city: 'Test City',
      strengths: [],
      categories: [],
      boundaries: [],
      mode: 'online',
      status: 'draft',
      rating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    const suspendedProfileId = await ctx.db.insert('companionProfiles', {
      userId: suspendedId,
      displayName: 'Suspended',
      intro: 'Unavailable profile',
      city: 'Test City',
      strengths: [],
      categories: [],
      boundaries: [],
      mode: 'online',
      status: 'approved',
      rating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    const ownProfileId = await ctx.db.insert('companionProfiles', {
      userId: reporterId,
      displayName: 'Reporter',
      intro: 'Own profile',
      city: 'Test City',
      strengths: [],
      categories: [],
      boundaries: [],
      mode: 'online',
      status: 'approved',
      rating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    const bookingId = await ctx.db.insert('bookings', {
      memberId: reporterId,
      companionProfileId,
      category: 'Coffee or meal companion',
      mode: 'online',
      requestedAt: now + 86_400_000,
      durationMinutes: 60,
      status: 'accepted',
      pricingModel: 'member_wallet_v2',
      settlementState: 'reserved',
      createdAt: now,
      updatedAt: now,
    })
    const conversationId = await ctx.db.insert('directConversations', {
      participantOneId: reporterId,
      participantTwoId: targetId,
      pairKey: 'reporter:target',
      createdAt: now,
      updatedAt: now,
    })
    const outsiderConversationId = await ctx.db.insert('directConversations', {
      participantOneId: targetId,
      participantTwoId: outsiderId,
      pairKey: 'outsider:target',
      createdAt: now,
      updatedAt: now,
    })
    const messageId = await ctx.db.insert('directMessages', { conversationId, senderId: targetId, body: 'Target message', reportable: true, createdAt: now })
    const ownMessageId = await ctx.db.insert('directMessages', { conversationId, senderId: reporterId, body: 'Own message', reportable: true, createdAt: now })
    const nonreportableMessageId = await ctx.db.insert('directMessages', { conversationId, senderId: targetId, body: 'System context', reportable: false, createdAt: now })
    const outsiderMessageId = await ctx.db.insert('directMessages', { conversationId: outsiderConversationId, senderId: targetId, body: 'Private message', reportable: true, createdAt: now })
    const reviewId = await ctx.db.insert('reviews', { bookingId, reviewerId: targetId, revieweeId: reporterId, rating: 5, createdAt: now })
    const hiddenReviewId = await ctx.db.insert('reviews', { bookingId, reviewerId: targetId, revieweeId: reporterId, rating: 1, hidden: true, createdAt: now })
    const ownReviewId = await ctx.db.insert('reviews', { bookingId, reviewerId: reporterId, revieweeId: targetId, rating: 5, createdAt: now })
    const postId = await ctx.db.insert('posts', { authorId: targetId, body: 'Visible post', reportable: true, hidden: false, createdAt: now, updatedAt: now })
    const hiddenPostId = await ctx.db.insert('posts', { authorId: targetId, body: 'Hidden post', reportable: true, hidden: true, createdAt: now, updatedAt: now })
    const deletedPostId = await ctx.db.insert('posts', { authorId: targetId, body: 'Deleted post', reportable: true, hidden: false, deletedAt: now, createdAt: now, updatedAt: now })
    const nonreportablePostId = await ctx.db.insert('posts', { authorId: targetId, body: 'Retained context', reportable: false, hidden: false, createdAt: now, updatedAt: now })
    const ownPostId = await ctx.db.insert('posts', { authorId: reporterId, body: 'Own post', reportable: true, hidden: false, createdAt: now, updatedAt: now })
    const commentId = await ctx.db.insert('postComments', { postId, authorId: targetId, body: 'Visible comment', reportable: true, hidden: false, createdAt: now, updatedAt: now })
    const hiddenCommentId = await ctx.db.insert('postComments', { postId, authorId: targetId, body: 'Hidden comment', reportable: true, hidden: true, createdAt: now, updatedAt: now })
    const nonreportableCommentId = await ctx.db.insert('postComments', { postId, authorId: targetId, body: 'Retained context', reportable: false, hidden: false, createdAt: now, updatedAt: now })
    const ownCommentId = await ctx.db.insert('postComments', { postId, authorId: reporterId, body: 'Own comment', reportable: true, hidden: false, createdAt: now, updatedAt: now })
    const hiddenParentCommentId = await ctx.db.insert('postComments', { postId: hiddenPostId, authorId: targetId, body: 'Hidden parent', reportable: true, hidden: false, createdAt: now, updatedAt: now })
    const nonreportableParentCommentId = await ctx.db.insert('postComments', { postId: nonreportablePostId, authorId: targetId, body: 'Non-reportable parent', reportable: true, hidden: false, createdAt: now, updatedAt: now })
    const missingPostId = await ctx.db.insert('posts', { authorId: targetId, body: 'Delete me', reportable: true, hidden: false, createdAt: now, updatedAt: now })
    await ctx.db.delete(missingPostId)
    return {
      reporterId, targetId, suspendedId, companionProfileId, draftProfileId, suspendedProfileId, ownProfileId,
      bookingId, messageId, ownMessageId, nonreportableMessageId, outsiderMessageId,
      reviewId, hiddenReviewId, ownReviewId, postId, hiddenPostId, deletedPostId, nonreportablePostId, ownPostId,
      commentId, hiddenCommentId, nonreportableCommentId, ownCommentId, hiddenParentCommentId, nonreportableParentCommentId, missingPostId,
    }
  })
}

async function expectNoWrites(t: ReturnType<typeof convexTest>) {
  const state = await t.run(async (ctx) => ({
    reports: await ctx.db.query('reports').collect(),
    audits: (await ctx.db.query('auditLogs').collect()).filter((row) => row.action === 'report.created'),
  }))
  expect(state.reports).toHaveLength(0)
  expect(state.audits).toHaveLength(0)
}

describe('report target authorization', () => {
  it('creates reports for every reportable target type and applies a booking settlement hold', async () => {
    const t = createTest()
    const ids = await seed(t)
    const targets = [
      ['profile', ids.companionProfileId],
      ['booking', ids.bookingId],
      ['message', ids.messageId],
      ['review', ids.reviewId],
      ['post', ids.postId],
      ['comment', ids.commentId],
      ['user', ids.targetId],
    ] as const

    for (const [targetType, targetId] of targets) {
      await t.withIdentity({ subject: 'reporter' }).mutation(api.reports.create, { targetType, targetId: String(targetId), reason: '  Clear safety concern  ' })
    }

    const state = await t.run(async (ctx) => ({
      reports: await ctx.db.query('reports').collect(),
      audits: (await ctx.db.query('auditLogs').collect()).filter((row) => row.action === 'report.created'),
      booking: await ctx.db.get(ids.bookingId),
    }))
    expect(state.reports).toHaveLength(7)
    expect(state.reports.every((report) => report.reason === 'Clear safety concern')).toBe(true)
    expect(state.audits).toHaveLength(7)
    expect(state.booking?.settlementState).toBe('blocked')
    expect(state.booking?.settlementBlockedAt).toBeTypeOf('number')
  })

  it('accepts a trimmed reason at the 2000-character server limit', async () => {
    const t = createTest()
    const ids = await seed(t)
    await expect(t.withIdentity({ subject: 'reporter' }).mutation(api.reports.create, {
      targetType: 'user',
      targetId: String(ids.targetId),
      reason: ` ${'x'.repeat(2_000)} `,
    })).resolves.toBeDefined()
    const report = await t.run(async (ctx) => ctx.db.query('reports').first())
    expect(report?.reason).toHaveLength(2_000)
  })

  it('rejects malformed and missing target IDs without any report or audit write', async () => {
    const t = createTest()
    const ids = await seed(t)
    for (const targetType of ['profile', 'booking', 'message', 'review', 'post', 'comment', 'user'] as const) {
      await expect(t.withIdentity({ subject: 'reporter' }).mutation(api.reports.create, { targetType, targetId: 'not-an-id', reason: 'Concern' })).rejects.toThrow()
    }
    await expect(t.withIdentity({ subject: 'reporter' }).mutation(api.reports.create, { targetType: 'post', targetId: String(ids.missingPostId), reason: 'Concern' })).rejects.toThrow('Post not found')
    await expectNoWrites(t)
  })

  it('rejects unavailable, hidden, deleted, non-reportable, suspended, and self-owned targets', async () => {
    const t = createTest()
    const ids = await seed(t)
    const rejected = [
      ['profile', ids.draftProfileId], ['profile', ids.suspendedProfileId], ['profile', ids.ownProfileId],
      ['message', ids.ownMessageId], ['message', ids.nonreportableMessageId],
      ['review', ids.hiddenReviewId], ['review', ids.ownReviewId],
      ['post', ids.hiddenPostId], ['post', ids.deletedPostId], ['post', ids.nonreportablePostId], ['post', ids.ownPostId],
      ['comment', ids.hiddenCommentId], ['comment', ids.nonreportableCommentId], ['comment', ids.ownCommentId], ['comment', ids.hiddenParentCommentId], ['comment', ids.nonreportableParentCommentId],
      ['user', ids.suspendedId], ['user', ids.reporterId],
    ] as const
    for (const [targetType, targetId] of rejected) {
      await expect(t.withIdentity({ subject: 'reporter' }).mutation(api.reports.create, { targetType, targetId: String(targetId), reason: 'Concern' })).rejects.toThrow()
    }
    await expectNoWrites(t)
  })

  it('rejects booking outsiders, conversation outsiders, and oversized reasons without partial state changes', async () => {
    const t = createTest()
    const ids = await seed(t)
    const bookingBefore = await t.run(async (ctx) => ctx.db.get(ids.bookingId))
    await expect(t.withIdentity({ subject: 'outsider' }).mutation(api.reports.create, { targetType: 'booking', targetId: String(ids.bookingId), reason: 'Concern' })).rejects.toThrow('Only a booking participant')
    await expect(t.withIdentity({ subject: 'reporter' }).mutation(api.reports.create, { targetType: 'message', targetId: String(ids.outsiderMessageId), reason: 'Concern' })).rejects.toThrow('Only a conversation participant')
    await expect(t.withIdentity({ subject: 'reporter' }).mutation(api.reports.create, { targetType: 'user', targetId: String(ids.targetId), reason: ` ${'x'.repeat(2_001)} ` })).rejects.toThrow('2000 characters or fewer')
    expect(await t.run(async (ctx) => ctx.db.get(ids.bookingId))).toEqual(bookingBefore)
    await expectNoWrites(t)
  })
})
