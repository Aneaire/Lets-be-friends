import { MEMBER_WALLET_PRICING_MODEL } from '@lets-be-friends/shared'
import { mutation, type MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
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
    if (reason.length > 2_000) throw new Error('Report reason must be 2000 characters or fewer')
    const now = Date.now()
    let bookingId: Id<'bookings'> | undefined
    let settlementHoldAppliedAt: number | undefined

    if (args.targetType === 'profile') {
      const profile = await safeGet(ctx, 'companionProfiles', args.targetId)
      if (!profile || profile.status !== 'approved') throw new Error('Profile not found')
      const owner = await ctx.db.get(profile.userId)
      if (!owner || owner.suspended) throw new Error('Profile not found')
      if (owner._id === viewer._id) throw new Error('You cannot report your own profile')
    } else if (args.targetType === 'booking') {
      const booking = await safeGet(ctx, 'bookings', args.targetId)
      if (!booking) throw new Error('Booking not found')
      const companion = await ctx.db.get(booking.companionProfileId)
      if (booking.memberId !== viewer._id && companion?.userId !== viewer._id) throw new Error('Only a booking participant can report this booking')
      bookingId = booking._id
      if (booking.pricingModel === MEMBER_WALLET_PRICING_MODEL && ['reserved', 'pending', 'blocked'].includes(booking.settlementState ?? '')) {
        settlementHoldAppliedAt = now
      }
    } else if (args.targetType === 'message') {
      const message = await safeGet(ctx, 'directMessages', args.targetId)
      if (!message || !message.reportable) throw new Error('Message not found')
      const conversation = await ctx.db.get(message.conversationId)
      const participant = conversation && (conversation.participantOneId === viewer._id || conversation.participantTwoId === viewer._id)
      if (!participant) throw new Error('Only a conversation participant can report this message')
      if (message.senderId === viewer._id) throw new Error('You cannot report your own message')
    } else if (args.targetType === 'review') {
      const review = await safeGet(ctx, 'reviews', args.targetId)
      if (!review || review.hidden === true) throw new Error('Review not found')
      if (review.reviewerId === viewer._id) throw new Error('You cannot report your own review')
    } else if (args.targetType === 'post') {
      const post = await safeGet(ctx, 'posts', args.targetId)
      if (!post || post.hidden || post.deletedAt || !post.reportable) throw new Error('Post not found')
      if (post.authorId === viewer._id) throw new Error('You cannot report your own post')
    } else if (args.targetType === 'comment') {
      const comment = await safeGet(ctx, 'postComments', args.targetId)
      if (!comment || comment.hidden || !comment.reportable) throw new Error('Comment not found')
      const post = await ctx.db.get(comment.postId)
      if (!post || post.hidden || post.deletedAt || !post.reportable) throw new Error('Comment not found')
      if (comment.authorId === viewer._id) throw new Error('You cannot report your own comment')
    } else {
      const user = await safeGet(ctx, 'users', args.targetId)
      if (!user || user.suspended) throw new Error('Member not found')
      if (user._id === viewer._id) throw new Error('You cannot report yourself')
    }

    if (bookingId && settlementHoldAppliedAt) {
      const booking = await ctx.db.get(bookingId)
      if (booking && booking.settlementState !== 'blocked') {
        await ctx.db.patch(booking._id, {
          settlementState: 'blocked',
          settlementBlockedAt: booking.settlementBlockedAt ?? now,
          updatedAt: now,
        })
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

async function safeGet<TableName extends 'companionProfiles' | 'bookings' | 'directMessages' | 'reviews' | 'posts' | 'postComments' | 'users'>(
  ctx: MutationCtx,
  table: TableName,
  id: string,
): Promise<Doc<TableName> | null> {
  try {
    return await ctx.db.get(table, id as Id<TableName>)
  } catch {
    return null
  }
}
