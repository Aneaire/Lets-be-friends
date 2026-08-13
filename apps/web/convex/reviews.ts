import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { bookingStatusAfterReview, canReviewBooking, isModerationVisible } from '@lets-be-friends/shared'
import { requireViewer, writeAudit } from './lib'
import { createNotification } from './notifications'

export const forCompanion = query({
  args: { companionProfileId: v.id('companionProfiles') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx).catch(() => null)
    const reviews = await ctx.db.query('reviews').withIndex('by_companion_profile', (q) => q.eq('companionProfileId', args.companionProfileId)).order('desc').take(20)
    return await Promise.all(reviews.filter(isModerationVisible).map(async (review) => {
      const reviewer = await ctx.db.get(review.reviewerId)
      return {
        ...review,
        reviewerDisplayName: reviewer?.displayName ?? 'Member',
        saved: viewer ? Boolean(await ctx.db.query('savedReviews').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('reviewId', review._id)).first()) : false,
      }
    }))
  },
})

export const toggleSave = mutation({
  args: { reviewId: v.id('reviews') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const review = await ctx.db.get(args.reviewId)
    if (!review || !isModerationVisible(review)) throw new Error('Review not found')
    const existing = await ctx.db.query('savedReviews').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('reviewId', args.reviewId)).first()
    if (existing) {
      await ctx.db.delete(existing._id)
      await writeAudit(ctx, { actorUserId: viewer._id, action: 'review.unsaved', targetType: 'review', targetId: String(args.reviewId) })
      return false
    }
    await ctx.db.insert('savedReviews', { userId: viewer._id, reviewId: args.reviewId, createdAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'review.saved', targetType: 'review', targetId: String(args.reviewId) })
    return true
  },
})

export const submit = mutation({
  args: { bookingId: v.id('bookings'), rating: v.number(), body: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (args.rating < 1 || args.rating > 5) throw new Error('Rating must be between 1 and 5')
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new Error('Booking not found')
    if (!canReviewBooking(booking.status)) throw new Error('Reviews require a completed booking')
    const companion = await ctx.db.get(booking.companionProfileId)
    if (!companion) throw new Error('Companion profile not found')
    const isMember = booking.memberId === viewer._id
    const isCompanion = companion.userId === viewer._id
    if (!isMember && !isCompanion) throw new Error('Not your booking')
    const existing = await ctx.db.query('reviews').withIndex('by_booking_reviewer', (q) => q.eq('bookingId', args.bookingId).eq('reviewerId', viewer._id)).first()
    if (existing) throw new Error('You have already reviewed this booking')
    const otherParticipantId = isMember ? companion.userId : booking.memberId
    const otherReview = await ctx.db.query('reviews').withIndex('by_booking_reviewer', (q) => q.eq('bookingId', args.bookingId).eq('reviewerId', otherParticipantId)).first()
    const body = args.body?.trim() || undefined
    const now = Date.now()
    const reviewId = await ctx.db.insert('reviews', { bookingId: args.bookingId, reviewerId: viewer._id, revieweeId: otherParticipantId, companionProfileId: isMember ? booking.companionProfileId : undefined, rating: args.rating, body, createdAt: now })
    if (isMember) {
      const nextCount = companion.reviewCount + 1
      const nextRating = (companion.rating * companion.reviewCount + args.rating) / nextCount
      await ctx.db.patch(booking.companionProfileId, { rating: nextRating, reviewCount: nextCount, updatedAt: now })
    }
    await ctx.db.patch(args.bookingId, { status: bookingStatusAfterReview(Boolean(otherReview)), updatedAt: now })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'review.submitted', targetType: 'review', targetId: String(reviewId) })
    await createNotification(ctx, {
      recipientUserId: otherParticipantId,
      actorUserId: viewer._id,
      kind: 'review_received',
      priority: 'standard',
      bookingId: args.bookingId,
      reviewId,
      dedupeKey: `review:${reviewId}:received`,
    })
    return reviewId
  },
})
