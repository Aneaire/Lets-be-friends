import {
  BOOKING_CURRENCY,
  MANILA_TIMEZONE,
  MEMBER_WALLET_PRICING_MODEL,
  calculateMemberWalletBookingPrice,
  canBookCompanion,
  canCancelBooking,
  canCompleteBooking,
  canReadBookingMessages,
  formatPhp,
  hasConfiguredCompanionHourlyRate,
  nextSaturdayManilaCutoff,
  parseAvailabilityMonth,
  validateBookingDurationMinutes,
  validateCompanionHourlyRateCentavos,
} from '@lets-be-friends/shared'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { ConvexError, v } from 'convex/values'
import { canChatForStatus, getViewer, requireViewer, writeAudit } from './lib'
import { ensureConversationBetween, sendBookingMessage } from './conversations'
import { hasCurrentIdentityApproval } from './identityVerification'
import { createNotification } from './notifications'
import { areUsersBlocked, requireNotBlocked } from './safety'
import { consumeRateLimit } from './rateLimit'
import {
  assertNoAcceptedBookingConflict,
  assertScheduleAllowsRequest,
  buildCompanionAvailabilityMonth,
} from './availability'
import {
  allocateCompletedBookingFunds,
  availableMemberBookingBalance,
  hasActiveBookingReport,
  memberWalletV2Enabled,
  pastDueCommissionCentavos,
  releaseBookingFunds,
  reserveBookingFunds,
  settleBookingFunds,
} from './finance'

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return []
    if (viewer.suspended) throw new ConvexError('Account is suspended')
    const bookings = await ctx.db.query('bookings').withIndex('by_member', (q) => q.eq('memberId', viewer._id)).order('desc').collect()
    return await Promise.all(bookings.map(async (booking) => {
      const companion = await ctx.db.get(booking.companionProfileId)
      const companionUser = companion ? await ctx.db.get(companion.userId) : null
      const reviews = await ctx.db.query('reviews').withIndex('by_booking', (q) => q.eq('bookingId', booking._id)).collect()
      return {
        ...booking,
        companionUserId: companion?.userId,
        companionDisplayName: companionUser?.displayName ?? companion?.displayName ?? 'Companion',
        companionCity: companion?.city ?? 'Unknown location',
        viewerHasReviewed: reviews.some((review) => review.reviewerId === viewer._id),
        otherHasReviewed: reviews.some((review) => review.reviewerId === companion?.userId),
      }
    }))
  },
})

export const forCompanion = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return []
    if (viewer.suspended) throw new ConvexError('Account is suspended')
    const companions = await ctx.db.query('companionProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).collect()
    if (companions.length === 0) return []
    const companionsById = new Map(companions.map((companion) => [companion._id, companion]))
    const bookingsByProfile = await Promise.all(companions.map((companion) =>
      ctx.db.query('bookings').withIndex('by_companion', (q) => q.eq('companionProfileId', companion._id)).collect(),
    ))
    const seenBookingIds = new Set<string>()
    const bookings = bookingsByProfile
      .flat()
      .filter((booking) => {
        const id = String(booking._id)
        if (seenBookingIds.has(id)) return false
        seenBookingIds.add(id)
        return true
      })
      .sort((left, right) => right.createdAt - left.createdAt)
    return await Promise.all(bookings.map(async (booking) => {
      const member = await ctx.db.get(booking.memberId)
      const companion = companionsById.get(booking.companionProfileId)
      const reviews = await ctx.db.query('reviews').withIndex('by_booking', (q) => q.eq('bookingId', booking._id)).collect()
      return {
        ...booking,
        memberDisplayName: member?.displayName ?? 'Member',
        companionDisplayName: viewer.displayName,
        companionCity: companion?.city ?? 'Unknown location',
        viewerHasReviewed: reviews.some((review) => review.reviewerId === viewer._id),
        otherHasReviewed: reviews.some((review) => review.reviewerId === booking.memberId),
      }
    }))
  },
})

const EMPTY_AVAILABILITY = {
  timezone: MANILA_TIMEZONE,
  scheduleConfigured: false,
  days: [] as Array<{ date: string; startsAt: number[] }>,
}

export const availableSlots = query({
  // Returns the Companion's bookable starts for every date in a Manila calendar
  // month. Ineligible viewers always receive the same empty, loading-independent
  // shape, and no busy interval, booking, or member metadata is ever returned.
  args: {
    companionProfileId: v.id('companionProfiles'),
    month: v.string(),
    durationMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const month = parseAvailabilityMonth(args.month)
    if (!month) throw new ConvexError('Choose a month between 2000-01 and 2100-12')
    const durationMinutes = validateBookingDurationMinutes(args.durationMinutes)
    const viewer = await getViewer(ctx)
    const companion = await ctx.db.get(args.companionProfileId)
    if (!companion) return EMPTY_AVAILABILITY
    if (!await canReadCompanionAvailability(ctx, viewer, companion)) return EMPTY_AVAILABILITY
    const { scheduleConfigured, days } = await buildCompanionAvailabilityMonth(
      ctx,
      companion,
      month.year,
      month.month,
      durationMinutes,
      Date.now(),
    )
    return { timezone: MANILA_TIMEZONE, scheduleConfigured, days }
  },
})

async function canReadCompanionAvailability(
  ctx: { db: any },
  viewer: Doc<'users'> | null,
  companion: Doc<'companionProfiles'>,
) {
  if (!viewer || viewer.suspended) return false
  if (!hasCurrentIdentityApproval(viewer)) return false
  if (companion.status !== 'approved') return false
  // Availability is only readable when the Companion can actually be booked, so
  // a missing or out-of-range listed rate fails the same generic empty shape.
  if (!hasConfiguredCompanionHourlyRate(companion.hourlyRateCentavos)) return false
  if (companion.userId === viewer._id) return false
  const owner = await ctx.db.get(companion.userId)
  if (!owner || owner.suspended || !hasCurrentIdentityApproval(owner)) return false
  if (await areUsersBlocked(ctx, viewer._id, companion.userId)) return false
  return true
}

export const createDraft = mutation({
  args: {
    companionProfileId: v.id('companionProfiles'),
    category: v.string(),
    mode: v.union(v.literal('online'), v.literal('in_person')),
    requestedAt: v.number(),
    durationMinutes: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    await consumeRateLimit(ctx, viewer._id, 'create_booking')
    if (!hasCurrentIdentityApproval(viewer)) {
      throw new ConvexError('A current identity check and safety review are required before you can request a booking.')
    }
    const companion = await ctx.db.get(args.companionProfileId)
    if (!companion || companion.status !== 'approved') throw new ConvexError('Companion is not available for booking')
    const companionUser = await ctx.db.get(companion.userId)
    if (!companionUser || companionUser.suspended) {
      throw new ConvexError('Companion is not currently available for new bookings')
    }
    if (!hasCurrentIdentityApproval(companionUser)) {
      throw new ConvexError('This Companion is not verified yet, so they cannot take new bookings')
    }
    if (!canBookCompanion(String(viewer._id), String(companion.userId))) throw new ConvexError('You cannot book your own Companion profile.')
    await requireNotBlocked(ctx, viewer._id, companion.userId)
    if (!companion.categories.includes(args.category)) throw new ConvexError('This experience category is not offered by the Companion')
    if (companion.mode !== 'both' && companion.mode !== args.mode) throw new ConvexError('This booking mode is not offered by the Companion')
    if (!Number.isFinite(args.requestedAt) || args.requestedAt <= Date.now()) throw new ConvexError('Booking time must be in the future')
    const durationMinutes = validateBookingDurationMinutes(args.durationMinutes)
    assertScheduleAllowsRequest(companion, args.requestedAt, durationMinutes)
    await assertNoAcceptedBookingConflict(ctx, companion.userId, args.requestedAt, durationMinutes)
    const hourlyRateCentavos = validateCompanionHourlyRateCentavos(companion.hourlyRateCentavos ?? Number.NaN)
    if (!memberWalletV2Enabled()) throw new ConvexError('Member-wallet bookings are not enabled')
    const price = calculateMemberWalletBookingPrice(hourlyRateCentavos, durationMinutes)
    const availableCentavos = await availableMemberBookingBalance(ctx, viewer._id)
    if (availableCentavos < price.memberTotalCentavos) {
      throw new ConvexError(`Insufficient booking balance. Add at least ${formatPhp(price.memberTotalCentavos - availableCentavos)} to your wallet before sending.`)
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
      companionEarningsCentavos: price.companionEarningsCentavos,
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
    const conversationId = await ensureConversationBetween(ctx, viewer._id, companion.userId)
    await sendBookingMessage(ctx, {
      conversationId,
      senderUserId: viewer._id,
      bookingId,
      body: bookingRequestMessage(viewer.displayName, args.category, args.mode, args.requestedAt, durationMinutes),
    })
    await createNotification(ctx, {
      recipientUserId: companion.userId,
      actorUserId: viewer._id,
      kind: 'booking_request',
      priority: 'attention',
      bookingId,
      conversationId,
      dedupeKey: `booking:${bookingId}:request`,
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
    if (!booking) throw new ConvexError('Booking not found')
    if (booking.memberId !== viewer._id) throw new ConvexError('Only the member who requested the booking can edit it')
    if (booking.status !== 'request_sent') throw new ConvexError('A request can only be edited while it is still awaiting the Companion decision')
    if (!hasCurrentIdentityApproval(viewer)) {
      throw new ConvexError('A current identity check and safety review are required before you can update a booking request.')
    }
    const companion = await ctx.db.get(booking.companionProfileId)
    if (!companion || companion.status !== 'approved') throw new ConvexError('Companion is not available for booking')
    const companionUser = await ctx.db.get(companion.userId)
    if (!companionUser || companionUser.suspended || !hasCurrentIdentityApproval(companionUser)) {
      throw new ConvexError('The Companion is not currently available for this booking request')
    }
    if (!companion.categories.includes(args.category)) throw new ConvexError('This experience category is not offered by the Companion')
    if (companion.mode !== 'both' && companion.mode !== args.mode) throw new ConvexError('This booking mode is not offered by the Companion')
    if (!Number.isFinite(args.requestedAt) || args.requestedAt <= Date.now()) throw new ConvexError('Booking time must be in the future')
    const durationMinutes = validateBookingDurationMinutes(args.durationMinutes)
    assertScheduleAllowsRequest(companion, args.requestedAt, durationMinutes)
    await assertNoAcceptedBookingConflict(ctx, companion.userId, args.requestedAt, durationMinutes, booking._id)
    const hourlyRateCentavos = validateCompanionHourlyRateCentavos(companion.hourlyRateCentavos ?? Number.NaN)
    if (!memberWalletV2Enabled()) throw new ConvexError('Member-wallet bookings are not enabled')
    const price = calculateMemberWalletBookingPrice(hourlyRateCentavos, durationMinutes)
    const availableCentavos = await availableMemberBookingBalance(ctx, viewer._id)
    if (availableCentavos < price.memberTotalCentavos) {
      throw new ConvexError(`Insufficient booking balance. Add at least ${formatPhp(price.memberTotalCentavos - availableCentavos)} to your wallet before updating.`)
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
      companionEarningsCentavos: price.companionEarningsCentavos,
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
    const conversationId = await ensureConversationBetween(ctx, viewer._id, companion.userId)
    await sendBookingMessage(ctx, {
      conversationId,
      senderUserId: viewer._id,
      bookingId: args.bookingId,
      body: bookingUpdatedMessage(viewer.displayName, args.category, args.mode, args.requestedAt, durationMinutes),
    })
    await createNotification(ctx, {
      recipientUserId: companion.userId,
      actorUserId: viewer._id,
      kind: 'booking_request_updated',
      priority: 'attention',
      bookingId: args.bookingId,
      conversationId,
      dedupeKey: `booking:${args.bookingId}:request-updated:${now}`,
    })
    return { bookingId: args.bookingId, ...price }
  },
})

export const companionDecision = mutation({
  args: { bookingId: v.id('bookings'), decision: v.union(v.literal('accepted'), v.literal('declined')), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError('Booking not found')
    const companion = await ctx.db.get(booking.companionProfileId)
    if (!companion || companion.userId !== viewer._id) throw new ConvexError('Only the booked Companion can decide')
    if (booking.status === args.decision) return { status: booking.status, idempotent: true }
    if (booking.status !== 'request_sent') throw new ConvexError('Booking is not awaiting companion decision')
    let v2SettlementState = booking.settlementState
    let v2SettlementBlockedAt = booking.settlementBlockedAt
    if (args.decision === 'accepted') {
      if (companion.status !== 'approved' || !hasCurrentIdentityApproval(viewer)) {
        throw new ConvexError('A current identity check and approved Companion profile are required before accepting new bookings')
      }
      // Authoritative schedule and conflict checks run before any funds move, so
      // a rejected acceptance leaves zero partial writes. The current booking is
      // excluded so a retried acceptance stays idempotent.
      assertScheduleAllowsRequest(companion, booking.requestedAt, booking.durationMinutes)
      await assertNoAcceptedBookingConflict(ctx, viewer._id, booking.requestedAt, booking.durationMinutes, booking._id)
      const member = await ctx.db.get(booking.memberId)
      if (!member || member.suspended || !hasCurrentIdentityApproval(member)) {
        throw new ConvexError('The member must renew identity approval before this booking can be accepted')
      }
      if (booking.pricingModel === MEMBER_WALLET_PRICING_MODEL) {
        await reserveBookingFunds(ctx, booking)
        const blocked = await hasActiveBookingReport(ctx, booking._id)
        v2SettlementState = blocked ? 'blocked' : 'reserved'
        v2SettlementBlockedAt = blocked ? (booking.settlementBlockedAt ?? Date.now()) : booking.settlementBlockedAt
      } else if (await pastDueCommissionCentavos(ctx, viewer._id) > 0) {
        throw new ConvexError('Past-due platform commission must be settled before accepting a new booking')
      }
    }
    const now = Date.now()
    await ctx.db.patch(args.bookingId, {
      status: args.decision,
      companionDecisionNote: args.note,
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
    await createNotification(ctx, {
      recipientUserId: booking.memberId,
      actorUserId: viewer._id,
      kind: args.decision === 'accepted' ? 'booking_accepted' : 'booking_declined',
      priority: args.decision === 'accepted' ? 'standard' : 'attention',
      bookingId: args.bookingId,
      conversationId,
      dedupeKey: `booking:${args.bookingId}:${args.decision}`,
    })
    return { status: args.decision, idempotent: false }
  },
})

export const cancel = mutation({
  args: { bookingId: v.id('bookings'), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError('Booking not found')
    const companion = await ctx.db.get(booking.companionProfileId)
    if (booking.memberId !== viewer._id && companion?.userId !== viewer._id) throw new ConvexError('Not your booking')
    if (booking.status === 'cancelled') return { status: 'cancelled' as const, idempotent: true }
    if (
      booking.pricingModel === MEMBER_WALLET_PRICING_MODEL
      && (booking.memberCompletedAt || booking.companionCompletedAt)
    ) {
      throw new ConvexError('A completion confirmation has already been recorded. Use the report/dispute flow instead of cancelling.')
    }
    if (!canCancelBooking(booking.status)) throw new ConvexError('This booking can no longer be cancelled')
    if (booking.pricingModel === MEMBER_WALLET_PRICING_MODEL && booking.status === 'accepted') {
      if (booking.settlementState === 'blocked' || await hasActiveBookingReport(ctx, booking._id)) {
        throw new ConvexError('This booking has an active safety hold. A full admin must resolve the reserved funds.')
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
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'booking.cancelled', targetType: 'booking', targetId: String(args.bookingId), note: reason })
    const otherUserId = booking.memberId === viewer._id ? companion?.userId : booking.memberId
    if (otherUserId) {
      const cancellationConversationId = await ensureConversationBetween(ctx, viewer._id, otherUserId)
      await sendBookingMessage(ctx, {
        conversationId: cancellationConversationId,
        senderUserId: viewer._id,
        bookingId: args.bookingId,
        body: bookingCancelledMessage(viewer.displayName, viewer._id === booking.memberId, booking.category, reason),
      })
      await createNotification(ctx, {
        recipientUserId: otherUserId,
        actorUserId: viewer._id,
        kind: 'booking_cancelled',
        priority: 'attention',
        bookingId: args.bookingId,
        conversationId: cancellationConversationId,
        dedupeKey: `booking:${args.bookingId}:cancelled`,
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
    if (!booking) throw new ConvexError('Booking not found')
    if (booking.pricingModel === MEMBER_WALLET_PRICING_MODEL && booking.settlementState === 'refunded') {
      throw new ConvexError('Refunded bookings cannot be completed')
    }
    const companion = await ctx.db.get(booking.companionProfileId)
    if (!companion) throw new ConvexError('Companion profile not found')
    const isMember = booking.memberId === viewer._id
    const isCompanion = companion.userId === viewer._id
    if (!isMember && !isCompanion) throw new ConvexError('Not your booking')
    const participantCompletedAt = isMember ? booking.memberCompletedAt : booking.companionCompletedAt
    if (booking.status !== 'accepted') {
      if (
        ['review_window', 'completed', 'closed'].includes(booking.status)
        && participantCompletedAt
      ) {
        return { status: booking.status, awaitingOtherConfirmation: false, idempotent: true }
      }
      throw new ConvexError('Only accepted bookings can be completed')
    }
    if (!canCompleteBooking(booking.status)) throw new ConvexError('Only accepted bookings can be completed')
    if (participantCompletedAt) {
      return { status: 'accepted' as const, awaitingOtherConfirmation: true, idempotent: true }
    }

    const requestedAt = booking.requestedAt
    const durationMinutes = booking.durationMinutes
    if (
      !Number.isFinite(requestedAt)
      || !Number.isSafeInteger(requestedAt)
      || !Number.isFinite(durationMinutes)
      || !Number.isSafeInteger(durationMinutes)
      || durationMinutes <= 0
    ) {
      throw new ConvexError('Booking schedule is invalid')
    }
    const durationMs = durationMinutes * 60_000
    const scheduledEndAt = requestedAt + durationMs
    if (!Number.isSafeInteger(durationMs) || !Number.isFinite(scheduledEndAt) || !Number.isSafeInteger(scheduledEndAt)) {
      throw new ConvexError('Booking schedule is invalid')
    }
    const now = Date.now()
    if (now < scheduledEndAt) throw new ConvexError('Booking cannot be completed before the scheduled session ends')

    if (booking.pricingModel === MEMBER_WALLET_PRICING_MODEL) {
      const role = isCompanion ? 'companion_start' : 'member_end'
      const decision = await ctx.db.query('bookingEvidenceDecisions')
        .withIndex('by_booking_role', (q) => q.eq('bookingId', booking._id).eq('role', role))
        .unique()
      if (!decision || decision.userId !== viewer._id) {
        throw new ConvexError(isCompanion
          ? 'Choose start evidence or explicitly skip it before confirming completion.'
          : 'Choose end evidence or explicitly skip it before confirming completion.')
      }
    }

    const memberCompletedAt = isMember ? (booking.memberCompletedAt ?? now) : booking.memberCompletedAt
    const companionCompletedAt = isCompanion ? (booking.companionCompletedAt ?? now) : booking.companionCompletedAt
    if (!memberCompletedAt || !companionCompletedAt) {
      await ctx.db.patch(args.bookingId, { memberCompletedAt, companionCompletedAt, updatedAt: now })
      await writeAudit(ctx, {
        actorUserId: viewer._id,
        action: isMember ? 'booking.member_completion_confirmed' : 'booking.companion_completion_confirmed',
        targetType: 'booking',
        targetId: String(args.bookingId),
      })
      await createNotification(ctx, {
        recipientUserId: isMember ? companion.userId : booking.memberId,
        actorUserId: viewer._id,
        kind: 'booking_completion_confirmed',
        priority: 'attention',
        bookingId: args.bookingId,
        dedupeKey: `booking:${args.bookingId}:completion:${isMember ? 'member' : 'companion'}`,
      })
      return { status: 'accepted' as const, awaitingOtherConfirmation: true, idempotent: false }
    }

    if (booking.pricingModel === MEMBER_WALLET_PRICING_MODEL) {
      const allocation = await allocateCompletedBookingFunds(ctx, booking, companion.userId, now)
      await ctx.db.patch(args.bookingId, {
        status: 'review_window',
        memberCompletedAt,
        companionCompletedAt,
        jointlyCompletedAt: booking.jointlyCompletedAt ?? now,
        settlementEligibleAt: booking.settlementEligibleAt ?? allocation.settlementEligibleAt,
        updatedAt: now,
      })
      // Mutual completion settles immediately, so the Companion wallet reflects
      // the booking at once. A booking with an active report is held for admin
      // resolution instead, exactly as it would have been during the hold.
      const settlement = await settleBookingFunds(ctx, args.bookingId, now)
      await writeAudit(ctx, {
        actorUserId: viewer._id,
        action: 'booking.review_window_opened',
        targetType: 'booking',
        targetId: String(args.bookingId),
        after: { settlementEligibleAt: allocation.settlementEligibleAt, settlementState: settlement.outcome },
      })
      await notifyReviewWindowOpened(ctx, booking.memberId, companion.userId, viewer._id, args.bookingId)
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
          companionUserId: companion.userId,
          companionProfileId: companion._id,
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
      companionCompletedAt,
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
    await notifyReviewWindowOpened(ctx, booking.memberId, companion.userId, viewer._id, args.bookingId)
    return { status: 'review_window' as const, awaitingOtherConfirmation: false, idempotent: false }
  },
})

async function notifyReviewWindowOpened(
  ctx: { db: any },
  memberId: any,
  companionUserId: any,
  actorUserId: any,
  bookingId: any,
) {
  const recipientUserId = actorUserId === memberId ? companionUserId : memberId
  await createNotification(ctx, {
    recipientUserId,
    actorUserId,
    kind: 'booking_review_window_opened',
    priority: 'attention',
    bookingId,
    dedupeKey: `booking:${bookingId}:review-window`,
  })
}

export const messages = query({
  args: { bookingId: v.id('bookings') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError('Booking not found')
    const companion = await ctx.db.get(booking.companionProfileId)
    if (booking.memberId !== viewer._id && companion?.userId !== viewer._id) throw new ConvexError('Not your booking')
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
    await consumeRateLimit(ctx, viewer._id, 'send_message')
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError('Booking not found')
    const companion = await ctx.db.get(booking.companionProfileId)
    if (booking.memberId !== viewer._id && companion?.userId !== viewer._id) throw new ConvexError('Not your booking')
    if (!canChatForStatus(booking.status)) throw new ConvexError('Chat unlocks after verification/admin review sends the booking request')
    if (booking.status === 'request_sent') {
      const member = await ctx.db.get(booking.memberId)
      const companionUser = companion ? await ctx.db.get(companion.userId) : null
      if (
        !member
        || member.suspended
        || !hasCurrentIdentityApproval(member)
        || !companionUser
        || companionUser.suspended
        || !hasCurrentIdentityApproval(companionUser)
      ) {
        throw new ConvexError('Both participants need current identity approval before pre-acceptance messaging can continue')
      }
    }
    const body = args.body.trim()
    if (!body) throw new ConvexError('Message cannot be empty')
    return await ctx.db.insert('messages', { bookingId: args.bookingId, senderId: viewer._id, body, reportable: true, createdAt: Date.now() })
  },
})

function bookingRequestMessage(memberName: string, category: string, mode: 'online' | 'in_person', requestedAt: number, durationMinutes: number) {
  return `${memberName} sent you a booking request for ${category} (${formatModeLabel(mode)}) on ${formatBookingDate(requestedAt)} for ${formatDurationLabel(durationMinutes)}. You can accept, decline, or talk it over here first.`
}

function bookingUpdatedMessage(memberName: string, category: string, mode: 'online' | 'in_person', requestedAt: number, durationMinutes: number) {
  return `${memberName} updated this request: ${category} on ${formatBookingDate(requestedAt)} (${formatModeLabel(mode)}, ${formatDurationLabel(durationMinutes)}). Please take another look before deciding.`
}

function bookingDecisionMessage(companionName: string, decision: 'accepted' | 'declined') {
  if (decision === 'accepted') return `${companionName} accepted this booking request.`
  return `${companionName} declined this booking request.`
}

function bookingCancelledMessage(name: string, isMember: boolean, category: string, reason?: string) {
  const who = isMember ? 'The member' : 'The Companion'
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
