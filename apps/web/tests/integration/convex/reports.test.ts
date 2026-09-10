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

describe('Circle report privacy', () => {
  async function circleWorld(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      const now = Date.now()
      const addUser = async (subject: string, role: 'member' | 'reviewer' | 'admin' = 'member', verified = false) => await ctx.db.insert('users', {
        clerkUserId: subject,
        displayName: subject,
        role,
        verificationStatus: verified ? 'approved' : 'not_started',
        verificationSource: verified ? 'in_app' : undefined,
        identityVerifiedAt: verified ? now : undefined,
        identityExpiresAt: verified ? now + 86_400_000 : undefined,
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      const adminId = await addUser('circle-admin', 'admin')
      const reviewerId = await addUser('circle-reviewer', 'reviewer')
      const hostId = await addUser('circle-host', 'member', true)
      const memberId = await addUser('circle-member')
      await addUser('circle-outsider')
      const circleId = await ctx.db.insert('circles', {
        slug: 'reported-circle', name: 'Reported Circle', purpose: 'Private discussion', category: 'Safety', rules: ['Be kind'],
        mode: 'online', state: 'active', hostUserId: hostId, createdByUserId: adminId, createdAt: now, updatedAt: now,
      })
      const hostMembershipId = await ctx.db.insert('circleMemberships', { circleId, userId: hostId, state: 'active', role: 'host', rulesAcceptedAt: now, createdAt: now, updatedAt: now })
      const memberMembershipId = await ctx.db.insert('circleMemberships', { circleId, userId: memberId, state: 'active', role: 'member', rulesAcceptedAt: now, createdAt: now, updatedAt: now })
      const postId = await ctx.db.insert('posts', { authorId: hostId, circleId, circleKind: 'discussion', body: 'Reported Circle post body', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      const commentId = await ctx.db.insert('postComments', { postId, authorId: hostId, body: 'Reported Circle comment body', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      return { circleId, postId, commentId, hostId, memberId, memberMembershipId, hostMembershipId, reviewerId }
    })
  }

  it('routes Circle, post, and comment reports to platform review with denormalized context', async () => {
    const t = createTest()
    const world = await circleWorld(t)
    const outsider = t.withIdentity({ subject: 'circle-outsider' })
    const member = t.withIdentity({ subject: 'circle-member' })

    await outsider.mutation(api.reports.create, { targetType: 'circle', targetId: String(world.circleId), reason: 'Circle concern' })
    await member.mutation(api.reports.create, { targetType: 'post', targetId: String(world.postId), reason: 'Post concern' })
    await member.mutation(api.reports.create, { targetType: 'comment', targetId: String(world.commentId), reason: 'Comment concern' })
    const stored = await t.run(async (ctx) => ctx.db.query('reports').collect())
    expect(stored).toHaveLength(3)
    expect(stored.every((report) => report.circleId === world.circleId)).toBe(true)

    await expect(t.withIdentity({ subject: 'circle-host' }).query(api.admin.reports, {})).rejects.toThrow('Admin role required')
    const queue = await t.withIdentity({ subject: 'circle-reviewer' }).query(api.admin.reports, { targetType: 'post' })
    expect(queue).toEqual([expect.objectContaining({
      reporterId: world.memberId,
      circleContext: { circleId: world.circleId, name: 'Reported Circle', slug: 'reported-circle', state: 'active' },
      reportedCircleContent: expect.objectContaining({ targetType: 'post', body: 'Reported Circle post body' }),
    })])
  })

  it('denies revoked readers without report or audit writes', async () => {
    const t = createTest()
    const world = await circleWorld(t)
    await t.run(async (ctx) => ctx.db.patch(world.memberMembershipId, { state: 'left' }))

    await expect(t.withIdentity({ subject: 'circle-member' }).mutation(api.reports.create, { targetType: 'post', targetId: String(world.postId), reason: 'No access' }))
      .rejects.toThrow('Active Circle membership required')
    await expect(t.withIdentity({ subject: 'circle-member' }).mutation(api.reports.create, { targetType: 'comment', targetId: String(world.commentId), reason: 'No access' }))
      .rejects.toThrow('Active Circle membership required')
    const state = await t.run(async (ctx) => ({ reports: await ctx.db.query('reports').collect(), audits: await ctx.db.query('auditLogs').collect() }))
    expect(state.reports).toHaveLength(0)
    expect(state.audits.filter((audit) => audit.action === 'report.created')).toHaveLength(0)
  })

  it('keeps general post listings Circle-free and reserves Circle browsing for full admins', async () => {
    const t = createTest()
    const world = await circleWorld(t)
    await t.run(async (ctx) => ctx.db.insert('posts', { authorId: world.hostId, body: 'Global admin post', reportable: true, hidden: false, createdAt: Date.now(), updatedAt: Date.now() }))

    const reviewer = t.withIdentity({ subject: 'circle-reviewer' })
    expect(await reviewer.query(api.admin.posts, {})).toEqual([expect.objectContaining({ body: 'Global admin post' })])
    await expect(reviewer.query(api.admin.circlePosts, { circleId: world.circleId })).rejects.toThrow('Full admin role required')
    await expect(t.withIdentity({ subject: 'circle-admin' }).query(api.admin.circlePosts, { circleId: world.circleId }))
      .resolves.toEqual([expect.objectContaining({ _id: world.postId, body: 'Reported Circle post body' })])
  })

  it('keeps platform hiding separate from Circle removal and limits reviewers to reported Circle posts', async () => {
    const t = createTest()
    const world = await circleWorld(t)
    const reviewer = t.withIdentity({ subject: 'circle-reviewer' })

    await expect(reviewer.mutation(api.admin.setPostHidden, { postId: world.postId, hidden: true, note: 'Needs platform review' }))
      .rejects.toThrow('Reported Circle post required')
    expect((await t.run(async (ctx) => ctx.db.get(world.postId)))?.hidden).toBe(false)
    await t.withIdentity({ subject: 'circle-member' }).mutation(api.reports.create, { targetType: 'post', targetId: String(world.postId), reason: 'Report first' })
    await reviewer.mutation(api.admin.setPostHidden, { postId: world.postId, hidden: true, note: 'Needs platform review' })
    expect(await t.run(async (ctx) => ctx.db.get(world.postId))).toMatchObject({ hidden: true })
    expect((await t.run(async (ctx) => ctx.db.get(world.postId)))?.circleRemovedAt).toBeUndefined()

    await reviewer.mutation(api.admin.setPostHidden, { postId: world.postId, hidden: false })
    await t.withIdentity({ subject: 'circle-host' }).mutation(api.circles.setPostRemoved, { postId: world.postId, removed: true })
    const post = await t.run(async (ctx) => ctx.db.get(world.postId))
    expect(post?.hidden).toBe(false)
    expect(post?.circleRemovedAt).toBeTypeOf('number')
  })
})
