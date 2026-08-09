import {
  BOOKING_CURRENCY,
  MEMBER_WALLET_PRICING_MODEL,
  calculateMemberWalletBookingPrice,
  canBookHost,
  canCancelBooking,
  canCompleteBooking,
  canReadBookingMessages,
  nextSaturdayManilaCutoff,
  validateBookingDurationMinutes,
  validateHostHourlyRateCentavos,
} from '@lets-be-friends/shared'
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { canChatForStatus, getViewer, requireViewer, writeAudit } from './lib'
import { ensureConversationBetween, sendBookingMessage } from './conversations'
import { hasCurrentIdentityApproval } from './identityVerification'
import {
  allocateCompletedBookingFunds,
  availableMemberBookingBalance,
  hasActiveBookingReport,
  memberWalletV2Enabled,
  pastDueCommissionCentavos,
  releaseBookingFunds,
  reserveBookingFunds,
} from './finance'

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
        hostUserId: host?.userId,
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
    if (!hasCurrentIdentityApproval(viewer)) {
      throw new Error('A current identity check and safety review are required before you can request a booking.')
    }
    const host = await ctx.db.get(args.hostProfileId)
    if (!host || host.status !== 'approved') throw new Error('Friend Host is not available for booking')
    const hostUser = await ctx.db.get(host.userId)
    if (!hostUser || hostUser.suspended || !hasCurrentIdentityApproval(hostUser)) {
      throw new Error('Friend Host is not currently available for new bookings')
    }
    if (!canBookHost(String(viewer._id), String(host.userId))) throw new Error('You cannot book your own Friend Host profile.')
    if (!host.categories.includes(args.category)) throw new Error('This experience category is not offered by the Friend Host')
    if (host.mode !== 'both' && host.mode !== args.mode) throw new Error('This booking mode is not offered by the Friend Host')
    if (!Number.isFinite(args.requestedAt) || args.requestedAt <= Date.now()) throw new Error('Booking time must be in the future')
    const durationMinutes = validateBookingDurationMinutes(args.durationMinutes)
    const hourlyRateCentavos = validateHostHourlyRateCentavos(host.hourlyRateCentavos ?? Number.NaN)
    if (!memberWalletV2Enabled()) throw new Error('Member-wallet bookings are not enabled')
    const price = calculateMemberWalletBookingPrice(hourlyRateCentavos, durationMinutes)
    const availableCentavos = await availableMemberBookingBalance(ctx, viewer._id)
    if (availableCentavos < price.memberTotalCentavos) {
      throw new Error(`Insufficient booking balance. Add at least ${price.memberTotalCentavos - availableCentavos} more centavos before sending.`)
    }

    const now = Date.now()
    const bookingId = await ctx.db.insert('bookings', {
      memberId: viewer._id,
      ...args,
      durationMinutes,
      pricingModel: price.pricingModel,
      serviceSubtotalCentavos: price.serviceSubtotalCentavos,
      memberBookingFeeBps: price.memberBookingFeeBps,
      memberBookingFeeCentavos: price.memberBookingFeeCentavos,
      memberTotalCentavos: price.memberTotalCentavos,
      hostEntitlementCentavos: price.hostEntitlementCentavos,
      currency: price.currency,
      settlementState: 'unreserved',
      status: 'request_sent',
      createdAt: now,
      updatedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'booking.request_sent',
      targetType: 'booking',
      targetId: String(bookingId),
      after: price,
    })
    const conversationId = await ensureConversationBetween(ctx, viewer._id, host.userId)
    await sendBookingMessage(ctx, {
      conversationId,
      senderUserId: viewer._id,
      bookingId,
      body: bookingRequestMessage(viewer.displayName, args.category, args.mode, args.requestedAt, durationMinutes),
    })
    return { bookingId, ...price }
  },
})

export const editRequest = mutation({
  args: {
    bookingId: v.id('bookings'),
    category: v.string(),
    mode: v.union(v.literal('online'), v.literal('in_person')),
    requestedAt: v.number(),
    durationMinutes: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new Error('Booking not found')
    if (booking.memberId !== viewer._id) throw new Error('Only the member who requested the booking can edit it')
    if (booking.status !== 'request_sent') throw new Error('A request can only be edited while it is still awaiting the Friend Host decision')
    const host = await ctx.db.get(booking.hostProfileId)
    if (!host || host.status !== 'approved') throw new Error('Friend Host is not available for booking')
    if (!host.categories.includes(args.category)) throw new Error('This experience category is not offered by the Friend Host')
    if (host.mode !== 'both' && host.mode !== args.mode) throw new Error('This booking mode is not offered by the Friend Host')
    if (!Number.isFinite(args.requestedAt) || args.requestedAt <= Date.now()) throw new Error('Booking time must be in the future')
    const durationMinutes = validateBookingDurationMinutes(args.durationMinutes)
    const hourlyRateCentavos = validateHostHourlyRateCentavos(host.hourlyRateCentavos ?? Number.NaN)
    if (!memberWalletV2Enabled()) throw new Error('Member-wallet bookings are not enabled')
    const price = calculateMemberWalletBookingPrice(hourlyRateCentavos, durationMinutes)
    const availableCentavos = await availableMemberBookingBalance(ctx, viewer._id)
    if (availableCentavos < price.memberTotalCentavos) {
      throw new Error(`Insufficient booking balance. Add at least ${price.memberTotalCentavos - availableCentavos} more centavos before updating.`)
    }

    const now = Date.now()
    const notes = args.notes?.trim() || undefined
    await ctx.db.patch(args.bookingId, {
      category: args.category,
      mode: args.mode,
      requestedAt: args.requestedAt,
      durationMinutes,
      notes,
      pricingModel: price.pricingModel,
      serviceSubtotalCentavos: price.serviceSubtotalCentavos,
      memberBookingFeeBps: price.memberBookingFeeBps,
      memberBookingFeeCentavos: price.memberBookingFeeCentavos,
      memberTotalCentavos: price.memberTotalCentavos,
      hostEntitlementCentavos: price.hostEntitlementCentavos,
      currency: price.currency,
      updatedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'booking.request_updated',
      targetType: 'booking',
      targetId: String(args.bookingId),
      after: price,
    })
    const conversationId = await ensureConversationBetween(ctx, viewer._id, host.userId)
    await sendBookingMessage(ctx, {
      conversationId,
      senderUserId: viewer._id,
      bookingId: args.bookingId,
      body: bookingUpdatedMessage(viewer.displayName, args.category, args.mode, args.requestedAt, durationMinutes),
    })
    return { bookingId: args.bookingId, ...price }
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
    if (booking.status === args.decision) return { status: booking.status, idempotent: true }
    if (booking.status !== 'request_sent') throw new Error('Booking is not awaiting host decision')
    let v2SettlementState = booking.settlementState
    let v2SettlementBlockedAt = booking.settlementBlockedAt
    if (args.decision === 'accepted') {
      if (host.status !== 'approved' || !hasCurrentIdentityApproval(viewer)) {
        throw new Error('A current identity check and approved Friend Host profile are required before accepting new bookings')
      }
      const member = await ctx.db.get(booking.memberId)
      if (!member || member.suspended || !hasCurrentIdentityApproval(member)) {
        throw new Error('The member must renew identity approval before this booking can be accepted')
      }
      if (booking.pricingModel === MEMBER_WALLET_PRICING_MODEL) {
        await reserveBookingFunds(ctx, booking)
        const blocked = await hasActiveBookingReport(ctx, booking._id)
        v2SettlementState = blocked ? 'blocked' : 'reserved'
        v2SettlementBlockedAt = blocked ? (booking.settlementBlockedAt ?? Date.now()) : booking.settlementBlockedAt
      } else if (await pastDueCommissionCentavos(ctx, viewer._id) > 0) {
        throw new Error('Past-due platform commission must be settled before accepting a new booking')
      }
    }
    const now = Date.now()
    await ctx.db.patch(args.bookingId, {
      status: args.decision,
      hostDecisionNote: args.note,
      settlementState:
        booking.pricingModel === MEMBER_WALLET_PRICING_MODEL && args.decision === 'accepted'
          ? v2SettlementState
          : booking.settlementState,
      settlementBlockedAt:
        booking.pricingModel === MEMBER_WALLET_PRICING_MODEL && args.decision === 'accepted'
          ? v2SettlementBlockedAt
          : booking.settlementBlockedAt,
      updatedAt: now,
    })
    await writeAudit(ctx, { actorUserId: viewer._id, action: `booking.${args.decision}`, targetType: 'booking', targetId: String(args.bookingId), note: args.note })
    const conversationId = await ensureConversationBetween(ctx, viewer._id, booking.memberId)
    await sendBookingMessage(ctx, {
      conversationId,
      senderUserId: viewer._id,
      bookingId: args.bookingId,
      body: bookingDecisionMessage(viewer.displayName, args.decision),
    })
    return { status: args.decision, idempotent: false }
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
    if (booking.status === 'cancelled') return { status: 'cancelled' as const, idempotent: true }
    if (
      booking.pricingModel === MEMBER_WALLET_PRICING_MODEL
      && (booking.memberCompletedAt || booking.hostCompletedAt)
    ) {
      throw new Error('A completion confirmation has already been recorded. Use the report/dispute flow instead of cancelling.')
    }
    if (!canCancelBooking(booking.status)) throw new Error('This booking can no longer be cancelled')
    if (booking.pricingModel === MEMBER_WALLET_PRICING_MODEL && booking.status === 'accepted') {
      if (booking.settlementState === 'blocked' || await hasActiveBookingReport(ctx, booking._id)) {
        throw new Error('This booking has an active safety hold. A full admin must resolve the reserved funds.')
      }
      await releaseBookingFunds(ctx, booking, viewer._id)
    }
    const now = Date.now()
    const reason = args.reason?.trim() || undefined
    await ctx.db.patch(args.bookingId, {
      status: 'cancelled',
      settlementState: booking.pricingModel === MEMBER_WALLET_PRICING_MODEL && booking.status === 'accepted' ? 'refunded' : booking.settlementState,
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
    const otherUserId = booking.memberId === viewer._id ? host?.userId : booking.memberId
    if (otherUserId) {
      const cancellationConversationId = await ensureConversationBetween(ctx, viewer._id, otherUserId)
      await sendBookingMessage(ctx, {
        conversationId: cancellationConversationId,
        senderUserId: viewer._id,
        bookingId: args.bookingId,
        body: bookingCancelledMessage(viewer.displayName, viewer._id === booking.memberId, booking.category, reason),
      })
    }
    return { status: 'cancelled' as const, idempotent: false }
  },
})

export const markCompleted = mutation({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new Error('Booking not found')
    if (booking.pricingModel === MEMBER_WALLET_PRICING_MODEL && booking.settlementState === 'refunded') {
      throw new Error('Refunded bookings cannot be completed')
    }
    const host = await ctx.db.get(booking.hostProfileId)
    if (!host) throw new Error('Friend Host profile not found')
    const isMember = booking.memberId === viewer._id
    const isHost = host.userId === viewer._id
    if (!isMember && !isHost) throw new Error('Not your booking')
    if (booking.status !== 'accepted') {
      if (
        booking.pricingModel === MEMBER_WALLET_PRICING_MODEL
        && ['review_window', 'completed', 'closed'].includes(booking.status)
        && (isMember ? booking.memberCompletedAt : booking.hostCompletedAt)
      ) {
        return { status: booking.status, awaitingOtherConfirmation: false, idempotent: true }
      }
      throw new Error('Only accepted bookings can be completed')
    }
    if (!canCompleteBooking(booking.status)) throw new Error('Only accepted bookings can be completed')

    if (booking.pricingModel === MEMBER_WALLET_PRICING_MODEL) {
      const role = isHost ? 'host_start' : 'member_end'
      const decision = await ctx.db.query('bookingEvidenceDecisions')
        .withIndex('by_booking_role', (q) => q.eq('bookingId', booking._id).eq('role', role))
        .unique()
      if (!decision || decision.userId !== viewer._id) {
        throw new Error(isHost
          ? 'Choose start evidence or explicitly skip it before confirming completion.'
          : 'Choose end evidence or explicitly skip it before confirming completion.')
      }
    }

    const now = Date.now()
    const memberCompletedAt = isMember ? (booking.memberCompletedAt ?? now) : booking.memberCompletedAt
    const hostCompletedAt = isHost ? (booking.hostCompletedAt ?? now) : booking.hostCompletedAt
    if (!memberCompletedAt || !hostCompletedAt) {
      await ctx.db.patch(args.bookingId, { memberCompletedAt, hostCompletedAt, updatedAt: now })
      await writeAudit(ctx, {
        actorUserId: viewer._id,
        action: isMember ? 'booking.member_completion_confirmed' : 'booking.host_completion_confirmed',
        targetType: 'booking',
        targetId: String(args.bookingId),
      })
      return { status: 'accepted' as const, awaitingOtherConfirmation: true, idempotent: false }
    }

    if (booking.pricingModel === MEMBER_WALLET_PRICING_MODEL) {
      const allocation = await allocateCompletedBookingFunds(ctx, booking, host.userId, now)
      const blocked = await hasActiveBookingReport(ctx, booking._id)
      await ctx.db.patch(args.bookingId, {
        status: 'review_window',
        memberCompletedAt,
        hostCompletedAt,
        jointlyCompletedAt: booking.jointlyCompletedAt ?? now,
        settlementEligibleAt: booking.settlementEligibleAt ?? allocation.settlementEligibleAt,
        settlementState: blocked ? 'blocked' : 'pending',
        settlementBlockedAt: blocked ? (booking.settlementBlockedAt ?? now) : booking.settlementBlockedAt,
        updatedAt: now,
      })
      await writeAudit(ctx, {
        actorUserId: viewer._id,
        action: 'booking.review_window_opened',
        targetType: 'booking',
        targetId: String(args.bookingId),
        after: { settlementEligibleAt: allocation.settlementEligibleAt, settlementBlocked: blocked },
      })
      return { status: 'review_window' as const, awaitingOtherConfirmation: false, idempotent: !allocation.applied }
    }

    let obligationId = booking.commissionObligationId
    let commissionDueAt = booking.commissionDueAt
    if (
      booking.grossPriceCentavos !== undefined
      && booking.currency === BOOKING_CURRENCY
      && booking.commissionBps !== undefined
      && booking.commissionCentavos !== undefined
    ) {
      const existing = await ctx.db.query('commissionObligations').withIndex('by_booking', (q) => q.eq('bookingId', booking._id)).unique()
      if (existing) {
        obligationId = existing._id
        commissionDueAt = existing.dueAt
      } else {
        const dueAt = nextSaturdayManilaCutoff(now)
        obligationId = await ctx.db.insert('commissionObligations', {
          bookingId: booking._id,
          hostUserId: host.userId,
          hostProfileId: host._id,
          amountCentavos: booking.commissionCentavos,
          currency: BOOKING_CURRENCY,
          commissionBps: booking.commissionBps,
          dueAt,
          accruedAt: now,
        })
        commissionDueAt = dueAt
      }
    }

    await ctx.db.patch(args.bookingId, {
      status: 'review_window',
      memberCompletedAt,
      hostCompletedAt,
      jointlyCompletedAt: now,
      commissionDueAt: obligationId ? commissionDueAt : undefined,
      commissionObligationId: obligationId,
      commissionExemptReason: obligationId ? undefined : 'legacy_unpriced',
      updatedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'booking.review_window_opened',
      targetType: 'booking',
      targetId: String(args.bookingId),
      after: { obligationId: obligationId ? String(obligationId) : undefined },
    })
    return { status: 'review_window' as const, awaitingOtherConfirmation: false, idempotent: false }
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
        || !hasCurrentIdentityApproval(member)
        || !hostUser
        || hostUser.suspended
        || !hasCurrentIdentityApproval(hostUser)
      ) {
        throw new Error('Both participants need current identity approval before pre-acceptance messaging can continue')
      }
    }
    const body = args.body.trim()
    if (!body) throw new Error('Message cannot be empty')
    return await ctx.db.insert('messages', { bookingId: args.bookingId, senderId: viewer._id, body, reportable: true, createdAt: Date.now() })
  },
})

function bookingRequestMessage(memberName: string, category: string, mode: 'online' | 'in_person', requestedAt: number, durationMinutes: number) {
  return `${memberName} sent you a booking request for ${category} (${formatModeLabel(mode)}) on ${formatBookingDate(requestedAt)} for ${formatDurationLabel(durationMinutes)}. You can accept, decline, or talk it over here first.`
}

function bookingUpdatedMessage(memberName: string, category: string, mode: 'online' | 'in_person', requestedAt: number, durationMinutes: number) {
  return `${memberName} updated this request: ${category} on ${formatBookingDate(requestedAt)} (${formatModeLabel(mode)}, ${formatDurationLabel(durationMinutes)}). Please take another look before deciding.`
}

function bookingDecisionMessage(hostName: string, decision: 'accepted' | 'declined') {
  if (decision === 'accepted') return `${hostName} accepted this booking request.`
  return `${hostName} declined this booking request.`
}

function bookingCancelledMessage(name: string, isMember: boolean, category: string, reason?: string) {
  const who = isMember ? 'The member' : 'The Friend Host'
  const reasonSuffix = reason ? ` Reason: ${reason}.` : ''
  return `${who} (${name}) cancelled this ${category} request.${reasonSuffix}`
}

function formatModeLabel(mode: 'online' | 'in_person') {
  return mode === 'in_person' ? 'in person' : 'online'
}

function formatDurationLabel(minutes: number) {
  const hours = minutes / 60
  if (minutes % 60 === 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${minutes} minutes`
}

function formatBookingDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(timestamp)
}
