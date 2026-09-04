import geospatialTest from '@convex-dev/geospatial/test'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

function createTest() {
  const t = convexTest(schema, convexModules)
  geospatialTest.register(t)
  return t
}

async function seedReviewableBooking(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const user = (clerkUserId: string, role: 'member' | 'companion' = 'member') => ({
      clerkUserId,
      displayName: clerkUserId,
      role,
      verificationStatus: 'not_started' as const,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
    const memberId = await ctx.db.insert('users', { ...user('review-member'), displayName: 'Fallback Member', firstName: 'Angelo', lastName: 'Santiago' })
    const companionUserId = await ctx.db.insert('users', user('review-companion', 'companion'))
    await ctx.db.insert('users', user('review-outsider'))
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Review Companion',
      intro: 'A Companion used to verify review behavior.',
      city: 'Test City',
      strengths: ['Good listener'],
      categories: ['Good company'],
      boundaries: ['Public places only'],
      mode: 'both',
      status: 'approved',
      rating: 4,
      reviewCount: 2,
      createdAt: now,
      updatedAt: now,
    })
    const bookingId = await ctx.db.insert('bookings', {
      memberId,
      companionProfileId,
      category: 'Good company',
      mode: 'online',
      requestedAt: now - 86_400_000,
      durationMinutes: 60,
      status: 'review_window',
      createdAt: now,
      updatedAt: now,
    })
    return { bookingId, companionProfileId, memberId }
  })
}

describe('review submission', () => {
  it('records participant reviews, updates the Companion rating, and closes after both sides review', async () => {
    const t = createTest()
    const { bookingId, companionProfileId } = await seedReviewableBooking(t)

    await t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, {
      bookingId,
      rating: 5,
      body: '  Thoughtful session  ',
    })
    let state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      companion: await ctx.db.get(companionProfileId),
      reviews: await ctx.db.query('reviews').collect(),
    }))
    expect(state.booking?.status).toBe('review_window')
    expect(state.companion).toMatchObject({ rating: 13 / 3, reviewCount: 3 })
    expect(state.reviews[0]).toMatchObject({ rating: 5, body: 'Thoughtful session', companionProfileId })

    await t.withIdentity({ subject: 'review-companion' }).mutation(api.reviews.submit, {
      bookingId,
      rating: 4,
    })
    state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      companion: await ctx.db.get(companionProfileId),
      reviews: await ctx.db.query('reviews').collect(),
    }))
    expect(state.booking?.status).toBe('closed')
    expect(state.companion?.reviewCount).toBe(3)
    expect(state.reviews).toHaveLength(2)
    expect(await t.run(async (ctx) => ctx.db.query('auditLogs').collect())).toHaveLength(2)
    expect(await t.run(async (ctx) => ctx.db.query('notifications').collect())).toHaveLength(2)
  })

  it('rejects invalid, unauthorized, and duplicate reviews without partial writes', async () => {
    const t = createTest()
    const { bookingId, companionProfileId } = await seedReviewableBooking(t)

    await expect(t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, {
      bookingId,
      rating: 6,
    })).rejects.toThrow('between 1 and 5')
    await expect(t.withIdentity({ subject: 'review-outsider' }).mutation(api.reviews.submit, {
      bookingId,
      rating: 5,
    })).rejects.toThrow('Not your booking')
    await t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, { bookingId, rating: 5 })
    await expect(t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, {
      bookingId,
      rating: 1,
    })).rejects.toThrow('already reviewed')

    const state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      companion: await ctx.db.get(companionProfileId),
      reviews: await ctx.db.query('reviews').collect(),
      audits: await ctx.db.query('auditLogs').collect(),
      notifications: await ctx.db.query('notifications').collect(),
    }))
    expect(state.booking?.status).toBe('review_window')
    expect(state.companion).toMatchObject({ rating: 13 / 3, reviewCount: 3 })
    expect(state.reviews).toHaveLength(1)
    expect(state.audits).toHaveLength(1)
    expect(state.notifications).toHaveLength(1)
  })

  it('publishes one registered photo and returns the reviewer identity with the image URL', async () => {
    const t = createTest()
    const { bookingId, companionProfileId } = await seedReviewableBooking(t)
    const member = t.withIdentity({ subject: 'review-member' })
    const grant = await member.mutation(api.reviews.generateImageUploadUrl, {})
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(['photo'], { type: 'image/png' }))
      await (ctx.db as any).patch(id, { contentType: 'image/png' })
      return id
    })
    await expect(t.withIdentity({ subject: 'review-outsider' }).mutation(api.reviews.registerImageUpload, {
      uploadId: grant.uploadId,
      storageId,
    })).rejects.toThrow('not found')
    await member.mutation(api.reviews.registerImageUpload, { uploadId: grant.uploadId, storageId })
    await member.mutation(api.reviews.submit, { bookingId, rating: 5, body: 'A good plan.', imageUploadId: grant.uploadId })

    const reviews = await t.query(api.reviews.forCompanion, { companionProfileId })
    expect(reviews).toHaveLength(1)
    expect(reviews[0]).toMatchObject({
      reviewerDisplayName: 'Angelo Santiago',
      reviewerId: expect.any(String),
      rating: 5,
      imageStorageId: storageId,
    })
    expect(reviews[0].imageUrl).toContain('http')
  })

  it('lets signed-in members like and comment on visible reviews', async () => {
    const t = createTest()
    const { bookingId, companionProfileId } = await seedReviewableBooking(t)
    const reviewId = await t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, { bookingId, rating: 5, body: 'Kind and clear.' })
    const outsider = t.withIdentity({ subject: 'review-outsider' })

    await expect(outsider.mutation(api.reviews.toggleLike, { reviewId })).resolves.toBe(true)
    await outsider.mutation(api.reviews.createComment, { reviewId, body: '  Helpful review.  ' })
    let reviews = await outsider.query(api.reviews.forCompanion, { companionProfileId })
    expect(reviews[0]).toMatchObject({ liked: true, likeCount: 1, commentCount: 1 })
    expect(reviews[0].comments[0]).toMatchObject({ body: 'Helpful review.', authorDisplayName: 'review-outsider' })

    await expect(outsider.mutation(api.reviews.toggleLike, { reviewId })).resolves.toBe(false)
    await expect(outsider.mutation(api.reviews.createComment, { reviewId, body: '   ' })).rejects.toThrow('cannot be empty')
    reviews = await outsider.query(api.reviews.forCompanion, { companionProfileId })
    expect(reviews[0].likeCount).toBe(0)
    expect(await t.run(async (ctx) => ctx.db.query('reviewComments').collect())).toHaveLength(1)
  })
})

describe('review engagement counters and rate limits', () => {
  it('maintains exact review like and comment counters through reactions and comments', async () => {
    const t = createTest()
    const { bookingId, companionProfileId } = await seedReviewableBooking(t)
    const reviewId = await t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, { bookingId, rating: 5, body: 'Good' })
    const fresh = await t.run(async (ctx) => ctx.db.get(reviewId))
    expect(fresh).toMatchObject({ likeCount: 0, commentCount: 0 })
    const outsider = t.withIdentity({ subject: 'review-outsider' })
    await outsider.mutation(api.reviews.toggleLike, { reviewId })
    await outsider.mutation(api.reviews.createComment, { reviewId, body: 'Nice review' })
    let review = await t.run(async (ctx) => ctx.db.get(reviewId))
    expect(review).toMatchObject({ likeCount: 1, commentCount: 1 })
    await outsider.mutation(api.reviews.toggleLike, { reviewId })
    review = await t.run(async (ctx) => ctx.db.get(reviewId))
    expect(review?.likeCount).toBe(0)
    const enriched = await outsider.query(api.reviews.forCompanion, { companionProfileId })
    expect(enriched[0]).toMatchObject({ likeCount: 0, commentCount: 1, liked: false })
  })

  it('rejects review comments past the shared 30 per minute window without partial writes', async () => {
    const t = createTest()
    const { bookingId } = await seedReviewableBooking(t)
    const reviewId = await t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, { bookingId, rating: 5 })
    const outsider = t.withIdentity({ subject: 'review-outsider' })
    for (let index = 0; index < 30; index += 1) {
      await outsider.mutation(api.reviews.createComment, { reviewId, body: `Comment ${index}` })
    }
    const before = await t.run(async (ctx) => ({
      comments: (await ctx.db.query('reviewComments').collect()).length,
      audits: (await ctx.db.query('auditLogs').collect()).length,
      count: (await ctx.db.get(reviewId))?.commentCount,
    }))
    await expect(outsider.mutation(api.reviews.createComment, { reviewId, body: 'Over limit' })).rejects.toThrow('commenting too quickly')
    const after = await t.run(async (ctx) => ({
      comments: (await ctx.db.query('reviewComments').collect()).length,
      audits: (await ctx.db.query('auditLogs').collect()).length,
      count: (await ctx.db.get(reviewId))?.commentCount,
    }))
    expect(before).toMatchObject({ comments: 30, count: 30 })
    expect(after).toEqual(before)
  })

  it('shows the newest bounded set of review comments chronologically while keeping the exact count', async () => {    const t = createTest()
    const { bookingId, companionProfileId, memberId } = await seedReviewableBooking(t)
    const reviewId = await t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, { bookingId, rating: 5, body: 'Kind and clear.' })
    const now = Date.now()
    // Insert comments with controlled timestamps so the 21st/newest versus
    // oldest distinction is deterministic. (Mutation-based creation stays under
    // the shared 30/min comment rate limit, but insertions make the ordering
    // unambiguous under the test clock.)
    await t.run(async (ctx) => {
      for (let index = 0; index < 21; index += 1) {
        await ctx.db.insert('reviewComments', {
          reviewId,
          authorId: memberId,
          body: `comment ${index}`,
          hidden: false,
          createdAt: now + index,
          updatedAt: now + index,
        })
      }
      await ctx.db.patch(reviewId, { commentCount: 21 })
    })
    const reviews = await t.query(api.reviews.forCompanion, { companionProfileId })
    expect(reviews[0].commentCount).toBe(21)
    expect(reviews[0].comments).toHaveLength(20)
    const bodies = reviews[0].comments.map((comment: any) => comment.body)
    // The oldest comment is omitted and the newest is present.
    expect(bodies[0]).toBe('comment 1')
    expect(bodies.at(-1)).toBe('comment 20')
    // The bounded set is chronological (ascending), exactly comments 1..20.
    const indices = bodies.map((body: string) => Number(body.replace('comment ', '')))
    expect(indices).toEqual(Array.from({ length: 20 }, (_, index) => index + 1))
  })
})

describe('review comment deletion', () => {
  it('lets the author soft delete a comment, decrement the review count, and audit the removal', async () => {
    const t = createTest()
    const { bookingId, companionProfileId } = await seedReviewableBooking(t)
    const reviewId = await t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, { bookingId, rating: 5, body: 'Kind and clear.' })
    const outsider = t.withIdentity({ subject: 'review-outsider' })
    const commentId = await outsider.mutation(api.reviews.createComment, { reviewId, body: 'Helpful review.' })
    expect((await t.run(async (ctx) => ctx.db.get(reviewId)))?.commentCount).toBe(1)

    let reviews = await outsider.query(api.reviews.forCompanion, { companionProfileId })
    expect(reviews[0].comments[0]).toMatchObject({ _id: commentId, ownComment: true })

    await outsider.mutation(api.reviews.deleteComment, { commentId })

    const state = await t.run(async (ctx) => ({
      comment: await ctx.db.get(commentId),
      review: await ctx.db.get(reviewId),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    expect(state.comment?.hidden).toBe(true)
    expect(state.review?.commentCount).toBe(0)
    expect(state.audits.filter((audit) => audit.action === 'review.comment.deleted')).toHaveLength(1)

    reviews = await outsider.query(api.reviews.forCompanion, { companionProfileId })
    expect(reviews[0]).toMatchObject({ commentCount: 0 })
    expect(reviews[0].comments).toHaveLength(0)
  })

  it('rejects deletion from anyone except the comment owner without writes', async () => {
    const t = createTest()
    const { bookingId } = await seedReviewableBooking(t)
    const reviewId = await t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, { bookingId, rating: 5 })
    const commentId = await t.withIdentity({ subject: 'review-outsider' }).mutation(api.reviews.createComment, { reviewId, body: 'Owner comment' })

    const before = await t.run(async (ctx) => ({
      comment: await ctx.db.get(commentId),
      review: await ctx.db.get(reviewId),
      audits: (await ctx.db.query('auditLogs').collect()).length,
    }))
    await expect(
      t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.deleteComment, { commentId }),
    ).rejects.toThrow('Only the author can delete this comment')
    const after = await t.run(async (ctx) => ({
      comment: await ctx.db.get(commentId),
      review: await ctx.db.get(reviewId),
      audits: (await ctx.db.query('auditLogs').collect()).length,
    }))
    expect(after).toEqual(before)
  })

  it('rejects deletion when the review is no longer visible', async () => {
    const t = createTest()
    const { bookingId } = await seedReviewableBooking(t)
    const reviewId = await t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, { bookingId, rating: 5 })
    const commentId = await t.withIdentity({ subject: 'review-outsider' }).mutation(api.reviews.createComment, { reviewId, body: 'Owner comment' })

    await t.run(async (ctx) => ctx.db.patch(reviewId, { hidden: true }))
    await expect(
      t.withIdentity({ subject: 'review-outsider' }).mutation(api.reviews.deleteComment, { commentId }),
    ).rejects.toThrow('Review not found')
    expect((await t.run(async (ctx) => ctx.db.get(commentId)))?.hidden).toBe(false)
  })
})
