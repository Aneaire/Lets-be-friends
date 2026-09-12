import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { cancelBookingRequest, createBookingRequest } from './bookings'
import { getCircleAuthorization, isCircleParticipantRole, isFullAdminRole, requireCircleWrite } from './circleAuthorization'
import { hasCurrentIdentityApproval } from './identityVerification'
import { requireViewer, writeAudit } from './lib'
import { createNotification } from './notifications'
import { consumeRateLimit } from './rateLimit'
import { areUsersBlocked, requireNotBlocked } from './safety'

const MIN_CAPACITY = 2
const MAX_CAPACITY = 50
const MAX_ACTIVE_GATHERINGS_PER_HOST = 10
const MAX_INVITE_BODY = 1000

const gatheringStateValidator = v.union(v.literal('open'), v.literal('closed'), v.literal('cancelled'))
const guestListVisibilityValidator = v.union(v.literal('confirmed_only'), v.literal('public'))
const participantDecisionValidator = v.union(v.literal('confirmed'), v.literal('declined'), v.literal('removed'))

function resolveGatheringState(
  gathering: Pick<Doc<'gatherings'>, 'state' | 'startsAt'>,
  booking: Pick<Doc<'bookings'>, 'status'> | null,
  now = Date.now(),
) {
  if (gathering.state === 'cancelled' || booking?.status === 'cancelled') return 'cancelled' as const
  if (booking?.status === 'request_sent' && gathering.startsAt > now) return 'open' as const
  return 'closed' as const
}

function parseCapacity(value: number) {
  if (!Number.isSafeInteger(value) || value < MIN_CAPACITY || value > MAX_CAPACITY) {
    throw new Error(`A Gathering holds between ${MIN_CAPACITY} and ${MAX_CAPACITY} participants`)
  }
  return value
}

async function requireEligibleViewer(ctx: Pick<QueryCtx | MutationCtx, 'auth' | 'db'>) {
  const viewer = await requireViewer(ctx)
  if (!isCircleParticipantRole(viewer.role)) throw new Error('Gathering participation requires an eligible account role')
  return viewer
}

async function participantsFor(ctx: Pick<QueryCtx | MutationCtx, 'db'>, gatheringId: Id<'gatherings'>) {
  return await ctx.db.query('gatheringParticipants').withIndex('by_gathering', (q) => q.eq('gatheringId', gatheringId)).collect()
}

async function invitePostsFor(ctx: Pick<QueryCtx | MutationCtx, 'db'>, gatheringId: Id<'gatherings'>) {
  return await ctx.db.query('posts').withIndex('by_gathering', (q) => q.eq('gatheringId', gatheringId)).collect()
}

async function canReadInvitePost(
  ctx: Pick<QueryCtx | MutationCtx, 'auth' | 'db'>,
  post: Doc<'posts'>,
  viewer: Doc<'users'>,
) {
  if (post.hidden || post.deletedAt || post.circleRemovedAt) return false
  if (!post.circleId) return true
  const access = await getCircleAuthorization(ctx, post.circleId)
  return access.canReadDiscussion
}

async function canReadGathering(
  ctx: Pick<QueryCtx | MutationCtx, 'auth' | 'db'>,
  gathering: Doc<'gatherings'>,
  viewer: Doc<'users'>,
  participants: Doc<'gatheringParticipants'>[],
) {
  if (gathering.hostUserId === viewer._id) return true
  if (participants.some((row) => row.userId === viewer._id)) return true
  const companion = await ctx.db.get(gathering.companionProfileId)
  if (companion?.userId === viewer._id) return true
  const invites = await invitePostsFor(ctx, gathering._id)
  for (const post of invites) {
    if (await canReadInvitePost(ctx, post, viewer)) return true
  }
  return false
}

async function requireGatheringHost(ctx: Pick<QueryCtx | MutationCtx, 'auth' | 'db'>, gathering: Doc<'gatherings'>) {
  const viewer = await requireEligibleViewer(ctx)
  if (gathering.hostUserId !== viewer._id) throw new Error('Only the Gathering host can do that')
  return viewer
}

async function presentGathering(
  ctx: Pick<QueryCtx | MutationCtx, 'auth' | 'db'>,
  gathering: Doc<'gatherings'>,
  booking: Doc<'bookings'> | null,
  viewer: Doc<'users'>,
  participants: Doc<'gatheringParticipants'>[],
) {
  const [host, companion] = await Promise.all([
    ctx.db.get(gathering.hostUserId),
    ctx.db.get(gathering.companionProfileId),
  ])
  const companionUser = companion ? await ctx.db.get(companion.userId) : null
  const confirmed = participants.filter((row) => row.state === 'confirmed')
  const requested = participants.filter((row) => row.state === 'requested')
  const viewerParticipant = participants.find((row) => row.userId === viewer._id) ?? null
  const isHost = gathering.hostUserId === viewer._id
  const isCompanion = companion?.userId === viewer._id
  const state = resolveGatheringState(gathering, booking)
  const joinableState = viewerParticipant?.state === null || viewerParticipant === null || ['left', 'declined', 'removed'].includes(viewerParticipant.state)

  return {
    _id: gathering._id,
    hostUserId: gathering.hostUserId,
    hostDisplayName: host?.displayName ?? 'Host',
    hostUsername: host?.username,
    hostProfileImageUrl: host?.profileImageUrl,
    companionProfileId: gathering.companionProfileId,
    companionUserId: companion?.userId,
    companionDisplayName: companionUser?.displayName ?? companion?.displayName ?? 'Companion',
    companionCity: companion?.city,
    circleId: gathering.circleId,
    category: gathering.category,
    mode: gathering.mode,
    startsAt: gathering.startsAt,
    durationMinutes: gathering.durationMinutes,
    capacity: gathering.capacity,
    guestListVisibility: gathering.guestListVisibility ?? 'confirmed_only',
    state,
    bookingId: gathering.bookingId,
    bookingStatus: booking?.status,
    memberTotalCentavos: booking?.memberTotalCentavos,
    confirmedCount: confirmed.length,
    requestedCount: requested.length,
    seatsRemaining: Math.max(0, gathering.capacity - confirmed.length),
    viewer: {
      isHost,
      isCompanion,
      participantState: viewerParticipant?.state ?? null,
      canRequestJoin: !isHost && !isCompanion && state === 'open' && joinableState,
      canConfirm: isHost && state !== 'cancelled',
    },
    createdAt: gathering.createdAt,
    updatedAt: gathering.updatedAt,
  }
}

async function presentGatheringById(ctx: Pick<QueryCtx | MutationCtx, 'auth' | 'db'>, gathering: Doc<'gatherings'>, viewer: Doc<'users'>) {
  const booking = gathering.bookingId ? await ctx.db.get(gathering.bookingId) : null
  const participants = await participantsFor(ctx, gathering._id)
  return await presentGathering(ctx, gathering, booking, viewer, participants)
}

export const create = mutation({
  args: {
    companionProfileId: v.id('companionProfiles'),
    category: v.string(),
    mode: v.union(v.literal('online'), v.literal('in_person')),
    startsAt: v.number(),
    durationMinutes: v.number(),
    capacity: v.number(),
    notes: v.optional(v.string()),
    guestListVisibility: v.optional(guestListVisibilityValidator),
  },
  handler: async (ctx, args) => {
    const viewer = await requireEligibleViewer(ctx)
    if (!hasCurrentIdentityApproval(viewer)) {
      throw new Error('A current identity check and safety review are required before you can host a Gathering.')
    }
    const capacity = parseCapacity(args.capacity)
    const now = Date.now()
    const active = await ctx.db
      .query('gatherings')
      .withIndex('by_host', (q) => q.eq('hostUserId', viewer._id))
      .collect()
    const activeCount = active.filter((row) => row.state !== 'cancelled' && row.startsAt > now).length
    if (activeCount >= MAX_ACTIVE_GATHERINGS_PER_HOST) {
      throw new Error('You already have the maximum number of upcoming Gatherings')
    }

    const booking = await createBookingRequest(ctx, viewer, {
      companionProfileId: args.companionProfileId,
      category: args.category,
      mode: args.mode,
      requestedAt: args.startsAt,
      durationMinutes: args.durationMinutes,
      notes: args.notes,
    }, 'group')

    const gatheringId = await ctx.db.insert('gatherings', {
      hostUserId: viewer._id,
      companionProfileId: args.companionProfileId,
      bookingId: booking.bookingId,
      category: args.category,
      mode: args.mode,
      startsAt: args.startsAt,
      durationMinutes: args.durationMinutes,
      capacity,
      guestListVisibility: args.guestListVisibility ?? 'confirmed_only',
      state: 'open',
      createdAt: now,
      updatedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'gathering.created',
      targetType: 'gathering',
      targetId: String(gatheringId),
      after: { capacity, bookingId: String(booking.bookingId) },
    })
    return { gatheringId, bookingId: booking.bookingId, memberTotalCentavos: booking.memberTotalCentavos }
  },
})

export const postInvite = mutation({
  args: {
    gatheringId: v.id('gatherings'),
    body: v.string(),
    circleId: v.optional(v.id('circles')),
  },
  handler: async (ctx, args) => {
    const gathering = await ctx.db.get(args.gatheringId)
    if (!gathering) throw new Error('Gathering not found')
    const viewer = await requireGatheringHost(ctx, gathering)
    if (gathering.state === 'cancelled') throw new Error('This Gathering was cancelled')
    const body = args.body.trim()
    if (body.length < 1 || body.length > MAX_INVITE_BODY) throw new Error('Invite must be between 1 and 1000 characters')

    let circleId = gathering.circleId
    if (args.circleId) {
      await requireCircleWrite(ctx, args.circleId)
      if (gathering.circleId && gathering.circleId !== args.circleId) {
        throw new Error('This Gathering already belongs to another Circle')
      }
      circleId = args.circleId
    }

    await consumeRateLimit(ctx, viewer._id, 'create_post')
    const now = Date.now()
    const postId = await ctx.db.insert('posts', {
      authorId: viewer._id,
      circleId: args.circleId,
      circleKind: args.circleId ? 'discussion' : undefined,
      gatheringId: gathering._id,
      body,
      reportable: true,
      hidden: false,
      likeCount: 0,
      commentCount: 0,
      savedCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    if (circleId && circleId !== gathering.circleId) {
      await ctx.db.patch(gathering._id, { circleId, updatedAt: now })
    }
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'gathering.invite_posted', targetType: 'gathering', targetId: String(gathering._id), after: { postId: String(postId), circleId: circleId ? String(circleId) : undefined } })

    if (args.circleId) {
      const members = await ctx.db
        .query('circleMemberships')
        .withIndex('by_circle_state', (q) => q.eq('circleId', args.circleId!).eq('state', 'active'))
        .collect()
      await Promise.all(members.filter((row) => row.userId !== viewer._id).map((row) => createNotification(ctx, {
        recipientUserId: row.userId,
        actorUserId: viewer._id,
        kind: 'gathering_invite',
        priority: 'standard',
        circleId: args.circleId,
        postId,
        gatheringId: gathering._id,
        dedupeKey: `gathering-invite:${postId}:${row.userId}`,
      })))
    }
    return postId
  },
})

export const requestJoin = mutation({
  args: { gatheringId: v.id('gatherings') },
  handler: async (ctx, args) => {
    const viewer = await requireEligibleViewer(ctx)
    const gathering = await ctx.db.get(args.gatheringId)
    if (!gathering) throw new Error('Gathering not found')
    const booking = gathering.bookingId ? await ctx.db.get(gathering.bookingId) : null
    const participants = await participantsFor(ctx, gathering._id)
    if (!await canReadGathering(ctx, gathering, viewer, participants)) throw new Error('Gathering not found')
    const state = resolveGatheringState(gathering, booking)
    if (state !== 'open') throw new Error(state === 'cancelled' ? 'This Gathering was cancelled' : 'This Gathering is no longer accepting participants')
    if (gathering.hostUserId === viewer._id) throw new Error('You are hosting this Gathering')
    const companion = await ctx.db.get(gathering.companionProfileId)
    if (companion?.userId === viewer._id) throw new Error('You are the Companion for this Gathering')
    await requireNotBlocked(ctx, viewer._id, gathering.hostUserId)

    const now = Date.now()
    const existing = participants.find((row) => row.userId === viewer._id) ?? null
    if (existing && ['requested', 'confirmed'].includes(existing.state)) {
      return { status: existing.state }
    }
    if (existing) {
      await ctx.db.patch(existing._id, { state: 'requested', decidedByUserId: undefined, decidedAt: undefined, joinedAt: undefined, updatedAt: now })
    } else {
      await ctx.db.insert('gatheringParticipants', {
        gatheringId: gathering._id,
        userId: viewer._id,
        state: 'requested',
        createdAt: now,
        updatedAt: now,
      })
    }
    await createNotification(ctx, {
      recipientUserId: gathering.hostUserId,
      actorUserId: viewer._id,
      kind: 'gathering_join_requested',
      priority: 'standard',
      gatheringId: gathering._id,
      dedupeKey: `gathering-join-requested:${gathering._id}:${viewer._id}`,
    })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'gathering.join_requested', targetType: 'gathering', targetId: String(gathering._id), after: { userId: String(viewer._id) } })
    return { status: 'requested' as const }
  },
})

export const decideParticipant = mutation({
  args: {
    gatheringId: v.id('gatherings'),
    userId: v.id('users'),
    decision: participantDecisionValidator,
  },
  handler: async (ctx, args) => {
    const gathering = await ctx.db.get(args.gatheringId)
    if (!gathering) throw new Error('Gathering not found')
    const viewer = await requireGatheringHost(ctx, gathering)
    if (gathering.state === 'cancelled') throw new Error('This Gathering was cancelled')
    const row = await ctx.db
      .query('gatheringParticipants')
      .withIndex('by_gathering_user', (q) => q.eq('gatheringId', gathering._id).eq('userId', args.userId))
      .unique()
    if (!row) throw new Error('Participant not found')
    if (row.state === args.decision) return { status: args.decision, idempotent: true }

    const now = Date.now()
    if (args.decision === 'confirmed') {
      if (!['requested', 'confirmed'].includes(row.state)) throw new Error('Only requested participants can be confirmed')
      const target = await ctx.db.get(args.userId)
      if (!target || target.suspended || !isCircleParticipantRole(target.role)) throw new Error('This member cannot join a Gathering')
      if (!hasCurrentIdentityApproval(target)) throw new Error('This member needs a current identity approval before joining')
      await requireNotBlocked(ctx, viewer._id, args.userId)
      const confirmed = (await participantsFor(ctx, gathering._id)).filter((participant) => participant.state === 'confirmed')
      if (confirmed.length >= gathering.capacity) throw new Error('This Gathering is already full')
      await ctx.db.patch(row._id, { state: 'confirmed', decidedByUserId: viewer._id, decidedAt: now, joinedAt: row.joinedAt ?? now, updatedAt: now })
    } else if (args.decision === 'declined') {
      if (row.state !== 'requested') throw new Error('Only requested participants can be declined')
      await ctx.db.patch(row._id, { state: 'declined', decidedByUserId: viewer._id, decidedAt: now, updatedAt: now })
    } else {
      if (!['requested', 'confirmed'].includes(row.state)) throw new Error('Only active participants can be removed')
      await ctx.db.patch(row._id, { state: 'removed', decidedByUserId: viewer._id, decidedAt: now, updatedAt: now })
    }

    const kind = args.decision === 'confirmed'
      ? 'gathering_join_confirmed'
      : args.decision === 'declined'
        ? 'gathering_join_declined'
        : 'gathering_participant_removed'
    await createNotification(ctx, {
      recipientUserId: args.userId,
      actorUserId: viewer._id,
      kind,
      priority: args.decision === 'confirmed' ? 'standard' : 'attention',
      gatheringId: gathering._id,
      dedupeKey: `gathering-participant:${gathering._id}:${args.userId}:${args.decision}`,
    })
    await writeAudit(ctx, { actorUserId: viewer._id, action: `gathering.participant_${args.decision}`, targetType: 'gathering', targetId: String(gathering._id), after: { userId: String(args.userId) } })
    return { status: args.decision, idempotent: false }
  },
})

export const leave = mutation({
  args: { gatheringId: v.id('gatherings') },
  handler: async (ctx, args) => {
    const viewer = await requireEligibleViewer(ctx)
    const row = await ctx.db
      .query('gatheringParticipants')
      .withIndex('by_gathering_user', (q) => q.eq('gatheringId', args.gatheringId).eq('userId', viewer._id))
      .unique()
    if (!row) throw new Error('You are not part of this Gathering')
    if (!['requested', 'confirmed'].includes(row.state)) throw new Error('You are not part of this Gathering')
    const now = Date.now()
    await ctx.db.patch(row._id, { state: 'left', updatedAt: now })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'gathering.participant_left', targetType: 'gathering', targetId: String(args.gatheringId) })
    return { status: 'left' as const }
  },
})

export const cancel = mutation({
  args: { gatheringId: v.id('gatherings'), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireEligibleViewer(ctx)
    const gathering = await ctx.db.get(args.gatheringId)
    if (!gathering) throw new Error('Gathering not found')
    const companion = await ctx.db.get(gathering.companionProfileId)
    const isHost = gathering.hostUserId === viewer._id
    const isCompanion = companion?.userId === viewer._id
    if (!isHost && !isCompanion && !isFullAdminRole(viewer.role)) throw new Error('Only the host, Companion, or a platform admin can cancel this Gathering')
    if (gathering.state === 'cancelled') return { status: 'cancelled' as const, idempotent: true }

    let bookingCancelled = false
    if (gathering.bookingId) {
      const result = await cancelBookingRequest(ctx, viewer, gathering.bookingId, args.reason)
      bookingCancelled = result.status === 'cancelled'
    }
    const now = Date.now()
    const reason = args.reason?.trim() || undefined
    await ctx.db.patch(gathering._id, { state: 'cancelled', cancelledByUserId: viewer._id, cancelledAt: now, cancellationReason: reason, updatedAt: now })
    const participants = (await participantsFor(ctx, gathering._id)).filter((row) => ['requested', 'confirmed'].includes(row.state))
    await Promise.all(participants.filter((row) => row.userId !== viewer._id).map((row) => createNotification(ctx, {
      recipientUserId: row.userId,
      actorUserId: viewer._id,
      kind: 'gathering_cancelled',
      priority: 'attention',
      gatheringId: gathering._id,
      dedupeKey: `gathering-cancelled:${gathering._id}:${row.userId}`,
    })))
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'gathering.cancelled', targetType: 'gathering', targetId: String(gathering._id), note: reason, after: { bookingCancelled } })
    return { status: 'cancelled' as const, idempotent: false }
  },
})

export const get = query({
  args: { gatheringId: v.id('gatherings') },
  handler: async (ctx, args) => {
    const viewer = await requireEligibleViewer(ctx)
    const gathering = await ctx.db.get(args.gatheringId)
    if (!gathering) throw new Error('Gathering not found')
    const participants = await participantsFor(ctx, gathering._id)
    if (!await canReadGathering(ctx, gathering, viewer, participants)) throw new Error('Gathering not found')
    const presented = await presentGatheringById(ctx, gathering, viewer)
    const isHost = gathering.hostUserId === viewer._id
    const isCompanion = presented.companionUserId === viewer._id
    const viewerParticipant = participants.find((row) => row.userId === viewer._id) ?? null
    const canSeeList = isHost || isCompanion || viewerParticipant?.state === 'confirmed' || presented.guestListVisibility === 'public'
    const visibleParticipants = canSeeList
      ? participants.filter((row) => row.state === 'confirmed' || (isHost && row.state === 'requested'))
      : participants.filter((row) => row.userId === viewer._id)
    const people = await Promise.all(visibleParticipants.map(async (row) => {
      const user = await ctx.db.get(row.userId)
      return {
        userId: row.userId,
        displayName: user?.displayName ?? 'Member',
        username: user?.username,
        profileImageUrl: user?.profileImageUrl,
        state: row.state,
      }
    }))
    return { ...presented, participants: people }
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireEligibleViewer(ctx)
    const [hosted, memberships] = await Promise.all([
      ctx.db.query('gatherings').withIndex('by_host', (q) => q.eq('hostUserId', viewer._id)).collect(),
      ctx.db.query('gatheringParticipants').withIndex('by_user', (q) => q.eq('userId', viewer._id)).collect(),
    ])
    const ids = new Set<Id<'gatherings'>>(hosted.map((row) => row._id))
    for (const row of memberships) {
      if (['requested', 'confirmed'].includes(row.state)) ids.add(row.gatheringId)
    }
    const gatherings = (await Promise.all([...ids].map((id) => ctx.db.get(id))))
      .filter((row): row is Doc<'gatherings'> => row !== null)
      .sort((left, right) => left.startsAt - right.startsAt)
    return await Promise.all(gatherings.map((row) => presentGatheringById(ctx, row, viewer)))
  },
})

export const listForCircle = query({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const viewer = await requireEligibleViewer(ctx)
    const access = await getCircleAuthorization(ctx, args.circleId)
    if (!access.canReadDiscussion) throw new Error('Active Circle membership required')
    const now = Date.now()
    const rows = await ctx.db
      .query('gatherings')
      .withIndex('by_circle', (q) => q.eq('circleId', args.circleId))
      .collect()
    const upcoming = rows
      .filter((row) => row.state !== 'cancelled' && row.startsAt > now)
      .sort((left, right) => left.startsAt - right.startsAt)
    return await Promise.all(upcoming.map((row) => presentGatheringById(ctx, row, viewer)))
  },
})
