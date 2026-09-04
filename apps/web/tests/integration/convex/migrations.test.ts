import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

function createTest() {
  return convexTest(schema, convexModules)
}

type Step = 'reset_posts' | 'reset_postComments' | 'reset_reviews'
  | 'aggregate_postReactions' | 'aggregate_postComments' | 'aggregate_savedPosts'
  | 'aggregate_commentReactions' | 'aggregate_reviewReactions' | 'aggregate_reviewComments'

async function runStep(t: ReturnType<typeof convexTest>, step: Step, limit: number) {
  let cursor: string | undefined
  let calls = 0
  let lastResult: any = null
  for (let index = 0; index < 500; index += 1) {
    lastResult = await t.mutation(internal.migrations.backfillEngagementCounters, { step, cursor, limit })
    calls += 1
    if (lastResult.isDone) break
    expect(lastResult.nextCursor).toBeTruthy()
    cursor = lastResult.nextCursor as string
  }
  return { ...lastResult, calls }
}

describe('engagement counter backfill', () => {
  it('resets and re-aggregates counters across pages, honoring moderation visibility', async () => {
    const t = createTest()
    const now = Date.now()
    const ids = await t.run(async (ctx) => {
      const authorId = await ctx.db.insert('users', { clerkUserId: 'bf-author', displayName: 'Author', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const memberId = await ctx.db.insert('users', { clerkUserId: 'bf-member', displayName: 'Member', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const postId = await ctx.db.insert('posts', { authorId, body: 'Post', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      const visibleCommentId = await ctx.db.insert('postComments', { postId, authorId: memberId, body: 'visible', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      await ctx.db.insert('postComments', { postId, authorId: memberId, body: 'hidden', reportable: true, hidden: true, createdAt: now + 1, updatedAt: now + 1 })
      await ctx.db.insert('postReactions', { userId: memberId, postId, reaction: 'like', createdAt: now })
      await ctx.db.insert('postReactions', { userId: authorId, postId, reaction: 'like', createdAt: now })
      await ctx.db.insert('savedPosts', { userId: memberId, postId, createdAt: now })
      await ctx.db.insert('commentReactions', { userId: authorId, commentId: visibleCommentId, reaction: 'like', createdAt: now })
      await ctx.db.insert('commentReactions', { userId: memberId, commentId: visibleCommentId, reaction: 'like', createdAt: now + 1 })
      await ctx.db.insert('commentReactions', { userId: memberId, commentId: visibleCommentId, reaction: 'like', createdAt: now + 2 })
      const companionProfileId = await ctx.db.insert('companionProfiles', { userId: authorId, displayName: 'Companion', intro: 'Intro', city: 'City', strengths: [], categories: [], boundaries: [], mode: 'both', status: 'approved', rating: 0, reviewCount: 0, createdAt: now, updatedAt: now })
      const bookingId = await ctx.db.insert('bookings', { memberId, companionProfileId, category: 'c', mode: 'online', requestedAt: now, durationMinutes: 60, status: 'review_window', createdAt: now, updatedAt: now })
      const reviewId = await ctx.db.insert('reviews', { bookingId, reviewerId: memberId, revieweeId: authorId, rating: 5, hidden: false, createdAt: now })
      await ctx.db.insert('reviewReactions', { userId: authorId, reviewId, reaction: 'like', createdAt: now })
      await ctx.db.insert('reviewReactions', { userId: authorId, reviewId, reaction: 'like', createdAt: now + 1 })
      await ctx.db.insert('reviewComments', { reviewId, authorId: memberId, body: 'visible one', hidden: false, createdAt: now, updatedAt: now })
      await ctx.db.insert('reviewComments', { reviewId, authorId: authorId, body: 'visible two', hidden: false, createdAt: now + 1, updatedAt: now + 1 })
      await ctx.db.insert('reviewComments', { reviewId, authorId: memberId, body: 'hidden', hidden: true, createdAt: now + 2, updatedAt: now + 2 })
      return { postId, visibleCommentId, reviewId }
    })

    // Reset phase, one page at a time.
    await runStep(t, 'reset_posts', 1)
    await runStep(t, 'reset_postComments', 1)
    await runStep(t, 'reset_reviews', 1)

    // Aggregate phase, one row per page so completion spans several calls.
    await runStep(t, 'aggregate_postReactions', 1)
    await runStep(t, 'aggregate_postComments', 1)
    await runStep(t, 'aggregate_savedPosts', 1)
    await runStep(t, 'aggregate_commentReactions', 1)
    await runStep(t, 'aggregate_reviewReactions', 1)
    await runStep(t, 'aggregate_reviewComments', 1)

    const post = await t.run(async (ctx) => ctx.db.get(ids.postId))
    expect(post).toMatchObject({ likeCount: 2, commentCount: 1, savedCount: 1 })
    const comment = await t.run(async (ctx) => ctx.db.get(ids.visibleCommentId))
    expect(comment?.likeCount).toBe(3)
    const review = await t.run(async (ctx) => ctx.db.get(ids.reviewId))
    expect(review).toMatchObject({ likeCount: 2, commentCount: 2 })
  })

  it('recomputes a stale counter that was already partially set', async () => {
    const t = createTest()
    const now = Date.now()
    const ids = await t.run(async (ctx) => {
      const authorId = await ctx.db.insert('users', { clerkUserId: 'bf2-author', displayName: 'Author', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const memberId = await ctx.db.insert('users', { clerkUserId: 'bf2-member', displayName: 'Member', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const postId = await ctx.db.insert('posts', { authorId, body: 'Post', reportable: true, hidden: false, likeCount: 99, commentCount: 7, savedCount: 3, createdAt: now, updatedAt: now })
      await ctx.db.insert('postReactions', { userId: memberId, postId, reaction: 'like', createdAt: now })
      return { postId }
    })
    await runStep(t, 'reset_posts', 2)
    await runStep(t, 'reset_postComments', 2)
    await runStep(t, 'reset_reviews', 2)
    await runStep(t, 'aggregate_postReactions', 2)
    const post = await t.run(async (ctx) => ctx.db.get(ids.postId))
    expect(post).toMatchObject({ likeCount: 1, commentCount: 0, savedCount: 0 })
  })

  it('does not double counters when a completed aggregate step is replayed', async () => {
    const t = createTest()
    const now = Date.now()
    const ids = await t.run(async (ctx) => {
      const authorId = await ctx.db.insert('users', { clerkUserId: 'replay-author', displayName: 'Author', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const memberId = await ctx.db.insert('users', { clerkUserId: 'replay-member', displayName: 'Member', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const postId = await ctx.db.insert('posts', { authorId, body: 'Post', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      await ctx.db.insert('postReactions', { userId: memberId, postId, reaction: 'like', createdAt: now })
      await ctx.db.insert('postReactions', { userId: authorId, postId, reaction: 'like', createdAt: now + 1 })
      return { postId }
    })
    await runStep(t, 'reset_posts', 20)
    await runStep(t, 'reset_postComments', 20)
    await runStep(t, 'reset_reviews', 20)
    await runStep(t, 'aggregate_postReactions', 20)
    expect(await t.run(async (ctx) => ctx.db.get(ids.postId))).toMatchObject({ likeCount: 2 })

    const replay = await t.mutation(internal.migrations.backfillEngagementCounters, { step: 'aggregate_postReactions', limit: 20 })
    expect(replay).toMatchObject({ isDone: true, alreadyCompleted: true, processed: 0, changed: 0 })
    expect(await t.run(async (ctx) => ctx.db.get(ids.postId))).toMatchObject({ likeCount: 2 })
  })

  it('rejects resuming an in-progress step with a stale cursor', async () => {
    const t = createTest()
    const now = Date.now()
    const ids = await t.run(async (ctx) => {
      const authorId = await ctx.db.insert('users', { clerkUserId: 'stale-author', displayName: 'Author', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const memberId = await ctx.db.insert('users', { clerkUserId: 'stale-member', displayName: 'Member', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const authorId2 = await ctx.db.insert('users', { clerkUserId: 'stale-author-2', displayName: 'Author 2', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      void authorId2
      const firstId = await ctx.db.insert('posts', { authorId, body: 'first', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      await ctx.db.insert('posts', { authorId: authorId2, body: 'second', reportable: true, hidden: false, createdAt: now + 1, updatedAt: now + 1 })
      void memberId
      return { firstId }
    })
    void ids
    // One page of the reset is consumed; resume from the null cursor is stale.
    const first = await t.mutation(internal.migrations.backfillEngagementCounters, { step: 'reset_posts', limit: 1 })
    expect(first.isDone).toBe(false)
    await expect(t.mutation(internal.migrations.backfillEngagementCounters, { step: 'reset_posts', limit: 1 }))
      .rejects.toThrow('Stale migration cursor')
  })

  it('rejects aggregate steps that skip the reset phase', async () => {
    const t = createTest()
    const now = Date.now()
    await t.run(async (ctx) => {
      const authorId = await ctx.db.insert('users', { clerkUserId: 'order-author', displayName: 'Author', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      await ctx.db.insert('posts', { authorId, body: 'Post', reportable: true, hidden: false, createdAt: now, updatedAt: now })
    })
    await runStep(t, 'reset_posts', 20)
    await expect(t.mutation(internal.migrations.backfillEngagementCounters, { step: 'aggregate_postReactions', limit: 20 }))
      .rejects.toThrow('Migration out of order')
  })
})
