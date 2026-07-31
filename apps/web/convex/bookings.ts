import { canBookHost, canCancelBooking, canCompleteBooking, canReadBookingMessages } from '@lets-be-friends/shared'
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { canChatForStatus, getViewer, requireViewer, writeAudit } from './lib'
import { hasCurrentPersonaApproval } from './identityVerification'

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return []
    if (viewer.suspended) throw new Error('Account is suspended')
    const bookings = await ctx.db.query('bookings').withIndex('by_member', (q) => q.eq('memberId', viewer._id)).order('desc').collect()
    return await Promise.all(bookings.map(async (booking) => {
      const host = await ctx.db.get(booking.hostProfileId)
      const hostUser = host ? await ctx.db.get(host.userId) : null
      const reviews = await ctx.db.query('reviews').withIndex('by_booking', (q) => q.eq('bookingId', booking._id)).collect()
      return {
        ...booking,
        hostDisplayName: hostUser?.displayName ?? host?.displayName ?? 'Friend Host',
        hostCity: host?.city ?? 'Unknown location',
        viewerHasReviewed: reviews.some((review) => review.reviewerId === viewer._id),
        otherHasReviewed: reviews.some((review) => review.reviewerId === host?.userId),
      }
    }))
  },
})

export const forHost = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return []
    if (viewer.suspended) throw new Error('Account is suspended')
    const host = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    if (!host) return []
    const bookings = await ctx.db.query('bookings').withIndex('by_host', (q) => q.eq('hostProfileId', host._id)).order('desc').collect()
    return await Promise.all(bookings.map(async (booking) => {
      const member = await ctx.db.get(booking.memberId)
      const reviews = await ctx.db.query('reviews').withIndex('by_booking', (q) => q.eq('bookingId', booking._id)).collect()
      return {
        ...booking,
        memberDisplayName: member?.displayName ?? 'Member',
        hostDisplayName: viewer.displayName,
        hostCity: host.city,
        viewerHasReviewed: reviews.some((review) => review.reviewerId === viewer._id),
        otherHasReviewed: reviews.some((review) => review.reviewerId === booking.memberId),
      }
    }))
  },
})

export const createDraft = mutation({
  args: {
    hostProfileId: v.id('hostProfiles'),
    category: v.string(),
    mode: v.union(v.literal('online'), v.literal('in_person')),
    requestedAt: v.number(),
    durationMinutes: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (!hasCurrentPersonaApproval(viewer)) {
      throw new Error('A current Persona identity check and safety review are required before you can request a booking.')
    }
    const host = await ctx.db.get(args.hostProfileId)
    if (!host || host.status !== 'approved') throw new Error('Friend Host is not available for booking')
    const hostUser = await ctx.db.get(host.userId)
    if (!hostUser || hostUser.suspended || !hasCurrentPersonaApproval(hostUser)) {
      throw new Error('Friend Host is not currently available for new bookings')
    }
    if (!canBookHost(String(viewer._id), String(host.userId))) throw new Error('You cannot book your own Friend Host profile.')
    const now = Date.now()
    const bookingId = await ctx.db.insert('bookings', {
      memberId: viewer._id,
      ...args,
      status: 'request_sent',
      createdAt: now,
      updatedAt: now,
    })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'booking.request_sent', targetType: 'booking', targetId: String(bookingId) })
    return bookingId
  },
})

export const hostDecision = mutation({
  args: { bookingId: v.id('bookings'), decision: v.union(v.literal('accepted'), v.literal('declined')), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new Error('Booking not found')
    const host = await ctx.db.get(booking.hostProfileId)
    if (!host || host.userId !== viewer._id) throw new Error('Only the booked Friend Host can decide')
    if (booking.status !== 'request_sent') throw new Error('Booking is not awaiting host decision')
    if (args.decision === 'accepted') {
      if (host.status !== 'approved' || !hasCurrentPersonaApproval(viewer)) {
        throw new Error('A current Persona identity check and approved Friend Host profile are required before accepting new bookings')
      }
      const member = await ctx.db.get(booking.memberId)
      if (!member || member.suspended || !hasCurrentPersonaApproval(member)) {
        throw new Error('The member must renew identity approval before this booking can be accepted')
      }
    }
    await ctx.db.patch(args.bookingId, { status: args.decision, hostDecisionNote: args.note, updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: `booking.${args.decision}`, targetType: 'booking', targetId: String(args.bookingId), note: args.note })
  },
})

export const cancel = mutation({
  args: { bookingId: v.id('bookings'), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new Error('Booking not found')
    const host = await ctx.db.get(booking.hostProfileId)
    if (booking.memberId !== viewer._id && host?.userId !== viewer._id) throw new Error('Not your booking')
    if (!canCancelBooking(booking.status)) throw new Error('This booking can no longer be cancelled')
    const now = Date.now()
    const reason = args.reason?.trim() || undefined
    await ctx.db.patch(args.bookingId, {
      status: 'cancelled',
      cancelledByUserId: viewer._id,
      cancelledAt: now,
      cancellationReason: reason,
      updatedAt: now,
    })
    if (booking.status === 'verification_required' && booking.verificationRequestId) {
      const verification = await ctx.db.get(booking.verificationRequestId)
      if (verification?.adminStatus === 'pending') {
        await ctx.db.patch(booking.verificationRequestId, {
          adminStatus: 'rejected',
          reviewerNote: 'Booking was cancelled before verification completed.',
          updatedAt: now,
        })
      }
    }
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'booking.cancelled', targetType: 'booking', targetId: String(args.bookingId), note: reason })
  },
})

export const markCompleted = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new Error('Booking not found')
    const host = await ctx.db.get(booking.hostProfileId)
    if (booking.memberId !== viewer._id && host?.userId !== viewer._id) throw new Error('Not your booking')
    if (!canCompleteBooking(booking.status)) throw new Error('Only accepted bookings can be completed')
    await ctx.db.patch(args.bookingId, { status: 'review_window', updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'booking.review_window_opened', targetType: 'booking', targetId: String(args.bookingId) })
  },
})

export const messages = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new Error('Booking not found')
    const host = await ctx.db.get(booking.hostProfileId)
    if (booking.memberId !== viewer._id && host?.userId !== viewer._id) throw new Error('Not your booking')
    if (!canReadBookingMessages(booking.status)) return []
    const messages = await ctx.db.query('messages').withIndex('by_booking', (q) => q.eq('bookingId', args.bookingId)).collect()
    return await Promise.all(messages.map(async (message) => {
      const sender = await ctx.db.get(message.senderId)
      return {
        ...message,
        senderDisplayName: sender?.displayName ?? 'Member',
        sentByViewer: message.senderId === viewer._id,
      }
    }))
  },
})

export const sendMessage = mutation({
  args: { bookingId: v.id('bookings'), body: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new Error('Booking not found')
    const host = await ctx.db.get(booking.hostProfileId)
    if (booking.memberId !== viewer._id && host?.userId !== viewer._id) throw new Error('Not your booking')
    if (!canChatForStatus(booking.status)) throw new Error('Chat unlocks after verification/admin review sends the booking request')
    if (booking.status === 'request_sent') {
      const member = await ctx.db.get(booking.memberId)
      const hostUser = host ? await ctx.db.get(host.userId) : null
      if (
        !member
        || member.suspended
        || !hasCurrentPersonaApproval(member)
        || !hostUser
        || hostUser.suspended
        || !hasCurrentPersonaApproval(hostUser)
      ) {
        throw new Error('Both participants need current identity approval before pre-acceptance messaging can continue')
      }
    }
    const body = args.body.trim()
    if (!body) throw new Error('Message cannot be empty')
    return await ctx.db.insert('messages', { bookingId: args.bookingId, senderId: viewer._id, body, reportable: true, createdAt: Date.now() })
  },
})
