import { MEMBER_WALLET_PRICING_MODEL } from '@lets-be-friends/shared'
import { mutation } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { requireViewer, writeAudit } from './lib'

export const create = mutation({
  args: {
    targetType: v.union(v.literal('profile'), v.literal('booking'), v.literal('message'), v.literal('review'), v.literal('post'), v.literal('comment'), v.literal('user')),
    targetId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const reason = args.reason.trim()
    if (!reason) throw new Error('Report reason is required')
    const now = Date.now()
    let bookingId: Id<'bookings'> | undefined
    let settlementHoldAppliedAt: number | undefined

    if (args.targetType === 'booking') {
      let booking
      try {
        booking = await ctx.db.get(args.targetId as Id<'bookings'>)
      } catch {
        booking = null
      }
      if (!booking) throw new Error('Booking not found')
      const companion = await ctx.db.get(booking.companionProfileId)
      if (booking.memberId !== viewer._id && companion?.userId !== viewer._id) {
        throw new Error('Only a booking participant can report this booking')
      }
      bookingId = booking._id
      if (
        booking.pricingModel === MEMBER_WALLET_PRICING_MODEL
        && ['reserved', 'pending', 'blocked'].includes(booking.settlementState ?? '')
      ) {
        settlementHoldAppliedAt = now
        if (booking.settlementState !== 'blocked') {
          await ctx.db.patch(booking._id, {
            settlementState: 'blocked',
            settlementBlockedAt: booking.settlementBlockedAt ?? now,
            updatedAt: now,
          })
        }
      }
    }

    const reportId = await ctx.db.insert('reports', {
      reporterId: viewer._id,
      ...args,
      reason,
      bookingId,
      settlementHoldAppliedAt,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'report.created',
      targetType: args.targetType,
      targetId: args.targetId,
      note: reason,
      after: settlementHoldAppliedAt ? { bookingId: String(bookingId), settlementHeld: true } : undefined,
    })
    return reportId
  },
})
