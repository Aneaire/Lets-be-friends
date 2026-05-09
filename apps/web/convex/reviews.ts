import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireViewer, writeAudit } from './lib'

export const forHost = query({
  args: { hostProfileId: v.id('hostProfiles') },
  handler: async (ctx, args) => await ctx.db.query('reviews').withIndex('by_host_profile', (q) => q.eq('hostProfileId', args.hostProfileId)).order('desc').take(20),
})

export const submit = mutation({
  args: { bookingId: v.id('bookings'), rating: v.number(), body: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (args.rating < 1 || args.rating > 5) throw new Error('Rating must be between 1 and 5')
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new Error('Booking not found')
    if (booking.status !== 'completed' && booking.status !== 'review_window') throw new Error('Reviews require a completed booking')
    const host = await ctx.db.get(booking.hostProfileId)
    if (!host) throw new Error('Host profile not found')
    const isMember = booking.memberId === viewer._id
    const isHost = host.userId === viewer._id
    if (!isMember && !isHost) throw new Error('Not your booking')
    const revieweeId = isMember ? host.userId : booking.memberId
    const reviewId = await ctx.db.insert('reviews', { bookingId: args.bookingId, reviewerId: viewer._id, revieweeId, hostProfileId: isMember ? booking.hostProfileId : undefined, rating: args.rating, body: args.body, createdAt: Date.now() })
    if (isMember) {
      const nextCount = host.reviewCount + 1
      const nextRating = (host.rating * host.reviewCount + args.rating) / nextCount
      await ctx.db.patch(booking.hostProfileId, { rating: nextRating, reviewCount: nextCount, updatedAt: Date.now() })
    }
    await ctx.db.patch(args.bookingId, { status: 'review_window', updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'review.submitted', targetType: 'review', targetId: String(reviewId) })
    return reviewId
  },
})
