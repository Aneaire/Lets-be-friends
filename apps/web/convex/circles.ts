import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { assertTrustedCircleRoleEligibility, getCircleAuthorization, isCircleParticipantRole, isFullAdminRole, requireCircleDiscussionRead, requireCircleMember, requireCircleMemberListRead, requireCircleModerator, resolveCircleSettings, type CircleSettings } from './circleAuthorization'
import { requireViewer, writeAudit } from './lib'
import { adjustCounter } from './counters'
import { createNotification } from './notifications'
import { isHiddenByPreference } from './safety'
import { hasCurrentIdentityApproval } from './identityVerification'

const normalizeSlug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const discoverabilityValidator = v.union(v.literal('listed'), v.literal('unlisted'))
const discussionVisibilityValidator = v.union(v.literal('members_only'), v.literal('signed_in'))
const memberListVisibilityValidator = v.union(v.literal('members_only'), v.literal('signed_in'))
const joinPolicyValidator = v.union(v.literal('approval_required'), v.literal('open'))

const MAX_CIRCLE_IMAGE_SIZE = 5 * 1024 * 1024
const CIRCLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function parseCircleSettings(input: Partial<CircleSettings>): CircleSettings {
  const settings: CircleSettings = {
    discoverability: input.discoverability ?? 'listed',
    discussionVisibility: input.discussionVisibility ?? 'members_only',
    memberListVisibility: input.memberListVisibility ?? 'members_only',
    joinPolicy: input.joinPolicy ?? 'approval_required',
  }
  if (!['listed', 'unlisted'].includes(settings.discoverability)) throw new Error('Unknown Circle discoverability')
  if (!['members_only', 'signed_in'].includes(settings.discussionVisibility)) throw new Error('Unknown Circle discussion visibility')
  if (!['members_only', 'signed_in'].includes(settings.memberListVisibility)) throw new Error('Unknown Circle member-list visibility')
  if (!['approval_required', 'open'].includes(settings.joinPolicy)) throw new Error('Unknown Circle join policy')
  return settings
}

async function requireCircleImageStorage(ctx: MutationCtx, storageId: Id<'_storage'>) {
  const metadata = await ctx.db.system.get('_storage', storageId)
  if (!metadata) throw new Error('Uploaded Circle image was not found')
  const contentType = (metadata.contentType ?? '').trim().toLowerCase()
  if (!CIRCLE_IMAGE_TYPES.has(contentType)) throw new Error('Circle images must be JPEG, PNG, or WebP still images')
  if (metadata.size > MAX_CIRCLE_IMAGE_SIZE) throw new Error('Circle images must be 5 MB or smaller')
  return metadata
}

function circleMetadata(input: { name: string; purpose: string; category: string; rules: string[]; approximateArea?: string }) {
  const name = input.name.trim()
  const purpose = input.purpose.trim()
  const category = input.category.trim()
  const rules = input.rules.map((rule) => rule.trim()).filter(Boolean)
  const approximateArea = input.approximateArea?.trim() || undefined
  if (!name || !purpose || !category || rules.length === 0) throw new Error('Circle name, purpose, category, and rules are required')
  if (name.length > 80 || purpose.length > 500 || category.length > 60 || rules.some((rule) => rule.length > 240)) throw new Error('Circle details are too long')
  if (approximateArea && (approximateArea.length > 80 || /[\r\n]/.test(approximateArea))) throw new Error('Use a short, approximate area')
  return { name, purpose, category, rules, approximateArea }
}

async function requireHostOrFullAdmin(ctx: Pick<QueryCtx | MutationCtx, 'auth' | 'db'>, circleId: Id<'circles'>) {
  const viewer = await requireViewer(ctx)
  const circle = await ctx.db.get(circleId)
  if (!circle) throw new Error('Circle not found')
  const row = await membership(ctx, circleId, viewer._id)
  const hasCanonicalHostMembership = circle.hostUserId === viewer._id && row?.state === 'active' && row.role === 'host'
  const isFullAdmin = isFullAdminRole(viewer.role)
  const isCircleHost = hasCanonicalHostMembership && isCircleParticipantRole(viewer.role) && hasCurrentIdentityApproval(viewer)
  if (hasCanonicalHostMembership && !isCircleHost && !isFullAdmin) assertTrustedCircleRoleEligibility(viewer, 'host')
  if (!isCircleHost && !isFullAdmin) throw new Error('Verified Circle host role required')
  return { viewer, circle, isFullAdmin, isCircleHost }
}

async function requireFullAdmin(ctx: Pick<QueryCtx | MutationCtx, 'auth' | 'db'>) {
  const viewer = await requireViewer(ctx)
  if (!isFullAdminRole(viewer.role)) throw new Error('Full admin role required')
  return viewer
}

async function requireCircleHost(ctx: Pick<QueryCtx | MutationCtx, 'auth' | 'db'>, circleId: Id<'circles'>) {
  const access = await requireHostOrFullAdmin(ctx, circleId)
  if (!access.isCircleHost) throw new Error('Circle management is available only to its host')
  return access
}

async function membership(ctx: Pick<QueryCtx | MutationCtx, 'db'>, circleId: Id<'circles'>, userId: Id<'users'>) {
  return await ctx.db.query('circleMemberships').withIndex('by_circle_user', (q) => q.eq('circleId', circleId).eq('userId', userId)).unique()
}

async function safePreview(ctx: Pick<QueryCtx, 'db' | 'storage'>, circle: Doc<'circles'>) {
  const rows = await ctx.db.query('circleMemberships').withIndex('by_circle_state', (q) => q.eq('circleId', circle._id).eq('state', 'active')).collect()
  const [host, users] = await Promise.all([
    ctx.db.get(circle.hostUserId),
    Promise.all(rows.map((row) => ctx.db.get(row.userId))),
  ])
  const settings = resolveCircleSettings(circle)
  // Suspended Circles never expose member media URLs through member routes.
  // Callers return an unavailable marker for suspended Circles instead.
  const [iconUrl, coverUrl] = circle.state === 'suspended'
    ? [undefined, undefined]
    : await Promise.all([
      circle.iconStorageId ? await ctx.storage.getUrl(circle.iconStorageId) : null,
      circle.coverStorageId ? await ctx.storage.getUrl(circle.coverStorageId) : null,
    ])
  return {
    _id: circle._id,
    slug: circle.slug,
    name: circle.name,
    purpose: circle.purpose,
    category: circle.category,
    rules: circle.rules,
    mode: circle.mode,
    approximateArea: circle.approximateArea,
    settings,
    discoverability: settings.discoverability,
    discussionVisibility: settings.discussionVisibility,
    memberListVisibility: settings.memberListVisibility,
    joinPolicy: settings.joinPolicy,
    iconUrl: iconUrl ?? undefined,
    coverUrl: coverUrl ?? undefined,
    memberCount: users.filter((user) => user && !user.suspended && isCircleParticipantRole(user.role)).length,
    host: host ? {
      userId: host._id,
      displayName: host.displayName,
      username: host.username,
      profileImageUrl: host.profileImageUrl,
    } : null,
  }
}

export const discover = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx)
    const circles = await ctx.db.query('circles').withIndex('by_state', (q) => q.eq('state', 'active')).collect()
    // Unlisted active Circles stay reachable by direct link but never appear
    // in Discover. Legacy rows without settings behave as listed.
    const listed = circles.filter((circle) => resolveCircleSettings(circle).discoverability === 'listed')
    return await Promise.all(listed.map((circle) => safePreview(ctx, circle)))
  },
})

export const creationEligibility = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    const eligibleRole = isCircleParticipantRole(viewer.role)
    const identityApproved = hasCurrentIdentityApproval(viewer)
    return {
      eligible: eligibleRole && identityApproved,
      reason: !eligibleRole ? 'role_required' as const : !identityApproved ? 'verification_required' as const : null,
    }
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    if (!isCircleParticipantRole(viewer.role)) return []
    const rows = await ctx.db.query('circleMemberships').withIndex('by_user', (q) => q.eq('userId', viewer._id)).collect()
    const circles = await Promise.all(rows.map(async (row) => {
      const circle = await ctx.db.get(row.circleId)
      if (!circle || circle.state === 'suspended' || (circle.state === 'archived' && row.state !== 'active')) return null
      return {
        ...(await safePreview(ctx, circle)),
        circleState: circle.state,
        membershipState: row.state,
        role: row.role,
        muted: Boolean(row.mutedAt),
        updatedAt: row.updatedAt,
      }
    }))
    return circles
      .flatMap((circle) => circle ? [circle] : [])
      .sort((left, right) => right.updatedAt - left.updatedAt)
  },
})

export const detail = query({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const access = await getCircleAuthorization(ctx, args.circleId)
    if (access.circle.state === 'suspended') {
      // A member route may explain that access ended, but it must not return
      // suspended Circle content or member metadata.
      return {
        unavailable: true as const,
        state: access.circle.state,
        membershipState: access.membership?.state ?? null,
      }
    }
    if (!access.canPreview) throw new Error('Circle is unavailable')
    const pins = access.canReadDiscussion
      ? await ctx.db.query('circlePins').withIndex('by_circle', (q) => q.eq('circleId', args.circleId)).collect()
      : []
    return {
      unavailable: false as const,
      ...(await safePreview(ctx, access.circle)),
      circleState: access.circle.state,
      membershipState: access.membership?.state ?? null,
      role: access.membership?.role ?? null,
      muted: Boolean(access.membership?.mutedAt),
      canRead: access.canRead,
      canReadDiscussion: access.canReadDiscussion,
      canReadMembers: access.canReadMembers,
      canWrite: access.canWrite,
      canModerate: access.canModerate,
      isHost: access.isHost,
      isCanonicalHost: access.circle.hostUserId === access.viewer._id
        && isCircleParticipantRole(access.viewer.role)
        && access.membership?.state === 'active'
        && access.membership.role === 'host'
        && hasCurrentIdentityApproval(access.viewer),
      pendingTransferForViewer: access.circle.state === 'active'
        && isCircleParticipantRole(access.viewer.role)
        && access.circle.pendingHostUserId === access.viewer._id
        && access.membership?.state === 'active',
      pinnedPostIds: pins.sort((left, right) => left.position - right.position).map((pin) => pin.postId),
    }
  },
})

export const hostManagement = query({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const access = await requireHostOrFullAdmin(ctx, args.circleId)
    if (!access.isCircleHost) throw new Error('Circle management is available only to its host')
    if (access.circle.state === 'suspended') throw new Error('Circle is suspended')
    const [activeRows, bannedRows] = await Promise.all([
      ctx.db.query('circleMemberships').withIndex('by_circle_state', (q) => q.eq('circleId', args.circleId).eq('state', 'active')).collect(),
      ctx.db.query('circleMemberships').withIndex('by_circle_state', (q) => q.eq('circleId', args.circleId).eq('state', 'banned')).collect(),
    ])
    const activeMembers = (await Promise.all(activeRows.map(async (row) => {
      const user = await ctx.db.get(row.userId)
      if (!user || user.suspended || !isCircleParticipantRole(user.role)) return null
      return {
        membershipId: row._id,
        userId: user._id,
        displayName: user.displayName,
        username: user.username,
        role: row.role,
        trustedRoleEligible: hasCurrentIdentityApproval(user),
      }
    }))).flatMap((row) => row ? [row] : [])
    const bannedMembers = (await Promise.all(bannedRows.map(async (row) => {
      const user = await ctx.db.get(row.userId)
      if (!user) return null
      return { membershipId: row._id, displayName: user.displayName, username: user.username }
    }))).flatMap((row) => row ? [row] : [])
    const pendingRecipient = access.circle.pendingHostUserId
      ? activeMembers.find((row) => row.userId === access.circle.pendingHostUserId) ?? null
      : null
    // Pending recipient identity and banned memberships belong only in this
    // canonical-host read model, never the shared member detail.
    const settings = resolveCircleSettings(access.circle)
    const [iconUrl, coverUrl] = await Promise.all([
      access.circle.iconStorageId ? await ctx.storage.getUrl(access.circle.iconStorageId) : null,
      access.circle.coverStorageId ? await ctx.storage.getUrl(access.circle.coverStorageId) : null,
    ])
    return {
      circle: {
        name: access.circle.name,
        purpose: access.circle.purpose,
        category: access.circle.category,
        rules: access.circle.rules,
        mode: access.circle.mode,
        approximateArea: access.circle.approximateArea,
        state: access.circle.state,
        settings,
        iconUrl: iconUrl ?? undefined,
        coverUrl: coverUrl ?? undefined,
      },
      activeMembers,
      bannedMembers,
      pendingTransfer: pendingRecipient ? { userId: pendingRecipient.userId, displayName: pendingRecipient.displayName } : null,
    }
  },
})

export const adminList = query({
  args: {
    state: v.optional(v.union(v.literal('active'), v.literal('archived'), v.literal('suspended'), v.literal('all'))),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFullAdmin(ctx)
    const state = args.state ?? 'all'
    const rows = state === 'all'
      ? await ctx.db.query('circles').collect()
      : await ctx.db.query('circles').withIndex('by_state', (q) => q.eq('state', state)).collect()
    const search = args.search?.trim().toLowerCase()
    const filtered = rows.filter((circle) => !search
      || circle.name.toLowerCase().includes(search)
      || circle.slug.toLowerCase().includes(search))
    return await Promise.all(filtered.sort((left, right) => right.updatedAt - left.updatedAt).map(async (circle) => {
      const [host, memberships] = await Promise.all([
        ctx.db.get(circle.hostUserId),
        ctx.db.query('circleMemberships').withIndex('by_circle', (q) => q.eq('circleId', circle._id)).collect(),
      ])
      return {
        _id: circle._id,
        slug: circle.slug,
        name: circle.name,
        category: circle.category,
        mode: circle.mode,
        approximateArea: circle.approximateArea,
        state: circle.state,
        settings: resolveCircleSettings(circle),
        hasIcon: Boolean(circle.iconStorageId),
        hasCover: Boolean(circle.coverStorageId),
        host: host ? { userId: host._id, displayName: host.displayName, suspended: host.suspended } : null,
        activeMemberCount: memberships.filter((row) => row.state === 'active').length,
        pendingJoinCount: memberships.filter((row) => row.state === 'requested').length,
        hasPendingTransfer: Boolean(circle.pendingHostUserId),
        updatedAt: circle.updatedAt,
      }
    }))
  },
})

export const adminDetail = query({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    await requireFullAdmin(ctx)
    const circle = await ctx.db.get(args.circleId)
    if (!circle) throw new Error('Circle not found')
    const [membershipRows, postRows, host, pendingRecipient] = await Promise.all([
      ctx.db.query('circleMemberships').withIndex('by_circle', (q) => q.eq('circleId', circle._id)).collect(),
      ctx.db.query('posts').withIndex('by_circle_created_at', (q) => q.eq('circleId', circle._id)).order('desc').take(100),
      ctx.db.get(circle.hostUserId),
      circle.pendingHostUserId ? ctx.db.get(circle.pendingHostUserId) : null,
    ])
    const memberships = (await Promise.all(membershipRows.map(async (row) => {
      const user = await ctx.db.get(row.userId)
      if (!user) return null
      return {
        membershipId: row._id,
        userId: user._id,
        displayName: user.displayName,
        username: user.username,
        accountRole: user.role,
        accountSuspended: user.suspended,
        state: row.state,
        role: row.role,
        identityApproved: hasCurrentIdentityApproval(user),
        updatedAt: row.updatedAt,
      }
    }))).flatMap((row) => row ? [row] : [])
    const posts = (await Promise.all(postRows.map(async (post) => {
      const author = await ctx.db.get(post.authorId)
      return {
        postId: post._id,
        authorDisplayName: author?.displayName ?? 'Unknown member',
        body: post.body,
        circleKind: post.circleKind ?? 'discussion',
        hidden: post.hidden,
        deletedAt: post.deletedAt,
        removedAt: post.circleRemovedAt,
        createdAt: post.createdAt,
      }
    })))
    const [iconUrl, coverUrl] = await Promise.all([
      circle.iconStorageId ? await ctx.storage.getUrl(circle.iconStorageId) : null,
      circle.coverStorageId ? await ctx.storage.getUrl(circle.coverStorageId) : null,
    ])
    return {
      circle: {
        _id: circle._id,
        slug: circle.slug,
        name: circle.name,
        purpose: circle.purpose,
        category: circle.category,
        rules: circle.rules,
        mode: circle.mode,
        approximateArea: circle.approximateArea,
        state: circle.state,
        settings: resolveCircleSettings(circle),
        iconUrl: iconUrl ?? undefined,
        coverUrl: coverUrl ?? undefined,
        restoreState: circle.state === 'suspended' ? circle.preSuspensionState ?? 'active' : undefined,
        updatedAt: circle.updatedAt,
      },
      host: host ? { userId: host._id, displayName: host.displayName, suspended: host.suspended, identityApproved: hasCurrentIdentityApproval(host) } : null,
      pendingTransfer: pendingRecipient ? { userId: pendingRecipient._id, displayName: pendingRecipient.displayName } : null,
      memberships,
      posts,
      emergencyHostCandidates: memberships.filter((row) => row.state === 'active' && row.userId !== circle.hostUserId && !row.accountSuspended && row.identityApproved),
    }
  },
})

export const preview = query({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const access = await getCircleAuthorization(ctx, args.circleId)
    if (!access.canPreview) throw new Error(access.circle.state === 'suspended' ? 'Circle is suspended' : 'Circle is unavailable')
    return await safePreview(ctx, access.circle)
  },
})

export const members = query({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    // Public member-list visibility exposes only active eligible member
    // profiles and roles. Pending, rejected, removed, left, banned, and
    // suspended-account rows never appear here, regardless of visibility.
    await requireCircleMemberListRead(ctx, args.circleId)
    const rows = await ctx.db.query('circleMemberships').withIndex('by_circle_state', (q) => q.eq('circleId', args.circleId).eq('state', 'active')).collect()
    const results = await Promise.all(rows.map(async (row) => {
      const user = await ctx.db.get(row.userId)
      if (!user || user.suspended || !isCircleParticipantRole(user.role)) return null
      return { membershipId: row._id, userId: user._id, displayName: user.displayName, username: user.username, profileImageUrl: user.profileImageUrl, role: row.role }
    }))
    return results.filter((result) => result !== null)
  },
})

export const joinRequests = query({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    await requireCircleModerator(ctx, args.circleId)
    const rows = await ctx.db.query('circleMemberships').withIndex('by_circle_state', (q) => q.eq('circleId', args.circleId).eq('state', 'requested')).collect()
    const results = await Promise.all(rows.map(async (row) => {
      const user = await ctx.db.get(row.userId)
      if (!user || user.suspended || !isCircleParticipantRole(user.role)) return null
      return { membershipId: row._id, userId: user._id, displayName: user.displayName, username: user.username, requestedAt: row.updatedAt }
    }))
    return results.filter((result) => result !== null)
  },
})

export const removedContent = query({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const access = await requireCircleModerator(ctx, args.circleId)
    const posts = await ctx.db.query('posts').withIndex('by_circle_created_at', (q) => q.eq('circleId', args.circleId)).order('desc').take(100)
    // Circle moderation does not override a member's block boundary. The
    // restore queue applies the same mutual visibility rule as the feed.
    const visiblePosts = (await Promise.all(posts.map(async (post) => (
      post.authorId === access.viewer._id || !await isHiddenByPreference(ctx, access.viewer._id, post.authorId) ? post : null
    )))).flatMap((post) => post ? [post] : [])
    const removedPosts = visiblePosts.filter((post) => Boolean(post.circleRemovedAt)).map((post) => ({
      kind: 'post' as const,
      id: post._id,
      body: post.body,
      removedAt: post.circleRemovedAt!,
    }))
    const comments = await Promise.all(visiblePosts.map((post) => ctx.db.query('postComments').withIndex('by_post', (q) => q.eq('postId', post._id)).collect()))
    const visibleComments = (await Promise.all(comments.flat().map(async (comment) => (
      comment.authorId === access.viewer._id || !await isHiddenByPreference(ctx, access.viewer._id, comment.authorId) ? comment : null
    )))).flatMap((comment) => comment ? [comment] : [])
    const removedComments = visibleComments.filter((comment) => Boolean(comment.circleRemovedAt)).map((comment) => ({
      kind: 'comment' as const,
      id: comment._id,
      body: comment.body,
      removedAt: comment.circleRemovedAt!,
    }))
    return [...removedPosts, ...removedComments].sort((left, right) => right.removedAt - left.removedAt)
  },
})

export const create = mutation({
  args: {
    slug: v.string(), name: v.string(), purpose: v.string(), category: v.string(), rules: v.array(v.string()),
    mode: v.union(v.literal('online'), v.literal('in_person'), v.literal('both')),
    approximateArea: v.optional(v.string()),
    discoverability: v.optional(discoverabilityValidator),
    discussionVisibility: v.optional(discussionVisibilityValidator),
    memberListVisibility: v.optional(memberListVisibilityValidator),
    joinPolicy: v.optional(joinPolicyValidator),
  },
  handler: async (ctx, args) => {
    const creator = await requireViewer(ctx)
    if (!isCircleParticipantRole(creator.role)) throw new Error('Circle participation requires an eligible account role')
    assertTrustedCircleRoleEligibility(creator, 'host')
    const slug = normalizeSlug(args.slug)
    if (!slug) throw new Error('Circle slug is required')
    if (slug.length > 60) throw new Error('Circle slug is too long')
    if (await ctx.db.query('circles').withIndex('by_slug', (q) => q.eq('slug', slug)).unique()) throw new Error('Circle slug is already taken')
    const details = circleMetadata(args)
    const settings = parseCircleSettings(args)
    const now = Date.now()
    // Convex commits the Circle and its sole initial host membership as one
    // ownership unit, so a creator can never be left with a hostless Circle.
    const circleId = await ctx.db.insert('circles', {
      slug, ...details, mode: args.mode, state: 'active', ...settings, hostUserId: creator._id,
      createdByUserId: creator._id, createdAt: now, updatedAt: now,
    })
    await ctx.db.insert('circleMemberships', {
      circleId, userId: creator._id, state: 'active', role: 'host', rulesAcceptedAt: now,
      decidedByUserId: creator._id, decidedAt: now, createdAt: now, updatedAt: now,
    })
    await writeAudit(ctx, { actorUserId: creator._id, action: 'circle.created', targetType: 'circle', targetId: String(circleId), after: { hostUserId: creator._id } })
    return circleId
  },
})

export const edit = mutation({
  args: {
    circleId: v.id('circles'), name: v.string(), purpose: v.string(), category: v.string(), rules: v.array(v.string()),
    mode: v.union(v.literal('online'), v.literal('in_person'), v.literal('both')), approximateArea: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireHostOrFullAdmin(ctx, args.circleId)
    if (!access.isCircleHost) throw new Error('Circle metadata is managed by its host')
    if (access.circle.state !== 'active') throw new Error('Active Circle required')
    const details = circleMetadata(args)
    const before = { name: access.circle.name, purpose: access.circle.purpose, category: access.circle.category, rules: access.circle.rules, mode: access.circle.mode, approximateArea: access.circle.approximateArea }
    const after = { ...details, mode: args.mode }
    await ctx.db.patch(access.circle._id, { ...after, updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: 'circle.edited', targetType: 'circle', targetId: String(access.circle._id), before, after })
  },
})

export const updateSettings = mutation({
  args: {
    circleId: v.id('circles'),
    discoverability: discoverabilityValidator,
    discussionVisibility: discussionVisibilityValidator,
    memberListVisibility: memberListVisibilityValidator,
    joinPolicy: joinPolicyValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireHostOrFullAdmin(ctx, args.circleId)
    if (!access.isCircleHost) throw new Error('Circle privacy settings are managed by its host')
    if (access.circle.state !== 'active') throw new Error('Active Circle required')
    const before = resolveCircleSettings(access.circle)
    const after = parseCircleSettings(args)
    await ctx.db.patch(access.circle._id, { ...after, updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: 'circle.settings_updated', targetType: 'circle', targetId: String(access.circle._id), before, after })
    return after
  },
})

export const generateCircleImageUploadUrl = mutation({
  args: { circleId: v.id('circles'), kind: v.union(v.literal('icon'), v.literal('cover')) },
  handler: async (ctx, args) => {
    const access = await requireHostOrFullAdmin(ctx, args.circleId)
    if (!access.isCircleHost) throw new Error('Circle images are managed by its host')
    if (access.circle.state !== 'active') throw new Error('Active Circle required')
    return await ctx.storage.generateUploadUrl()
  },
})

export const setCircleImage = mutation({
  args: { circleId: v.id('circles'), kind: v.union(v.literal('icon'), v.literal('cover')), storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const access = await requireHostOrFullAdmin(ctx, args.circleId)
    if (!access.isCircleHost) throw new Error('Circle images are managed by its host')
    if (access.circle.state !== 'active') throw new Error('Active Circle required')
    await requireCircleImageStorage(ctx, args.storageId)
    const field = args.kind === 'icon' ? 'iconStorageId' : 'coverStorageId'
    const previous = access.circle[field]
    if (previous === args.storageId) throw new Error('Circle image is already attached')
    // Validation runs before any write, so a rejected upload leaves the
    // Circle and both storage objects untouched.
    await ctx.db.patch(access.circle._id, { [field]: args.storageId, updatedAt: Date.now() })
    if (previous) await ctx.storage.delete(previous)
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: `circle.${args.kind}_updated`, targetType: 'circle', targetId: String(access.circle._id) })
  },
})

export const removeCircleImage = mutation({
  args: { circleId: v.id('circles'), kind: v.union(v.literal('icon'), v.literal('cover')) },
  handler: async (ctx, args) => {
    const access = await requireHostOrFullAdmin(ctx, args.circleId)
    if (!access.isCircleHost) throw new Error('Circle images are managed by its host')
    if (access.circle.state !== 'active') throw new Error('Active Circle required')
    const field = args.kind === 'icon' ? 'iconStorageId' : 'coverStorageId'
    const previous = access.circle[field]
    if (!previous) throw new Error('Circle has no image to remove')
    await ctx.db.patch(access.circle._id, { [field]: undefined, updatedAt: Date.now() })
    await ctx.storage.delete(previous)
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: `circle.${args.kind}_removed`, targetType: 'circle', targetId: String(access.circle._id) })
  },
})

export const requestToJoin = mutation({
  args: { circleId: v.id('circles'), rulesAcknowledged: v.boolean() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (!isCircleParticipantRole(viewer.role)) throw new Error('Circle participation requires an eligible account role')
    if (!args.rulesAcknowledged) throw new Error('Circle rules must be acknowledged')
    const circle = await ctx.db.get(args.circleId)
    if (!circle || circle.state !== 'active') throw new Error('Circle is unavailable')
    const existing = await membership(ctx, args.circleId, viewer._id)
    if (existing?.state === 'banned') throw new Error('You are banned from this Circle')
    if (existing?.state === 'active' || existing?.state === 'requested') throw new Error('Circle membership already exists')
    const now = Date.now()
    // Open Circles admit a rules-acknowledging eligible outsider as an active
    // member in the same transaction. Approval Circles keep the request and
    // host-or-moderator decision flow.
    if (resolveCircleSettings(circle).joinPolicy === 'open') {
      const membershipId = existing
        ? (await ctx.db.patch(existing._id, { state: 'active', role: 'member', rulesAcceptedAt: now, decidedByUserId: viewer._id, decidedAt: now, mutedAt: undefined, updatedAt: now }), existing._id)
        : await ctx.db.insert('circleMemberships', { circleId: args.circleId, userId: viewer._id, state: 'active', role: 'member', rulesAcceptedAt: now, decidedByUserId: viewer._id, decidedAt: now, createdAt: now, updatedAt: now })
      await writeAudit(ctx, { actorUserId: viewer._id, action: 'circle.joined', targetType: 'circleMembership', targetId: String(membershipId), after: { circleId: args.circleId, joinPolicy: 'open' } })
      return membershipId
    }
    const membershipId = existing
      ? (await ctx.db.patch(existing._id, { state: 'requested', role: 'member', rulesAcceptedAt: now, decidedAt: undefined, decidedByUserId: undefined, mutedAt: undefined, updatedAt: now }), existing._id)
      : await ctx.db.insert('circleMemberships', { circleId: args.circleId, userId: viewer._id, state: 'requested', role: 'member', rulesAcceptedAt: now, createdAt: now, updatedAt: now })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'circle.join_requested', targetType: 'circleMembership', targetId: String(membershipId), after: { circleId: args.circleId } })
    const leaders = await ctx.db.query('circleMemberships').withIndex('by_circle_state', (q) => q.eq('circleId', args.circleId).eq('state', 'active')).collect()
    await Promise.all(leaders.filter((leader) => leader.role === 'host' || leader.role === 'moderator').map((leader) => createNotification(ctx, {
      recipientUserId: leader.userId, actorUserId: viewer._id, kind: 'circle_join_requested', priority: 'standard', circleId: args.circleId,
      dedupeKey: `circle-join-request:${membershipId}:${now}:${leader.userId}`,
    })))
    return membershipId
  },
})

export const cancelJoinRequest = mutation({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const circle = await ctx.db.get(args.circleId)
    if (!circle || circle.state !== 'active') throw new Error('Circle is unavailable')
    const row = await membership(ctx, args.circleId, viewer._id)
    if (!row || row.state !== 'requested') throw new Error('Pending Circle request required')
    await ctx.db.patch(row._id, { state: 'left', updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'circle.join_request_cancelled', targetType: 'circleMembership', targetId: String(row._id), before: { state: 'requested' }, after: { state: 'left' } })
  },
})

export const decideJoinRequest = mutation({
  args: { membershipId: v.id('circleMemberships'), decision: v.union(v.literal('approve'), v.literal('reject')) },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.membershipId)
    if (!row || row.state !== 'requested') throw new Error('Pending Circle request required')
    const access = await requireCircleModerator(ctx, row.circleId)
    if (args.decision === 'approve') {
      const applicant = await ctx.db.get(row.userId)
      if (!applicant || applicant.suspended || !isCircleParticipantRole(applicant.role)) throw new Error('Circle participation requires an eligible account role')
    }
    const state = args.decision === 'approve' ? 'active' : 'rejected'
    const now = Date.now()
    await ctx.db.patch(row._id, { state, role: 'member', decidedByUserId: access.viewer._id, decidedAt: now, updatedAt: now })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: `circle.join_${args.decision === 'approve' ? 'approved' : 'rejected'}`, targetType: 'circleMembership', targetId: String(row._id), before: { state: 'requested' }, after: { state } })
    await createNotification(ctx, {
      recipientUserId: row.userId, actorUserId: access.viewer._id,
      kind: args.decision === 'approve' ? 'circle_join_approved' : 'circle_join_rejected',
      priority: args.decision === 'approve' ? 'standard' : 'attention', circleId: row.circleId,
      dedupeKey: `circle-join-${args.decision}:${row._id}:${now}`,
    })
  },
})

export const moderateMember = mutation({
  args: { membershipId: v.id('circleMemberships'), action: v.union(v.literal('remove'), v.literal('ban')) },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.membershipId)
    if (!target || target.state !== 'active') throw new Error('Active Circle member required')
    const access = await requireCircleModerator(ctx, target.circleId)
    if (target.role !== 'member') throw new Error('Circle moderators cannot act on trusted roles')
    if (target.userId === access.viewer._id) throw new Error('Use the leave action for your own membership')
    const state = args.action === 'ban' ? 'banned' : 'removed'
    const now = Date.now()
    await ctx.db.patch(target._id, { state, mutedAt: undefined, decidedByUserId: access.viewer._id, decidedAt: now, updatedAt: now })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: `circle.member_${args.action === 'ban' ? 'banned' : 'removed'}`, targetType: 'circleMembership', targetId: String(target._id), before: { state: 'active' }, after: { state } })
    await createNotification(ctx, {
      recipientUserId: target.userId, actorUserId: access.viewer._id,
      kind: args.action === 'ban' ? 'circle_member_banned' : 'circle_member_removed', priority: 'attention', circleId: target.circleId,
      dedupeKey: `circle-member-${args.action}:${target._id}:${now}`,
    })
  },
})

export const setModerator = mutation({
  args: { membershipId: v.id('circleMemberships'), moderator: v.boolean() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.membershipId)
    if (!row || row.state !== 'active') throw new Error('Active Circle member required')
    const access = await requireCircleHost(ctx, row.circleId)
    const circle = access.circle
    if (circle.state !== 'active') throw new Error('Active Circle required')
    if (row.role === 'host') throw new Error('The Circle host role cannot be changed here')
    const user = await ctx.db.get(row.userId)
    if (!user) throw new Error('Member not found')
    const role = args.moderator ? 'moderator' : 'member'
    if (row.role === role) throw new Error(`Member is already a ${role}`)
    assertTrustedCircleRoleEligibility(user, role)
    await ctx.db.patch(row._id, { role, updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: `circle.moderator_${args.moderator ? 'granted' : 'revoked'}`, targetType: 'circleMembership', targetId: String(row._id), before: { role: row.role }, after: { role } })
    await createNotification(ctx, { recipientUserId: row.userId, actorUserId: access.viewer._id, kind: 'circle_role_changed', priority: 'attention', circleId: row.circleId, dedupeKey: `circle-role:${row._id}:${role}:${Date.now()}` })
  },
})

export const leave = mutation({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const access = await requireCircleMember(ctx, args.circleId)
    if (!access.membership) throw new Error('Active Circle membership required')
    if (access.circle.hostUserId === access.viewer._id || access.membership.role === 'host') throw new Error('The Circle host must transfer the host role before leaving')
    await ctx.db.patch(access.membership._id, { state: 'left', role: 'member', mutedAt: undefined, updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: 'circle.member_left', targetType: 'circleMembership', targetId: String(access.membership._id), before: { state: 'active', role: access.membership.role }, after: { state: 'left', role: 'member' } })
  },
})

export const setMuted = mutation({
  args: { circleId: v.id('circles'), muted: v.boolean() },
  handler: async (ctx, args) => {
    const access = await requireCircleMember(ctx, args.circleId)
    if (!access.membership) throw new Error('Active Circle membership required')
    if (Boolean(access.membership.mutedAt) === args.muted) throw new Error(`Circle is already ${args.muted ? 'muted' : 'unmuted'}`)
    await ctx.db.patch(access.membership._id, { mutedAt: args.muted ? Date.now() : undefined, updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: `circle.${args.muted ? 'muted' : 'unmuted'}`, targetType: 'circleMembership', targetId: String(access.membership._id) })
  },
})

export const initiateHostTransfer = mutation({
  args: { circleId: v.id('circles'), recipientUserId: v.id('users') },
  handler: async (ctx, args) => {
    const access = await requireCircleHost(ctx, args.circleId)
    const circle = access.circle
    if (circle.state !== 'active') throw new Error('Active Circle required')
    if (circle.pendingHostUserId) throw new Error('A host transfer is already pending')
    if (circle.hostUserId === args.recipientUserId) throw new Error('Recipient is already the Circle host')
    const recipient = await ctx.db.get(args.recipientUserId)
    if (!recipient) throw new Error('Recipient not found')
    assertTrustedCircleRoleEligibility(recipient, 'host')
    const recipientMembership = await membership(ctx, circle._id, recipient._id)
    if (!recipientMembership || recipientMembership.state !== 'active') throw new Error('Recipient must be an active Circle member')
    const now = Date.now()
    await ctx.db.patch(circle._id, { pendingHostUserId: recipient._id, hostTransferInitiatedByUserId: access.viewer._id, hostTransferInitiatedAt: now, updatedAt: now })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: 'circle.host_transfer_initiated', targetType: 'circle', targetId: String(circle._id), after: { recipientUserId: recipient._id } })
    await createNotification(ctx, { recipientUserId: recipient._id, actorUserId: access.viewer._id, kind: 'circle_host_transfer', priority: 'attention', circleId: circle._id, dedupeKey: `circle-host-transfer:init:${circle._id}:${now}` })
  },
})

export const acceptHostTransfer = mutation({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const recipient = await requireViewer(ctx)
    const circle = await ctx.db.get(args.circleId)
    if (!circle || circle.state !== 'active') throw new Error('Active Circle required')
    if (circle.pendingHostUserId !== recipient._id) throw new Error('No host transfer is pending for this member')
    assertTrustedCircleRoleEligibility(recipient, 'host')
    const [currentHostMembership, recipientMembership] = await Promise.all([membership(ctx, circle._id, circle.hostUserId), membership(ctx, circle._id, recipient._id)])
    if (!currentHostMembership || currentHostMembership.state !== 'active' || currentHostMembership.role !== 'host') throw new Error('Circle host invariant is invalid')
    if (!recipientMembership || recipientMembership.state !== 'active') throw new Error('Recipient must be an active Circle member')
    const now = Date.now()
    // Convex commits all three patches and the audit together. A failed check
    // leaves the canonical host and both role rows untouched.
    await ctx.db.patch(currentHostMembership._id, { role: 'member', updatedAt: now })
    await ctx.db.patch(recipientMembership._id, { role: 'host', updatedAt: now })
    await ctx.db.patch(circle._id, { hostUserId: recipient._id, pendingHostUserId: undefined, hostTransferInitiatedByUserId: undefined, hostTransferInitiatedAt: undefined, updatedAt: now })
    await writeAudit(ctx, { actorUserId: recipient._id, action: 'circle.host_transfer_accepted', targetType: 'circle', targetId: String(circle._id), before: { hostUserId: circle.hostUserId }, after: { hostUserId: recipient._id } })
    await createNotification(ctx, { recipientUserId: circle.hostUserId, actorUserId: recipient._id, kind: 'circle_host_transfer', priority: 'attention', circleId: circle._id, dedupeKey: `circle-host-transfer:accepted:${circle._id}:${now}` })
  },
})

export const cancelHostTransfer = mutation({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const access = await requireHostOrFullAdmin(ctx, args.circleId)
    const circle = access.circle
    if (circle.state !== 'active' && !access.isFullAdmin) throw new Error('Active Circle required')
    if (!circle.pendingHostUserId) throw new Error('No host transfer is pending')
    const recipientUserId = circle.pendingHostUserId
    await ctx.db.patch(circle._id, {
      pendingHostUserId: undefined,
      hostTransferInitiatedByUserId: undefined,
      hostTransferInitiatedAt: undefined,
      updatedAt: Date.now(),
    })
    await writeAudit(ctx, {
      actorUserId: access.viewer._id,
      action: 'circle.host_transfer_cancelled',
      targetType: 'circle',
      targetId: String(circle._id),
      before: { recipientUserId },
    })
    await createNotification(ctx, { recipientUserId, actorUserId: access.viewer._id, kind: 'circle_host_transfer', priority: 'attention', circleId: circle._id, dedupeKey: `circle-host-transfer:cancelled:${circle._id}:${Date.now()}` })
  },
})

export const unbanMember = mutation({
  args: { membershipId: v.id('circleMemberships') },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.membershipId)
    if (!row || row.state !== 'banned') throw new Error('Banned Circle member required')
    const access = await requireCircleHost(ctx, row.circleId)
    if (access.circle.state !== 'active') throw new Error('Active Circle required')
    const now = Date.now()
    await ctx.db.patch(row._id, { state: 'removed', role: 'member', decidedByUserId: access.viewer._id, decidedAt: now, updatedAt: now })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: 'circle.member_unbanned', targetType: 'circleMembership', targetId: String(row._id), before: { state: 'banned' }, after: { state: 'removed' } })
  },
})

export const pinPost = mutation({
  args: { circleId: v.id('circles'), postId: v.id('posts') },
  handler: async (ctx, args) => {
    const access = await requireCircleModerator(ctx, args.circleId)
    const post = await ctx.db.get(args.postId)
    if (!post || post.circleId !== args.circleId || post.hidden || post.deletedAt || post.circleRemovedAt) throw new Error('Circle post not found')
    const existing = await ctx.db.query('circlePins').withIndex('by_circle_post', (q) => q.eq('circleId', args.circleId).eq('postId', args.postId)).unique()
    if (existing) throw new Error('Circle post is already pinned')
    const current = await ctx.db.query('circlePins').withIndex('by_circle', (q) => q.eq('circleId', args.circleId)).collect()
    const pinId = await ctx.db.insert('circlePins', { circleId: args.circleId, postId: args.postId, pinnedByUserId: access.viewer._id, position: current.length, createdAt: Date.now() })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: 'circle.post_pinned', targetType: 'post', targetId: String(args.postId) })
    return pinId
  },
})

export const pinnedPosts = query({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const access = await requireCircleDiscussionRead(ctx, args.circleId)
    if (access.circle.state === 'suspended') throw new Error('Circle is suspended')
    const pins = await ctx.db.query('circlePins').withIndex('by_circle', (q) => q.eq('circleId', args.circleId)).collect()
    const ordered = pins.sort((left, right) => left.position - right.position)
    const visible = []
    for (const pin of ordered) {
      const post = await ctx.db.get(pin.postId)
      if (!post || post.circleId !== args.circleId || post.hidden || post.deletedAt || post.circleRemovedAt) continue
      const author = await ctx.db.get(post.authorId)
      visible.push({
        _id: post._id,
        body: post.body,
        createdAt: post.createdAt,
        authorDisplayName: author?.displayName ?? 'Circle member',
      })
    }
    return visible
  },
})

export const unpinPost = mutation({
  args: { circleId: v.id('circles'), postId: v.id('posts') },
  handler: async (ctx, args) => {
    const access = await requireCircleModerator(ctx, args.circleId)
    const pin = await ctx.db.query('circlePins').withIndex('by_circle_post', (q) => q.eq('circleId', args.circleId).eq('postId', args.postId)).unique()
    if (!pin) throw new Error('Pinned Circle post not found')
    await ctx.db.delete(pin._id)
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: 'circle.post_unpinned', targetType: 'post', targetId: String(args.postId) })
  },
})

export const setPostRemoved = mutation({
  args: { postId: v.id('posts'), removed: v.boolean() },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId)
    if (!post?.circleId) throw new Error('Circle post not found')
    const access = await requireCircleModerator(ctx, post.circleId)
    if (Boolean(post.circleRemovedAt) === args.removed) throw new Error(`Circle post is already ${args.removed ? 'removed' : 'available'}`)
    await ctx.db.patch(post._id, { circleRemovedAt: args.removed ? Date.now() : undefined, circleRemovedByUserId: args.removed ? access.viewer._id : undefined, updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: `circle.post_${args.removed ? 'removed' : 'restored'}`, targetType: 'post', targetId: String(post._id) })
  },
})

export const setCommentRemoved = mutation({
  args: { commentId: v.id('postComments'), removed: v.boolean() },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId)
    if (!comment || comment.hidden) throw new Error('Circle comment not found')
    const post = await ctx.db.get(comment.postId)
    if (!post?.circleId || post.hidden || post.deletedAt || post.circleRemovedAt) throw new Error('Circle comment not found')
    const access = await requireCircleModerator(ctx, post.circleId)
    if (Boolean(comment.circleRemovedAt) === args.removed) throw new Error(`Circle comment is already ${args.removed ? 'removed' : 'available'}`)
    await ctx.db.patch(comment._id, { circleRemovedAt: args.removed ? Date.now() : undefined, circleRemovedByUserId: args.removed ? access.viewer._id : undefined, updatedAt: Date.now() })
    await ctx.db.patch(post._id, { commentCount: adjustCounter(post.commentCount, args.removed ? -1 : 1) })
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: `circle.comment_${args.removed ? 'removed' : 'restored'}`, targetType: 'comment', targetId: String(comment._id) })
  },
})

export const setState = mutation({
  args: { circleId: v.id('circles'), state: v.union(v.literal('active'), v.literal('archived'), v.literal('suspended')) },
  handler: async (ctx, args) => {
    const access = await requireHostOrFullAdmin(ctx, args.circleId)
    const circle = access.circle
    if (circle.state === args.state) throw new Error(`Circle is already ${args.state}`)
    // Voluntary archive cycles belong to the host. Suspension and recovery
    // remain platform safety controls even though the Circle is user-owned.
    const platformLifecycleAction = args.state === 'suspended' || circle.state === 'suspended'
    if (platformLifecycleAction && !access.isFullAdmin) throw new Error(args.state === 'suspended' ? 'Full admin role required to suspend a Circle' : 'Full admin role required to reactivate a suspended Circle')
    if (!platformLifecycleAction && !access.isCircleHost) {
      if (access.isFullAdmin) throw new Error('Full admins may only suspend or reactivate a suspended Circle')
      throw new Error('Circle archive controls are available only to its host')
    }
    if (!platformLifecycleAction && !(
      (circle.state === 'active' && args.state === 'archived')
      || (circle.state === 'archived' && args.state === 'active')
    )) throw new Error('Circle hosts may archive or reactivate their Circle')
    const nextState = access.isFullAdmin && circle.state === 'suspended' && args.state === 'active'
      ? circle.preSuspensionState ?? 'active'
      : args.state
    await ctx.db.patch(circle._id, {
      state: nextState,
      preSuspensionState: access.isFullAdmin && args.state === 'suspended' ? circle.state as 'active' | 'archived' : undefined,
      updatedAt: Date.now(),
    })
    const action = args.state === 'active' ? 'reactivated' : args.state
    await writeAudit(ctx, { actorUserId: access.viewer._id, action: `circle.${action}`, targetType: 'circle', targetId: String(circle._id), before: { state: circle.state }, after: { state: nextState } })
    const members = await ctx.db.query('circleMemberships').withIndex('by_circle_state', (q) => q.eq('circleId', circle._id).eq('state', 'active')).collect()
    await Promise.all(members.map((row) => createNotification(ctx, {
      recipientUserId: row.userId, actorUserId: access.viewer._id, kind: 'circle_lifecycle', priority: 'attention', circleId: circle._id,
      dedupeKey: `circle-lifecycle:${circle._id}:${nextState}:${Date.now()}:${row.userId}`,
    })))
  },
})

export const emergencyRecoverHost = mutation({
  args: { circleId: v.id('circles'), recipientUserId: v.id('users'), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireFullAdmin(ctx)
    const reason = args.reason.trim()
    if (!reason) throw new Error('Emergency recovery requires an internal reason')
    const circle = await ctx.db.get(args.circleId)
    if (!circle) throw new Error('Circle not found')
    if (circle.hostUserId === args.recipientUserId) throw new Error('Recipient is already the Circle host')
    const [recipient, rows] = await Promise.all([
      ctx.db.get(args.recipientUserId),
      ctx.db.query('circleMemberships').withIndex('by_circle', (q) => q.eq('circleId', circle._id)).collect(),
    ])
    if (!recipient) throw new Error('Recipient not found')
    assertTrustedCircleRoleEligibility(recipient, 'host')
    const recipientMembership = rows.find((row) => row.userId === recipient._id)
    if (!recipientMembership || recipientMembership.state !== 'active') throw new Error('Recipient must be an active Circle member')
    const currentHostMembership = rows.find((row) => row.userId === circle.hostUserId)
    const now = Date.now()
    // Recovery rewrites every stale active host row in the same transaction.
    // The recipient is the only host if this mutation commits.
    await Promise.all(rows
      .filter((row) => row.state === 'active' && row.role === 'host' && row._id !== recipientMembership._id)
      .map((row) => ctx.db.patch(row._id, { role: 'member', updatedAt: now })))
    await ctx.db.patch(recipientMembership._id, { role: 'host', updatedAt: now })
    await ctx.db.patch(circle._id, {
      hostUserId: recipient._id,
      pendingHostUserId: undefined,
      hostTransferInitiatedByUserId: undefined,
      hostTransferInitiatedAt: undefined,
      updatedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: admin._id,
      action: 'circle.host_emergency_recovered',
      targetType: 'circle',
      targetId: String(circle._id),
      before: { hostUserId: circle.hostUserId, pendingHostUserId: circle.pendingHostUserId },
      after: { hostUserId: recipient._id },
      note: reason,
    })
    const affectedUserIds = new Set([circle.hostUserId, recipient._id, circle.pendingHostUserId].filter((id): id is Id<'users'> => Boolean(id)))
    await Promise.all([...affectedUserIds].map((userId) => createNotification(ctx, {
      recipientUserId: userId,
      actorUserId: admin._id,
      kind: 'circle_host_transfer',
      priority: 'attention',
      circleId: circle._id,
      dedupeKey: `circle-host-recovery:${circle._id}:${now}:${userId}`,
    })))
    return { previousHostMembershipId: currentHostMembership?._id }
  },
})

export const myAccess = query({
  args: { circleId: v.id('circles') },
  handler: async (ctx, args) => {
    const access = await getCircleAuthorization(ctx, args.circleId)
    if (access.circle.state === 'suspended') throw new Error('Circle is suspended')
    return {
      state: access.circle.state, membershipState: access.membership?.state ?? null, role: access.membership?.role ?? null,
      muted: Boolean(access.membership?.mutedAt), canPreview: access.canPreview, canRead: access.canRead,
      canReadDiscussion: access.canReadDiscussion, canReadMembers: access.canReadMembers,
      settings: access.settings,
      canWrite: access.canWrite, canModerate: access.canModerate, isHost: access.isHost,
    }
  },
})
