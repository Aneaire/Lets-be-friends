import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

async function insertUser(t: ReturnType<typeof convexTest>, subject: string) {
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

async function seedReviewWorld(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const user = async (subject: string, role: 'member' | 'companion' = 'member') => {
      const id = await ctx.db.insert('users', {
        clerkUserId: subject,
        displayName: subject,
        role,
        verificationStatus: 'not_started',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      return id
    }
    const memberId = await user('notification-member')
    const companionUserId = await user('notification-companion', 'companion')
    const reviewerId = await user('notification-reviewer')
    const outsiderId = await user('notification-outsider')
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Notification Companion',
      intro: 'A Companion used to verify review notifications.',
      city: 'Test City',
      strengths: ['Good listener'],
      categories: ['Good company'],
      boundaries: ['Public places only'],
      mode: 'both',
      status: 'approved',
      rating: 5,
      reviewCount: 0,
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
      status: 'completed',
      createdAt: now - 172_800_000,
      updatedAt: now - 86_400_000,
    })
    const postId = await ctx.db.insert('posts', {
      authorId: reviewerId,
      body: 'A post that can receive comments and likes.',
      reportable: true,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    })
    const reviewId = await ctx.db.insert('reviews', {
      bookingId,
      reviewerId,
      revieweeId: memberId,
      companionProfileId,
      rating: 5,
      body: 'A thoughtful review used for notification coverage.',
      likeCount: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    return { memberId, reviewerId, outsiderId, postId, reviewId, companionProfileId }
  })
}

describe('comment and review notification producers', () => {
  it('notifies a comment author when their comment is liked and the parent commenter on a reply', async () => {
    const t = convexTest(schema, convexModules)
    const { memberId, reviewerId, outsiderId, postId } = await seedReviewWorld(t)
    const author = t.withIdentity({ subject: 'notification-reviewer' })
    const member = t.withIdentity({ subject: 'notification-member' })
    const outsider = t.withIdentity({ subject: 'notification-outsider' })
    const likedCommentId = await author.mutation(api.social.createComment, { postId, body: 'A comment that will be liked' })
    const parentCommentId = await member.mutation(api.social.createComment, { postId, body: 'A parent comment' })
    const replyId = await outsider.mutation(api.social.createComment, { postId, parentCommentId, body: 'A reply' })
    await outsider.mutation(api.social.toggleCommentLike, { commentId: likedCommentId })

    const notifications = await t.run(async (ctx) => (
      (await ctx.db.query('notifications').collect()).filter((row) => row.kind === 'comment_liked' || row.kind === 'comment_reply')
    ))
    expect(notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'comment_liked', recipientUserId: reviewerId, actorUserId: outsiderId, commentId: likedCommentId }),
      expect.objectContaining({ kind: 'comment_reply', recipientUserId: memberId, actorUserId: outsiderId, commentId: replyId }),
    ]))
  })

  it('notifies a review author on a review like and a review comment', async () => {
    const t = convexTest(schema, convexModules)
    const { reviewerId, outsiderId, reviewId, companionProfileId } = await seedReviewWorld(t)
    const outsider = t.withIdentity({ subject: 'notification-outsider' })
    await outsider.mutation(api.reviews.toggleLike, { reviewId })
    const commentId = await outsider.mutation(api.reviews.createComment, { reviewId, body: 'Helpful review.' })

    const notifications = await t.run(async (ctx) => (
      (await ctx.db.query('notifications').collect()).filter((row) => row.kind === 'review_liked' || row.kind === 'review_commented')
    ))
    expect(notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'review_liked', recipientUserId: reviewerId, actorUserId: outsiderId, reviewId }),
      expect.objectContaining({ kind: 'review_commented', recipientUserId: reviewerId, actorUserId: outsiderId, reviewId, reviewCommentId: commentId }),
    ]))

    const opened = await t.withIdentity({ subject: 'notification-reviewer' }).mutation(api.notifications.open, {
      notificationId: (notifications.find((row) => row.kind === 'review_commented')!._id),
    })
    expect(opened).toMatchObject({
      status: 'ready',
      destination: {
        type: 'review',
        reviewId: String(reviewId),
        companionProfileId: String(companionProfileId),
        commentId: String(commentId),
      },
    })
  })
})
