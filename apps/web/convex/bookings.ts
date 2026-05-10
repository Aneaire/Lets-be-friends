import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { canChatForStatus, getViewer, requireViewer, writeAudit } from './lib'

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return []
    if (viewer.suspended) throw new Error('Account is suspended')
    const bookings = await ctx.db.query('bookings').withIndex('by_member', (q) => q.eq('memberId', viewer._id)).order('desc').collect()
    return await Promise.all(bookings.map(async (booking) => {
      const host = await ctx.db.get(booking.hostProfileId)
      return {
        ...booking,
        hostDisplayName: host?.displayName ?? 'Friend Host',
        hostCity: host?.city ?? 'Unknown location',
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
      return {
        ...booking,
        memberDisplayName: member?.displayName ?? 'Member',
        hostDisplayName: host.displayName,
        hostCity: host.city,
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
    const host = await ctx.db.get(args.hostProfileId)
    if (!host || host.status !== 'approved') throw new Error('Friend Host is not available for booking')
    const now = Date.now()
    const status = viewer.verificationStatus === 'approved' ? 'request_sent' : 'verification_required'
    const bookingId = await ctx.db.insert('bookings', { memberId: viewer._id, ...args, status, createdAt: now, updatedAt: now })
    if (status === 'verification_required') {
      const verificationRequestId = await ctx.db.insert('verificationRequests', {
        userId: viewer._id,
        reason: 'booking',
        personaInquiryId: `persona_dummy_booking_${bookingId}`,
        personaStatus: 'pending',
        adminStatus: 'pending',
        bookingId,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch(bookingId, { verificationRequestId, updatedAt: now })
      await writeAudit(ctx, { actorUserId: viewer._id, action: 'booking.verification_required', targetType: 'booking', targetId: String(bookingId), note: 'Draft saved with dummy Persona inquiry placeholder.' })
    } else {
      await writeAudit(ctx, { actorUserId: viewer._id, action: 'booking.request_sent', targetType: 'booking', targetId: String(bookingId) })
    }
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
    await ctx.db.patch(args.bookingId, { status: args.decision, hostDecisionNote: args.note, updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: `booking.${args.decision}`, targetType: 'booking', targetId: String(args.bookingId), note: args.note })
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
    if (booking.status !== 'accepted') throw new Error('Only accepted bookings can be completed')
    await ctx.db.patch(args.bookingId, { status: 'completed', updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'booking.completed', targetType: 'booking', targetId: String(args.bookingId) })
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
    if (!canChatForStatus(booking.status)) return []
    return await ctx.db.query('messages').withIndex('by_booking', (q) => q.eq('bookingId', args.bookingId)).collect()
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
    return await ctx.db.insert('messages', { bookingId: args.bookingId, senderId: viewer._id, body: args.body, reportable: true, createdAt: Date.now() })
  },
})
