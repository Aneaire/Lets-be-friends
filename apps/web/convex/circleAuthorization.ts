import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { hasCurrentIdentityApproval } from './identityVerification'
import { requireViewer } from './lib'

type CircleCtx = Pick<QueryCtx | MutationCtx, 'auth' | 'db'>
type CircleRole = Doc<'circleMemberships'>['role']

export type CircleSettings = {
  discoverability: 'listed' | 'unlisted'
  discussionVisibility: 'members_only' | 'signed_in'
  memberListVisibility: 'members_only' | 'signed_in'
  joinPolicy: 'approval_required' | 'open'
}

export function resolveCircleSettings(circle: Pick<Doc<'circles'>, 'discoverability' | 'discussionVisibility' | 'memberListVisibility' | 'joinPolicy'>): CircleSettings {
  return {
    discoverability: circle.discoverability ?? 'listed',
    discussionVisibility: circle.discussionVisibility ?? 'members_only',
    memberListVisibility: circle.memberListVisibility ?? 'members_only',
    joinPolicy: circle.joinPolicy ?? 'approval_required',
  }
}

export type CircleAuthorization = {
  viewer: Doc<'users'>
  circle: Doc<'circles'>
  membership: Doc<'circleMemberships'> | null
  settings: CircleSettings
  canPreview: boolean
  canRead: boolean
  canWrite: boolean
  canModerate: boolean
  isHost: boolean
  canReadDiscussion: boolean
  canReadMembers: boolean
}

export function isFullAdminRole(role: Doc<'users'>['role']) {
  return role === 'admin' || role === 'owner'
}

export function isCircleParticipantRole(role: Doc<'users'>['role']) {
  return role === 'member' || role === 'companion' || role === 'admin' || role === 'owner'
}

export function isTrustedCircleRole(role: CircleRole) {
  return role === 'moderator' || role === 'host'
}

export function assertTrustedCircleRoleEligibility(user: Doc<'users'>, role: CircleRole, now = Date.now()) {
  if (!isTrustedCircleRole(role)) return
  if (!isCircleParticipantRole(user.role)) throw new Error('Circle participation requires an eligible account role')
  if (user.suspended) throw new Error('A suspended account cannot hold a trusted Circle role')
  if (!hasCurrentIdentityApproval(user, now)) throw new Error('A current identity approval is required for this Circle role')
}

export async function getCircleAuthorization(ctx: CircleCtx, circleId: Id<'circles'>): Promise<CircleAuthorization> {
  const viewer = await requireViewer(ctx)
  const circle = await ctx.db.get(circleId)
  if (!circle) throw new Error('Circle not found')
  const membership = await ctx.db
    .query('circleMemberships')
    .withIndex('by_circle_user', (q) => q.eq('circleId', circleId).eq('userId', viewer._id))
    .unique()
  // Circle participation is opt-in through membership. Platform safety powers
  // remain separate and do not themselves grant access to this audience.
  const isActiveMember = membership?.state === 'active' && isCircleParticipantRole(viewer.role)
  const trustedRoleIsCurrent = Boolean(
    membership
    && isTrustedCircleRole(membership.role)
    && hasCurrentIdentityApproval(viewer),
  )

  // Archived content stays available to existing members. Suspended Circles are
  // available only through separate platform-moderation entry points.
  const settings = resolveCircleSettings(circle)
  // Public (signed_in) visibility admits any signed-in viewer whose account
  // role may participate in Circles. Anonymous callers never reach this
  // helper because requireViewer rejects them. Circle-banned viewers remain
  // excluded even from public reads, and reviewers never qualify.
  const eligibleOutsider = isCircleParticipantRole(viewer.role) && membership?.state !== 'banned'
  const canReadDiscussion = (circle.state !== 'suspended' && isActiveMember)
    || (circle.state === 'active' && settings.discussionVisibility === 'signed_in' && eligibleOutsider)
  const canReadMembers = (circle.state !== 'suspended' && isActiveMember)
    || (circle.state === 'active' && settings.memberListVisibility === 'signed_in' && eligibleOutsider)
  return {
    viewer,
    circle,
    membership,
    settings,
    canPreview: circle.state === 'active' || (circle.state === 'archived' && isActiveMember),
    canRead: circle.state !== 'suspended' && isActiveMember,
    canWrite: circle.state === 'active' && isActiveMember,
    canModerate: circle.state === 'active' && isActiveMember && trustedRoleIsCurrent,
    isHost: circle.state === 'active'
      && isActiveMember
      && membership?.role === 'host'
      && circle.hostUserId === viewer._id
      && trustedRoleIsCurrent,
    canReadDiscussion,
    canReadMembers,
  }
}

export async function requireCirclePreview(ctx: CircleCtx, circleId: Id<'circles'>) {
  const access = await getCircleAuthorization(ctx, circleId)
  if (!access.canPreview) throw new Error(access.circle.state === 'suspended' ? 'Circle is suspended' : 'Circle is unavailable')
  return access
}

export async function requireCircleMember(ctx: CircleCtx, circleId: Id<'circles'>) {
  const access = await getCircleAuthorization(ctx, circleId)
  if (!access.canRead) throw new Error(access.circle.state === 'suspended' ? 'Circle is suspended' : 'Active Circle membership required')
  return access
}

export async function requireCircleWrite(ctx: CircleCtx, circleId: Id<'circles'>) {
  const access = await requireCircleMember(ctx, circleId)
  if (!access.canWrite) throw new Error('Circle is read-only')
  return access
}

export async function requireCircleModerator(ctx: CircleCtx, circleId: Id<'circles'>) {
  const access = await requireCircleWrite(ctx, circleId)
  if (!access.canModerate) throw new Error('Verified Circle moderator role required')
  return access
}

export async function requireCircleHost(ctx: CircleCtx, circleId: Id<'circles'>) {
  const access = await requireCircleModerator(ctx, circleId)
  if (!access.isHost) throw new Error('Verified Circle host role required')
  return access
}

export async function requirePostAudienceRead(ctx: CircleCtx, post: Pick<Doc<'posts'>, 'circleId'>) {
  if (!post.circleId) return null
  const access = await getCircleAuthorization(ctx, post.circleId)
  // Public discussion visibility admits eligible signed-in outsiders to read
  // visible posts. Writes, moderation, removed content, and block or
  // suspension boundaries are enforced separately by the caller.
  if (!access.canReadDiscussion) throw new Error(access.circle.state === 'suspended' ? 'Circle is suspended' : 'Active Circle membership required')
  return access
}

export async function requireCircleDiscussionRead(ctx: CircleCtx, circleId: Id<'circles'>) {
  const access = await getCircleAuthorization(ctx, circleId)
  if (!access.canReadDiscussion) throw new Error(access.circle.state === 'suspended' ? 'Circle is suspended' : 'Active Circle membership required')
  return access
}

export async function requireCircleMemberListRead(ctx: CircleCtx, circleId: Id<'circles'>) {
  const access = await getCircleAuthorization(ctx, circleId)
  if (!access.canReadMembers) throw new Error(access.circle.state === 'suspended' ? 'Circle is suspended' : 'Active Circle membership required')
  return access
}

export async function requirePostAudienceWrite(ctx: CircleCtx, post: Pick<Doc<'posts'>, 'circleId'>) {
  if (!post.circleId) return null
  return await requireCircleWrite(ctx, post.circleId)
}
