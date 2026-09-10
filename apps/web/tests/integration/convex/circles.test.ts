import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

type UserOptions = {
  role?: 'member' | 'companion' | 'admin' | 'owner' | 'reviewer'
  suspended?: boolean
  verified?: boolean
  expired?: boolean
}

async function insertUser(t: ReturnType<typeof convexTest>, subject: string, options: UserOptions = {}) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      role: options.role ?? 'member',
      verificationStatus: options.verified ? 'approved' : 'not_started',
      verificationSource: options.verified ? 'in_app' : undefined,
      identityVerifiedAt: options.verified ? now : undefined,
      identityExpiresAt: options.verified ? now + (options.expired ? -1 : 86_400_000) : undefined,
      suspended: options.suspended ?? false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function createCircle(
  t: ReturnType<typeof convexTest>,
  _adminSubject: string,
  hostUserId: Id<'users'>,
  slug = 'coffee-friends',
) {
  const host = await t.run(async (ctx) => ctx.db.get(hostUserId))
  if (!host) throw new Error('Test host not found')
  return await t.withIdentity({ subject: host.clerkUserId }).mutation(api.circles.create, {
    slug,
    name: 'Coffee Friends',
    purpose: 'Talk about coffee.',
    category: 'Coffee',
    rules: ['Be kind.'],
    mode: 'both',
    approximateArea: 'Cebu',
  })
}

async function insertMembership(
  t: ReturnType<typeof convexTest>,
  circleId: Id<'circles'>,
  userId: Id<'users'>,
  state: 'requested' | 'active' | 'rejected' | 'left' | 'removed' | 'banned',
  role: 'member' | 'moderator' | 'host' = 'member',
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('circleMemberships', {
      circleId,
      userId,
      state,
      role,
      rulesAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('Circle authorization foundation', () => {
  it('denies signed-out and suspended viewers', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const suspendedId = await insertUser(t, 'suspended', { suspended: true })
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, suspendedId, 'active')

    await expect(t.query(api.circles.myAccess, { circleId })).rejects.toThrow('Profile sync required')
    await expect(t.withIdentity({ subject: 'suspended' }).query(api.circles.myAccess, { circleId }))
      .rejects.toThrow('Account is suspended')
  })

  it.each(['requested', 'rejected', 'left', 'removed', 'banned'] as const)(
    'keeps a %s membership outside member-only content',
    async (state) => {
      const t = convexTest(schema, convexModules)
      await insertUser(t, 'admin', { role: 'admin' })
      const hostId = await insertUser(t, 'host', { verified: true })
      const memberId = await insertUser(t, `member-${state}`)
      const circleId = await createCircle(t, 'admin', hostId, `circle-${state}`)
      await insertMembership(t, circleId, memberId, state)

      await expect(t.withIdentity({ subject: `member-${state}` }).query(api.circles.myAccess, { circleId }))
        .resolves.toMatchObject({ membershipState: state, canPreview: true, canRead: false, canWrite: false })
    },
  )

  it('allows active members to read and write only while the Circle is active', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, memberId, 'active')
    const member = t.withIdentity({ subject: 'member' })

    await expect(member.query(api.circles.myAccess, { circleId }))
      .resolves.toMatchObject({ canPreview: true, canRead: true, canWrite: true })
    await t.run(async (ctx) => ctx.db.patch(circleId, { state: 'archived' }))
    await expect(member.query(api.circles.myAccess, { circleId }))
      .resolves.toMatchObject({ canPreview: true, canRead: true, canWrite: false })
    await t.run(async (ctx) => ctx.db.patch(circleId, { state: 'suspended' }))
    await expect(member.query(api.circles.myAccess, { circleId })).rejects.toThrow('Circle is suspended')
  })

  it('requires current identity approval for moderator and host authority', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const verifiedModeratorId = await insertUser(t, 'verified-moderator', { verified: true })
    const unverifiedModeratorId = await insertUser(t, 'unverified-moderator')
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, verifiedModeratorId, 'active', 'moderator')
    await insertMembership(t, circleId, unverifiedModeratorId, 'active', 'moderator')

    await expect(t.withIdentity({ subject: 'host' }).query(api.circles.myAccess, { circleId }))
      .resolves.toMatchObject({ canModerate: true, isHost: true })
    await expect(t.withIdentity({ subject: 'verified-moderator' }).query(api.circles.myAccess, { circleId }))
      .resolves.toMatchObject({ canModerate: true, isHost: false })
    await expect(t.withIdentity({ subject: 'unverified-moderator' }).query(api.circles.myAccess, { circleId }))
      .resolves.toMatchObject({ canRead: true, canModerate: false, isHost: false })
  })

  it('does not turn reviewer membership rows into Circle participation authority', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const reviewerId = await insertUser(t, 'reviewer', { role: 'reviewer', verified: true })
    const pendingReviewerId = await insertUser(t, 'pending-reviewer', { role: 'reviewer', verified: true })
    const circleId = await createCircle(t, 'admin', hostId)
    const reviewerMembershipId = await insertMembership(t, circleId, reviewerId, 'active')
    const pendingReviewerMembershipId = await insertMembership(t, circleId, pendingReviewerId, 'requested')
    const postId = await t.withIdentity({ subject: 'host' }).mutation(api.social.createPost, { body: 'Members only', circleId })
    await t.withIdentity({ subject: 'host' }).mutation(api.social.createComment, { postId, body: 'Private reply' })
    const reviewer = t.withIdentity({ subject: 'reviewer' })

    await expect(reviewer.query(api.circles.myAccess, { circleId })).resolves.toMatchObject({
      membershipState: 'active', canPreview: true, canRead: false, canWrite: false, canModerate: false, isHost: false,
    })
    await expect(reviewer.query(api.circles.mine, {})).resolves.toEqual([])
    await expect(reviewer.query(api.circles.members, { circleId })).rejects.toThrow('Active Circle membership required')
    expect((await t.withIdentity({ subject: 'host' }).query(api.circles.members, { circleId })).map((row) => row.userId)).not.toContain(reviewerId)
    expect(await t.withIdentity({ subject: 'host' }).query(api.circles.joinRequests, { circleId })).toEqual([])
    await expect(reviewer.query(api.social.circleFeed, { circleId, paginationOpts: { cursor: null, numItems: 10 } }))
      .rejects.toThrow('Active Circle membership required')
    await expect(reviewer.query(api.social.requestedPost, { postId: String(postId) })).rejects.toThrow('Active Circle membership required')
    await expect(reviewer.query(api.social.commentsForPost, { postId })).rejects.toThrow('Active Circle membership required')
    await expect(reviewer.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true }))
      .rejects.toThrow('Circle participation requires an eligible account role')
    await expect(t.withIdentity({ subject: 'host' }).mutation(api.circles.setModerator, { membershipId: reviewerMembershipId, moderator: true }))
      .rejects.toThrow('Circle participation requires an eligible account role')
    await expect(t.withIdentity({ subject: 'host' }).mutation(api.circles.decideJoinRequest, { membershipId: pendingReviewerMembershipId, decision: 'approve' }))
      .rejects.toThrow('Circle participation requires an eligible account role')
    expect((await t.run(async (ctx) => ctx.db.get(reviewerMembershipId)))?.role).toBe('member')
    expect((await t.run(async (ctx) => ctx.db.get(pendingReviewerMembershipId)))?.state).toBe('requested')
  })

  it('allows verified participant roles to create while rejecting ineligible creators without partial writes', async () => {
    const t = convexTest(schema, convexModules)
    const adminId = await insertUser(t, 'admin', { role: 'admin', verified: true })
    const ownerId = await insertUser(t, 'owner', { role: 'owner', verified: true })
    await insertUser(t, 'reviewer', { role: 'reviewer', verified: true })
    const unverifiedId = await insertUser(t, 'unverified')
    const unverifiedAdminId = await insertUser(t, 'unverified-admin', { role: 'admin' })
    const expiredOwnerId = await insertUser(t, 'expired-owner', { role: 'owner', verified: true, expired: true })
    const suspendedId = await insertUser(t, 'suspended', { verified: true, suspended: true })
    const memberId = await insertUser(t, 'member', { verified: true })
    const companionId = await insertUser(t, 'companion', { role: 'companion', verified: true })

    await expect(t.withIdentity({ subject: 'unverified' }).query(api.circles.creationEligibility, {}))
      .resolves.toEqual({ eligible: false, reason: 'verification_required' })
    await expect(t.withIdentity({ subject: 'reviewer' }).query(api.circles.creationEligibility, {}))
      .resolves.toEqual({ eligible: false, reason: 'role_required' })
    await expect(t.withIdentity({ subject: 'member' }).query(api.circles.creationEligibility, {}))
      .resolves.toEqual({ eligible: true, reason: null })
    await expect(t.withIdentity({ subject: 'admin' }).query(api.circles.creationEligibility, {}))
      .resolves.toEqual({ eligible: true, reason: null })
    await expect(t.withIdentity({ subject: 'owner' }).query(api.circles.creationEligibility, {}))
      .resolves.toEqual({ eligible: true, reason: null })

    await expect(createCircle(t, 'admin', unverifiedId, 'unverified')).rejects.toThrow('current identity approval')
    await expect(createCircle(t, 'admin', unverifiedAdminId, 'unverified-admin')).rejects.toThrow('current identity approval')
    await expect(createCircle(t, 'admin', expiredOwnerId, 'expired-owner')).rejects.toThrow('current identity approval')
    await expect(createCircle(t, 'admin', suspendedId, 'suspended')).rejects.toThrow('Account is suspended')
    await expect(t.withIdentity({ subject: 'reviewer' }).mutation(api.circles.create, {
      slug: 'reviewer-circle', name: 'Reviewer', purpose: 'No', category: 'No', rules: ['No'], mode: 'online',
    })).rejects.toThrow('Circle participation requires an eligible account role')
    await expect(createCircle(t, 'admin', memberId, 'member-circle')).resolves.toBeTruthy()
    await expect(createCircle(t, 'admin', companionId, 'companion-circle')).resolves.toBeTruthy()
    const adminCircleId = await createCircle(t, 'admin', adminId, 'admin-circle')
    const ownerCircleId = await createCircle(t, 'admin', ownerId, 'owner-circle')
    await expect(t.withIdentity({ subject: 'admin' }).query(api.circles.myAccess, { circleId: adminCircleId }))
      .resolves.toMatchObject({ canRead: true, canWrite: true, canModerate: true, isHost: true })
    await expect(t.withIdentity({ subject: 'owner' }).query(api.circles.myAccess, { circleId: ownerCircleId }))
      .resolves.toMatchObject({ canRead: true, canWrite: true, canModerate: true, isHost: true })
    await t.withIdentity({ subject: 'admin' }).mutation(api.circles.setState, { circleId: adminCircleId, state: 'archived' })
    await t.withIdentity({ subject: 'admin' }).mutation(api.circles.setState, { circleId: adminCircleId, state: 'active' })
    const snapshot = await t.run(async (ctx) => ({ circles: await ctx.db.query('circles').collect(), audits: await ctx.db.query('auditLogs').collect() }))
    expect(snapshot.circles).toHaveLength(4)
    expect(snapshot.circles.map((circle) => circle.hostUserId)).toEqual(expect.arrayContaining([memberId, companionId, adminId, ownerId]))
    expect(snapshot.audits.filter((row) => row.action === 'circle.created')).toHaveLength(4)
  })

  it('keeps full-admin recovery available after an admin host identity approval expires', async () => {
    const t = convexTest(schema, convexModules)
    const adminId = await insertUser(t, 'admin-host', { role: 'admin', verified: true })
    const recipientId = await insertUser(t, 'transfer-recipient', { verified: true })
    const circleId = await createCircle(t, 'admin-host', adminId, 'admin-host-circle')
    await insertMembership(t, circleId, recipientId, 'active')
    const admin = t.withIdentity({ subject: 'admin-host' })
    await admin.mutation(api.circles.initiateHostTransfer, { circleId, recipientUserId: recipientId })
    await t.run(async (ctx) => ctx.db.patch(adminId, { identityExpiresAt: Date.now() - 1, updatedAt: Date.now() }))

    await expect(admin.mutation(api.circles.edit, {
      circleId, name: 'Expired edit', purpose: 'Must fail.', category: 'Test', rules: ['Be kind.'], mode: 'online',
    })).rejects.toThrow('managed by its host')
    await expect(admin.mutation(api.circles.setState, { circleId, state: 'archived' }))
      .rejects.toThrow('only suspend or reactivate')
    await admin.mutation(api.circles.cancelHostTransfer, { circleId })
    await admin.mutation(api.circles.setState, { circleId, state: 'suspended' })
    await admin.mutation(api.circles.setState, { circleId, state: 'active' })

    const snapshot = await t.run(async (ctx) => ({ circle: await ctx.db.get(circleId), audits: await ctx.db.query('auditLogs').collect() }))
    expect(snapshot.circle).toMatchObject({ name: 'Coffee Friends', state: 'active', hostUserId: adminId })
    expect(snapshot.circle?.pendingHostUserId).toBeUndefined()
    expect(snapshot.audits.filter((row) => row.action === 'circle.edited')).toHaveLength(0)
    expect(snapshot.audits.filter((row) => row.action === 'circle.archived')).toHaveLength(0)
    expect(snapshot.audits.filter((row) => row.action === 'circle.host_transfer_cancelled')).toHaveLength(1)
    expect(snapshot.audits.filter((row) => row.action === 'circle.suspended')).toHaveLength(1)
    expect(snapshot.audits.filter((row) => row.action === 'circle.reactivated')).toHaveLength(1)
  })

  it('enforces normalized unique slugs and one membership row per Circle and user', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    const circleId = await createCircle(t, 'admin', hostId, 'Coffee Friends')

    await expect(createCircle(t, 'admin', hostId, 'coffee---friends')).rejects.toThrow('slug is already taken')
    const member = t.withIdentity({ subject: 'member' })
    await expect(member.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: false }))
      .rejects.toThrow('rules must be acknowledged')
    await expect(member.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true })).resolves.toBeTruthy()
    await expect(member.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true }))
      .rejects.toThrow('membership already exists')
  })

  it('creates one active host membership tied to the canonical host', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const circleId = await createCircle(t, 'admin', hostId)

    const result = await t.run(async (ctx) => ({
      circle: await ctx.db.get(circleId),
      memberships: await ctx.db.query('circleMemberships').withIndex('by_circle', (q) => q.eq('circleId', circleId)).collect(),
    }))
    expect(result.circle).toMatchObject({ hostUserId: hostId, createdByUserId: hostId })
    expect(result.memberships).toHaveLength(1)
    expect(result.memberships[0]).toMatchObject({ userId: hostId, state: 'active', role: 'host' })
  })

  it('returns safe active previews and keeps member data private', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const outsiderId = await insertUser(t, 'outsider')
    const memberId = await insertUser(t, 'inside-member')
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, memberId, 'active')
    const outsider = t.withIdentity({ subject: 'outsider' })

    const preview = await outsider.query(api.circles.preview, { circleId })
    expect(preview).toMatchObject({
      name: 'Coffee Friends',
      approximateArea: 'Cebu',
      memberCount: 2,
      host: { userId: hostId, displayName: 'host' },
    })
    expect(Object.keys(preview.host!).every((key) => ['userId', 'displayName', 'username', 'profileImageUrl'].includes(key))).toBe(true)
    expect(preview).not.toHaveProperty('hostUserId')
    expect(preview).not.toHaveProperty('createdByUserId')
    expect(preview).not.toHaveProperty('pendingHostUserId')
    await expect(outsider.query(api.circles.members, { circleId })).rejects.toThrow('Active Circle membership required')
    await expect(t.withIdentity({ subject: 'inside-member' }).query(api.circles.members, { circleId }))
      .resolves.toEqual(expect.arrayContaining([expect.objectContaining({ userId: hostId, role: 'host' }), expect.objectContaining({ userId: memberId, role: 'member' })]))
    await expect(t.withIdentity({ subject: 'inside-member' }).query(api.circles.detail, { circleId }))
      .resolves.toMatchObject({ membershipState: 'active', canRead: true, canWrite: true, pinnedPostIds: [] })
    await expect(t.withIdentity({ subject: 'inside-member' }).query(api.circles.mine, {}))
      .resolves.toEqual([expect.objectContaining({ _id: circleId, membershipState: 'active' })])
    expect(outsiderId).toBeTruthy()
  })

  it('supports cancellation and rejoining unless the member is banned', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    await insertUser(t, 'member')
    const circleId = await createCircle(t, 'admin', hostId)
    const member = t.withIdentity({ subject: 'member' })

    const membershipId = await member.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true })
    await member.mutation(api.circles.cancelJoinRequest, { circleId })
    await member.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true })
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.decideJoinRequest, { membershipId, decision: 'reject' })
    await member.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true })
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.decideJoinRequest, { membershipId, decision: 'approve' })
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.moderateMember, { membershipId, action: 'remove' })
    await member.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true })
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.decideJoinRequest, { membershipId, decision: 'approve' })
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.moderateMember, { membershipId, action: 'ban' })
    await expect(member.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true })).rejects.toThrow('banned')

    const row = await t.run(async (ctx) => ctx.db.get(membershipId))
    expect(row?.state).toBe('banned')
    const notifications = await t.run(async (ctx) => ctx.db.query('notifications').collect())
    expect(notifications.filter((notification) => notification.recipientUserId === hostId).map((notification) => notification.kind)).toContain('circle_join_requested')
    expect(notifications.filter((notification) => notification.recipientUserId === row?.userId).map((notification) => notification.kind)).toEqual(expect.arrayContaining([
      'circle_join_rejected', 'circle_join_approved', 'circle_member_removed', 'circle_member_banned',
    ]))
  })

  it('lets verified moderators decide requests and moderate only ordinary members', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const moderatorId = await insertUser(t, 'moderator', { verified: true })
    const unverifiedId = await insertUser(t, 'unverified')
    await insertUser(t, 'applicant')
    const circleId = await createCircle(t, 'admin', hostId)
    const moderatorMembershipId = await insertMembership(t, circleId, moderatorId, 'active')
    const unverifiedMembershipId = await insertMembership(t, circleId, unverifiedId, 'active')
    const applicantId = await t.withIdentity({ subject: 'applicant' }).mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true })

    await expect(t.withIdentity({ subject: 'host' }).mutation(api.circles.setModerator, { membershipId: unverifiedMembershipId, moderator: true }))
      .rejects.toThrow('current identity approval')
    expect((await t.run(async (ctx) => ctx.db.get(unverifiedMembershipId)))?.role).toBe('member')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.setModerator, { membershipId: moderatorMembershipId, moderator: true })
    await expect(t.withIdentity({ subject: 'moderator' }).mutation(api.circles.setModerator, { membershipId: unverifiedMembershipId, moderator: true }))
      .rejects.toThrow('Verified Circle host role required')
    await expect(t.withIdentity({ subject: 'moderator' }).query(api.circles.joinRequests, { circleId }))
      .resolves.toEqual([expect.objectContaining({ membershipId: applicantId, displayName: 'applicant' })])
    await t.withIdentity({ subject: 'moderator' }).mutation(api.circles.decideJoinRequest, { membershipId: applicantId, decision: 'approve' })
    await expect(t.withIdentity({ subject: 'moderator' }).mutation(api.circles.moderateMember, { membershipId: moderatorMembershipId, action: 'remove' }))
      .rejects.toThrow('trusted roles')
    const hostMembership = await t.run(async (ctx) => ctx.db.query('circleMemberships').withIndex('by_circle_user', (q) => q.eq('circleId', circleId).eq('userId', hostId)).unique())
    await expect(t.withIdentity({ subject: 'moderator' }).mutation(api.circles.moderateMember, { membershipId: hostMembership!._id, action: 'ban' }))
      .rejects.toThrow('trusted roles')
    await t.withIdentity({ subject: 'moderator' }).mutation(api.circles.moderateMember, { membershipId: applicantId, action: 'remove' })

    const conversations = await t.run(async (ctx) => ctx.db.query('directConversations').collect())
    expect(conversations).toHaveLength(0)
  })

  it('lets non-host members leave and mute while preventing the host from leaving', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    const circleId = await createCircle(t, 'admin', hostId)
    const membershipId = await insertMembership(t, circleId, memberId, 'active')
    const member = t.withIdentity({ subject: 'member' })

    await member.mutation(api.circles.setMuted, { circleId, muted: true })
    await expect(member.query(api.circles.myAccess, { circleId })).resolves.toMatchObject({ muted: true })
    await member.mutation(api.circles.leave, { circleId })
    await expect(member.query(api.circles.myAccess, { circleId })).resolves.toMatchObject({ canRead: false })
    await expect(t.withIdentity({ subject: 'host' }).mutation(api.circles.leave, { circleId })).rejects.toThrow('must transfer')
    expect((await t.run(async (ctx) => ctx.db.get(membershipId)))?.mutedAt).toBeUndefined()
  })

  it('transfers the host atomically after recipient acceptance and leaves failed attempts untouched', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const recipientId = await insertUser(t, 'recipient', { verified: true })
    await insertUser(t, 'outsider', { verified: true })
    const circleId = await createCircle(t, 'admin', hostId)
    const recipientMembershipId = await insertMembership(t, circleId, recipientId, 'active')

    await t.withIdentity({ subject: 'host' }).mutation(api.circles.initiateHostTransfer, { circleId, recipientUserId: recipientId })
    await expect(t.withIdentity({ subject: 'outsider' }).mutation(api.circles.acceptHostTransfer, { circleId }))
      .rejects.toThrow('No host transfer')
    expect((await t.run(async (ctx) => ctx.db.get(circleId)))?.hostUserId).toBe(hostId)
    expect((await t.run(async (ctx) => ctx.db.query('auditLogs').withIndex('by_created_at').collect())).filter((entry) => entry.action === 'circle.host_transfer_accepted')).toHaveLength(0)
    await t.withIdentity({ subject: 'recipient' }).mutation(api.circles.acceptHostTransfer, { circleId })

    const snapshot = await t.run(async (ctx) => ({
      circle: await ctx.db.get(circleId),
      recipient: await ctx.db.get(recipientMembershipId),
      host: await ctx.db.query('circleMemberships').withIndex('by_circle_user', (q) => q.eq('circleId', circleId).eq('userId', hostId)).unique(),
    }))
    expect(snapshot.circle).toMatchObject({ hostUserId: recipientId })
    expect(snapshot.circle?.pendingHostUserId).toBeUndefined()
    expect(snapshot.recipient?.role).toBe('host')
    expect(snapshot.host?.role).toBe('member')
    expect((await t.run(async (ctx) => ctx.db.query('auditLogs').withIndex('by_created_at').collect())).filter((entry) => entry.action === 'circle.host_transfer_accepted')).toHaveLength(1)
  })

  it('lets hosts or full admins cancel a pending host transfer without changing either host role', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const recipientId = await insertUser(t, 'recipient', { verified: true })
    const circleId = await createCircle(t, 'admin', hostId)
    const recipientMembershipId = await insertMembership(t, circleId, recipientId, 'active')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.initiateHostTransfer, { circleId, recipientUserId: recipientId })
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.cancelHostTransfer, { circleId })

    const snapshot = await t.run(async (ctx) => ({
      circle: await ctx.db.get(circleId),
      recipient: await ctx.db.get(recipientMembershipId),
      host: await ctx.db.query('circleMemberships').withIndex('by_circle_user', (q) => q.eq('circleId', circleId).eq('userId', hostId)).unique(),
      audits: await ctx.db.query('auditLogs').withIndex('by_created_at').collect(),
    }))
    expect(snapshot.circle).toMatchObject({ hostUserId: hostId })
    expect(snapshot.circle?.pendingHostUserId).toBeUndefined()
    expect(snapshot.recipient?.role).toBe('member')
    expect(snapshot.host?.role).toBe('host')
    expect(snapshot.audits.filter((entry) => entry.action === 'circle.host_transfer_cancelled')).toHaveLength(1)

    await expect(t.withIdentity({ subject: 'admin' }).mutation(api.circles.cancelHostTransfer, { circleId }))
      .rejects.toThrow('No host transfer is pending')
    expect((await t.run(async (ctx) => ctx.db.query('auditLogs').withIndex('by_created_at').collect())).filter((entry) => entry.action === 'circle.host_transfer_cancelled')).toHaveLength(1)

    await t.withIdentity({ subject: 'host' }).mutation(api.circles.initiateHostTransfer, { circleId, recipientUserId: recipientId })
    await t.withIdentity({ subject: 'admin' }).mutation(api.circles.cancelHostTransfer, { circleId })
    expect((await t.run(async (ctx) => ctx.db.query('auditLogs').collect())).filter((entry) => entry.action === 'circle.host_transfer_cancelled')).toHaveLength(2)
  })

  it('lets a host edit metadata and unban members while denying moderators and preserving failed state', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const moderatorId = await insertUser(t, 'moderator', { verified: true })
    const bannedId = await insertUser(t, 'banned')
    const circleId = await createCircle(t, 'admin', hostId)
    const moderatorMembershipId = await insertMembership(t, circleId, moderatorId, 'active', 'moderator')
    const bannedMembershipId = await insertMembership(t, circleId, bannedId, 'banned')
    const edited = {
      circleId, name: 'Coffee Neighbors', purpose: 'Meet thoughtfully.', category: 'Community',
      rules: ['Respect privacy.', 'Be kind.'], mode: 'in_person' as const, approximateArea: 'Mandaue',
    }

    await t.withIdentity({ subject: 'host' }).mutation(api.circles.edit, edited)
    await expect(t.withIdentity({ subject: 'moderator' }).mutation(api.circles.edit, { ...edited, name: 'Wrong' }))
      .rejects.toThrow('Verified Circle host role required')
    await expect(t.withIdentity({ subject: 'admin' }).mutation(api.circles.edit, { ...edited, name: 'Admin edit' }))
      .rejects.toThrow('managed by its host')
    await expect(t.withIdentity({ subject: 'moderator' }).mutation(api.circles.unbanMember, { membershipId: bannedMembershipId }))
      .rejects.toThrow('Verified Circle host role required')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.unbanMember, { membershipId: bannedMembershipId })
    await expect(t.withIdentity({ subject: 'banned' }).mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true })).resolves.toBe(bannedMembershipId)
    await expect(t.withIdentity({ subject: 'admin' }).mutation(api.circles.setModerator, { membershipId: moderatorMembershipId, moderator: false }))
      .rejects.toThrow('only to its host')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.setModerator, { membershipId: moderatorMembershipId, moderator: false })

    const snapshot = await t.run(async (ctx) => ({
      circle: await ctx.db.get(circleId),
      banned: await ctx.db.get(bannedMembershipId),
      moderator: await ctx.db.get(moderatorMembershipId),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    expect(snapshot.circle).toMatchObject({ name: 'Coffee Neighbors', purpose: 'Meet thoughtfully.', category: 'Community', rules: ['Respect privacy.', 'Be kind.'], mode: 'in_person', approximateArea: 'Mandaue' })
    expect(snapshot.banned?.state).toBe('requested')
    expect(snapshot.moderator?.role).toBe('member')
    expect(snapshot.audits.filter((entry) => entry.action === 'circle.edited')).toHaveLength(1)
    expect(snapshot.audits.filter((entry) => entry.action === 'circle.member_unbanned')).toHaveLength(1)
    expect(snapshot.audits.filter((entry) => entry.action === 'circle.moderator_revoked')).toHaveLength(1)
  })

  it('keeps host management and transfer recipient details scoped to the right viewer', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const recipientId = await insertUser(t, 'recipient', { verified: true })
    const ordinaryId = await insertUser(t, 'ordinary')
    const bannedId = await insertUser(t, 'banned')
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, recipientId, 'active')
    await insertMembership(t, circleId, ordinaryId, 'active')
    await insertMembership(t, circleId, bannedId, 'banned')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.initiateHostTransfer, { circleId, recipientUserId: recipientId })

    const management = await t.withIdentity({ subject: 'host' }).query(api.circles.hostManagement, { circleId })
    expect(management.pendingTransfer).toEqual({ userId: recipientId, displayName: 'recipient' })
    expect(management.bannedMembers).toEqual([expect.objectContaining({ displayName: 'banned' })])
    expect(management.activeMembers).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: recipientId, trustedRoleEligible: true }),
      expect.objectContaining({ userId: ordinaryId, trustedRoleEligible: false }),
    ]))
    await expect(t.withIdentity({ subject: 'ordinary' }).query(api.circles.hostManagement, { circleId }))
      .rejects.toThrow('Verified Circle host role required')
    await expect(t.withIdentity({ subject: 'admin' }).query(api.circles.hostManagement, { circleId }))
      .rejects.toThrow('available only to its host')
    await expect(t.withIdentity({ subject: 'recipient' }).query(api.circles.detail, { circleId }))
      .resolves.toMatchObject({ pendingTransferForViewer: true, isCanonicalHost: false })
    const ordinaryDetail = await t.withIdentity({ subject: 'ordinary' }).query(api.circles.detail, { circleId })
    expect(ordinaryDetail).toMatchObject({ pendingTransferForViewer: false, isCanonicalHost: false })
    expect(ordinaryDetail).not.toHaveProperty('pendingTransfer')
    expect(ordinaryDetail).not.toHaveProperty('bannedMembers')
  })

  it('separates host archive controls from full-admin suspension recovery and rolls back failures', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const moderatorId = await insertUser(t, 'moderator', { verified: true })
    await insertUser(t, 'outsider')
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, moderatorId, 'active', 'moderator')
    const admin = t.withIdentity({ subject: 'admin' })
    const host = t.withIdentity({ subject: 'host' })
    const outsider = t.withIdentity({ subject: 'outsider' })

    await host.mutation(api.circles.setState, { circleId, state: 'archived' })
    await expect(outsider.query(api.circles.preview, { circleId })).rejects.toThrow('unavailable')
    await expect(outsider.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true })).rejects.toThrow('unavailable')
    await expect(host.query(api.circles.myAccess, { circleId })).resolves.toMatchObject({ canRead: true, canWrite: false })
    await expect(t.withIdentity({ subject: 'moderator' }).mutation(api.circles.setState, { circleId, state: 'active' }))
      .rejects.toThrow('Verified Circle host role required')
    await host.mutation(api.circles.setState, { circleId, state: 'active' })
    await expect(host.mutation(api.circles.setState, { circleId, state: 'suspended' })).rejects.toThrow('Full admin role required')
    await admin.mutation(api.circles.setState, { circleId, state: 'suspended' })
    await expect(host.query(api.circles.members, { circleId })).rejects.toThrow('suspended')
    await expect(host.mutation(api.circles.setState, { circleId, state: 'active' })).rejects.toThrow('Full admin role required')
    await expect(admin.mutation(api.circles.setState, { circleId, state: 'suspended' })).rejects.toThrow('already suspended')
    await admin.mutation(api.circles.setState, { circleId, state: 'active' })

    const audits = await t.run(async (ctx) => ctx.db.query('auditLogs').collect())
    expect(audits.filter((entry) => entry.action === 'circle.created')).toHaveLength(1)
    expect(audits.filter((entry) => entry.action === 'circle.archived')).toHaveLength(1)
    expect(audits.filter((entry) => entry.action === 'circle.reactivated')).toHaveLength(2)
    expect(audits.filter((entry) => entry.action === 'circle.suspended')).toHaveLength(1)
  })

  it('keeps Circle posts out of global surfaces and rechecks membership on direct reads', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    await insertUser(t, 'outsider')
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, memberId, 'active')
    const member = t.withIdentity({ subject: 'member' })
    const postId = await member.mutation(api.social.createPost, { body: 'Private Circle discussion', circleId, circleKind: 'discussion' })

    expect((await t.query(api.social.feed, {})).some((item: any) => item.kind === 'post' && item.post._id === postId)).toBe(false)
    expect(await member.query(api.social.byUser, { userId: memberId })).toEqual([])
    await member.mutation(api.social.toggleSavePost, { postId })
    expect(await member.query(api.social.feed, { filter: 'saved' })).toEqual([])
    await expect(member.mutation(api.social.recordFeedImpressions, {
      sessionId: 'circle-session',
      surface: 'for_you',
      items: [{ itemKey: `post:${postId}`, itemType: 'guidance', source: 'recent', position: 0 }],
    })).rejects.toThrow('cannot be recorded')
    expect(await t.run(async (ctx) => ctx.db.query('feedEvents').collect())).toHaveLength(0)
    await expect(t.withIdentity({ subject: 'outsider' }).query(api.social.requestedPost, { postId: String(postId) }))
      .rejects.toThrow('Active Circle membership required')
    await expect(member.query(api.social.circleFeed, { circleId, paginationOpts: { cursor: null, numItems: 10 } }))
      .resolves.toMatchObject({ page: [expect.objectContaining({ _id: postId, circleKind: 'discussion' })] })

    await t.run(async (ctx) => {
      const row = await ctx.db.query('circleMemberships').withIndex('by_circle_user', (q) => q.eq('circleId', circleId).eq('userId', memberId)).unique()
      await ctx.db.patch(row!._id, { state: 'left' })
    })
    await expect(member.mutation(api.social.editPost, { postId, body: 'No longer allowed' })).rejects.toThrow('Active Circle membership required')
    await expect(member.mutation(api.social.deletePost, { postId })).rejects.toThrow('Active Circle membership required')
  })

  it('removes suspended or missing authors from Circle posts, comments, and notification destinations', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const viewerId = await insertUser(t, 'viewer')
    const authorId = await insertUser(t, 'author')
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, viewerId, 'active')
    await insertMembership(t, circleId, authorId, 'active')
    const viewer = t.withIdentity({ subject: 'viewer' })
    const author = t.withIdentity({ subject: 'author' })
    const viewerPostId = await viewer.mutation(api.social.createPost, { body: 'Viewer post', circleId })
    const authorPostId = await author.mutation(api.social.createPost, { body: 'Author post', circleId })
    const commentId = await author.mutation(api.social.createComment, { postId: viewerPostId, body: 'Author reply' })
    const notificationId = await t.run(async (ctx) => (
      await ctx.db.query('notifications').withIndex('by_recipient_created_at', (q) => q.eq('recipientUserId', viewerId)).first()
    )!._id)

    await t.run(async (ctx) => ctx.db.patch(authorId, { suspended: true, updatedAt: Date.now() }))
    const suspendedFeed = await viewer.query(api.social.circleFeed, { circleId, paginationOpts: { cursor: null, numItems: 10 } })
    expect(suspendedFeed.page.map((post) => post._id)).toEqual([viewerPostId])
    expect(await viewer.query(api.social.requestedPost, { postId: String(authorPostId) })).toBeNull()
    expect(await viewer.query(api.social.commentsForPost, { postId: viewerPostId })).toEqual([])
    expect((await viewer.query(api.social.commentPage, { postId: viewerPostId, paginationOpts: { cursor: null, numItems: 10 } })).page).toEqual([])
    expect((await viewer.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })).page).toEqual([])
    expect(await viewer.mutation(api.notifications.open, { notificationId: String(notificationId) })).toEqual({ status: 'unavailable' })

    await t.run(async (ctx) => ctx.db.delete(authorId))
    expect((await viewer.query(api.social.circleFeed, { circleId, paginationOpts: { cursor: null, numItems: 10 } })).page.map((post) => post._id)).toEqual([viewerPostId])
    expect(await viewer.query(api.social.requestedPost, { postId: String(authorPostId) })).toBeNull()
    expect(await viewer.query(api.social.commentsForPost, { postId: viewerPostId })).toEqual([])
    expect(await viewer.mutation(api.notifications.open, { notificationId: String(notificationId) })).toEqual({ status: 'unavailable' })
    expect((await t.run(async (ctx) => ctx.db.get(commentId)))?.body).toBe('Author reply')
  })

  it('enforces text-only posts, announcement authority, and lifecycle access before side effects', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, memberId, 'active')
    const uploadId = await t.run(async (ctx) => ctx.db.insert('postMediaUploads', { userId: memberId, createdAt: Date.now() }))
    const member = t.withIdentity({ subject: 'member' })

    await expect(member.mutation(api.social.createPost, { body: 'No media', circleId, mediaUploadIds: [uploadId] })).rejects.toThrow('text-only')
    await expect(member.mutation(api.social.createPost, { body: 'Announcement', circleId, circleKind: 'announcement' })).rejects.toThrow('moderator')
    expect((await t.run(async (ctx) => ctx.db.get(uploadId)))?.postId).toBeUndefined()
    const announcementId = await t.withIdentity({ subject: 'host' }).mutation(api.social.createPost, { body: 'Official update', circleId, circleKind: 'announcement' })

    await t.withIdentity({ subject: 'host' }).mutation(api.circles.setState, { circleId, state: 'archived' })
    await expect(member.query(api.social.requestedPost, { postId: String(announcementId) })).resolves.toMatchObject({ _id: announcementId })
    await expect(member.mutation(api.social.createComment, { postId: announcementId, body: 'No archived writes' })).rejects.toThrow('read-only')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.setState, { circleId, state: 'active' })
    await t.withIdentity({ subject: 'admin' }).mutation(api.circles.setState, { circleId, state: 'suspended' })
    await expect(member.query(api.social.requestedPost, { postId: String(announcementId) })).rejects.toThrow('suspended')
  })

  it('hides blocked members mutually and rejects their Circle interactions and mentions', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const firstId = await insertUser(t, 'first')
    const secondId = await insertUser(t, 'second')
    await t.run(async (ctx) => {
      await ctx.db.patch(firstId, { username: 'first_friend' })
      await ctx.db.patch(secondId, { username: 'second_friend' })
    })
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, firstId, 'active')
    await insertMembership(t, circleId, secondId, 'active')
    const first = t.withIdentity({ subject: 'first' })
    const second = t.withIdentity({ subject: 'second' })
    const postId = await first.mutation(api.social.createPost, { body: 'First post', circleId })
    await second.mutation(api.safety.setBlocked, { userId: firstId, blocked: true })

    await expect(second.query(api.social.circleFeed, { circleId, paginationOpts: { cursor: null, numItems: 10 } })).resolves.toMatchObject({ page: [] })
    await expect(second.query(api.social.requestedPost, { postId: String(postId) })).resolves.toBeNull()
    await expect(second.mutation(api.social.createComment, { postId, body: 'Blocked comment' })).rejects.toThrow('blocked')
    await expect(second.mutation(api.social.toggleLike, { postId })).rejects.toThrow('blocked')
    await expect(second.mutation(api.social.createPost, { body: 'Hi @first_friend', circleId })).rejects.toThrow('blocked')
  })

  it('pins and moderates Circle content separately from author deletion and audits each change once', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, memberId, 'active')
    const postId = await t.withIdentity({ subject: 'member' }).mutation(api.social.createPost, { body: 'Moderate me', circleId })
    const commentId = await t.withIdentity({ subject: 'member' }).mutation(api.social.createComment, { postId, body: 'Comment' })
    const host = t.withIdentity({ subject: 'host' })

    await host.mutation(api.circles.pinPost, { circleId, postId })
    await host.mutation(api.circles.unpinPost, { circleId, postId })
    await host.mutation(api.circles.setCommentRemoved, { commentId, removed: true })
    expect(await host.query(api.social.commentsForPost, { postId })).toEqual([])
    await host.mutation(api.circles.setCommentRemoved, { commentId, removed: false })
    await host.mutation(api.circles.setPostRemoved, { postId, removed: true })
    expect(await host.query(api.social.requestedPost, { postId: String(postId) })).toBeNull()
    await host.mutation(api.circles.setPostRemoved, { postId, removed: false })

    const snapshot = await t.run(async (ctx) => ({ post: await ctx.db.get(postId), comment: await ctx.db.get(commentId), audits: await ctx.db.query('auditLogs').collect() }))
    expect(snapshot.post?.deletedAt).toBeUndefined()
    expect(snapshot.post?.hidden).toBe(false)
    expect(snapshot.comment?.hidden).toBe(false)
    for (const action of ['circle.post_pinned', 'circle.post_unpinned', 'circle.comment_removed', 'circle.comment_restored', 'circle.post_removed', 'circle.post_restored']) {
      expect(snapshot.audits.filter((entry) => entry.action === action)).toHaveLength(1)
    }
  })

  it('limits the platform Circle safety inventory and detail to full admins', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    await insertUser(t, 'reviewer', { role: 'reviewer' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    const circleId = await createCircle(t, 'admin', hostId)
    await insertMembership(t, circleId, memberId, 'active')
    const postId = await t.withIdentity({ subject: 'member' }).mutation(api.social.createPost, { body: 'Private safety context', circleId })

    await expect(t.withIdentity({ subject: 'reviewer' }).query(api.circles.adminList, { state: 'all' }))
      .rejects.toThrow('Full admin role required')
    await expect(t.withIdentity({ subject: 'reviewer' }).query(api.circles.adminDetail, { circleId }))
      .rejects.toThrow('Full admin role required')

    const admin = t.withIdentity({ subject: 'admin' })
    await expect(admin.query(api.circles.adminList, { state: 'active', search: 'coffee' }))
      .resolves.toEqual([expect.objectContaining({ _id: circleId, activeMemberCount: 2, pendingJoinCount: 0 })])
    await expect(admin.query(api.circles.adminDetail, { circleId })).resolves.toMatchObject({
      circle: { _id: circleId, name: 'Coffee Friends' },
      memberships: expect.arrayContaining([expect.objectContaining({ userId: memberId, state: 'active' })]),
      posts: [expect.objectContaining({ postId, body: 'Private safety context' })],
    })
  })

  it('keeps routine Circle management host-only while allowing platform suspension recovery', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member', { verified: true })
    const bannedId = await insertUser(t, 'banned')
    const circleId = await createCircle(t, 'admin', hostId)
    const memberMembershipId = await insertMembership(t, circleId, memberId, 'active')
    const bannedMembershipId = await insertMembership(t, circleId, bannedId, 'banned')
    const admin = t.withIdentity({ subject: 'admin' })

    await expect(admin.mutation(api.circles.setModerator, { membershipId: memberMembershipId, moderator: true }))
      .rejects.toThrow('only to its host')
    await expect(admin.mutation(api.circles.unbanMember, { membershipId: bannedMembershipId }))
      .rejects.toThrow('only to its host')
    await expect(admin.mutation(api.circles.initiateHostTransfer, { circleId, recipientUserId: memberId }))
      .rejects.toThrow('only to its host')
    await expect(admin.mutation(api.circles.setState, { circleId, state: 'archived' }))
      .rejects.toThrow('only suspend or reactivate')
    await admin.mutation(api.circles.setState, { circleId, state: 'suspended' })
    await admin.mutation(api.circles.setState, { circleId, state: 'active' })

    const audits = await t.run(async (ctx) => ctx.db.query('auditLogs').collect())
    expect(audits.filter((entry) => entry.action === 'circle.suspended')).toHaveLength(1)
    expect(audits.filter((entry) => entry.action === 'circle.reactivated')).toHaveLength(1)
    expect(audits.filter((entry) => entry.action === 'circle.moderator_granted')).toHaveLength(0)
  })

  it('restores the exact state held before platform suspension and defaults legacy rows to active', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const activeCircleId = await createCircle(t, 'admin', hostId, 'active-state-circle')
    const archivedCircleId = await createCircle(t, 'admin', hostId, 'archived-state-circle')
    const admin = t.withIdentity({ subject: 'admin' })
    const host = t.withIdentity({ subject: 'host' })

    await host.mutation(api.circles.setState, { circleId: archivedCircleId, state: 'archived' })
    await admin.mutation(api.circles.setState, { circleId: activeCircleId, state: 'suspended' })
    await admin.mutation(api.circles.setState, { circleId: archivedCircleId, state: 'suspended' })
    expect(await t.run(async (ctx) => ctx.db.get(activeCircleId))).toMatchObject({ state: 'suspended', preSuspensionState: 'active' })
    expect(await t.run(async (ctx) => ctx.db.get(archivedCircleId))).toMatchObject({ state: 'suspended', preSuspensionState: 'archived' })

    await admin.mutation(api.circles.setState, { circleId: activeCircleId, state: 'active' })
    await admin.mutation(api.circles.setState, { circleId: archivedCircleId, state: 'active' })
    expect(await t.run(async (ctx) => ctx.db.get(activeCircleId))).toMatchObject({ state: 'active' })
    expect((await t.run(async (ctx) => ctx.db.get(activeCircleId)))?.preSuspensionState).toBeUndefined()
    expect(await t.run(async (ctx) => ctx.db.get(archivedCircleId))).toMatchObject({ state: 'archived' })
    expect((await t.run(async (ctx) => ctx.db.get(archivedCircleId)))?.preSuspensionState).toBeUndefined()

    await t.run(async (ctx) => ctx.db.patch(activeCircleId, { state: 'suspended', preSuspensionState: undefined }))
    await admin.mutation(api.circles.setState, { circleId: activeCircleId, state: 'active' })
    expect(await t.run(async (ctx) => ctx.db.get(activeCircleId))).toMatchObject({ state: 'active' })
  })

  it('defaults new and legacy Circles to listed, members-only, and approval-required', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    await insertUser(t, 'outsider')
    const circleId = await createCircle(t, 'admin', hostId, 'defaults-circle')
    const legacyId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('circles', {
        slug: 'legacy-circle', name: 'Legacy', purpose: 'Old record.', category: 'History',
        rules: ['Be kind.'], mode: 'online', state: 'active', hostUserId: hostId,
        createdByUserId: hostId, createdAt: now, updatedAt: now,
      })
    })

    for (const id of [circleId, legacyId]) {
      await expect(t.withIdentity({ subject: 'outsider' }).query(api.circles.myAccess, { circleId: id }))
        .resolves.toMatchObject({
          settings: { discoverability: 'listed', discussionVisibility: 'members_only', memberListVisibility: 'members_only', joinPolicy: 'approval_required' },
          canReadDiscussion: false, canReadMembers: false,
        })
    }
    const listed = await t.withIdentity({ subject: 'outsider' }).query(api.circles.discover, {})
    expect(listed.map((circle) => String(circle._id))).toEqual(expect.arrayContaining([String(circleId), String(legacyId)]))
  })

  it('keeps unlisted active Circles out of Discover but reachable by direct link', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    await insertUser(t, 'outsider')
    const listedId = await createCircle(t, 'admin', hostId, 'listed-circle')
    const unlistedId = await createCircle(t, 'admin', hostId, 'unlisted-circle')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.updateSettings, {
      circleId: unlistedId, discoverability: 'unlisted', discussionVisibility: 'members_only',
      memberListVisibility: 'members_only', joinPolicy: 'approval_required',
    })

    const discover = await t.withIdentity({ subject: 'outsider' }).query(api.circles.discover, {})
    expect(discover.map((circle) => String(circle._id))).toContain(String(listedId))
    expect(discover.map((circle) => String(circle._id))).not.toContain(String(unlistedId))
    await expect(t.withIdentity({ subject: 'outsider' }).query(api.circles.preview, { circleId: unlistedId }))
      .resolves.toMatchObject({ name: 'Coffee Friends', discoverability: 'unlisted' })
  })

  it('lets eligible signed-in outsiders read public discussions without write or removed-content access', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    await insertUser(t, 'outsider')
    await insertUser(t, 'reviewer-outsider', { role: 'reviewer' })
    const circleId = await createCircle(t, 'admin', hostId, 'public-discussion')
    await insertMembership(t, circleId, memberId, 'active')
    const postId = await t.withIdentity({ subject: 'member' }).mutation(api.social.createPost, { body: 'Public Circle discussion', circleId })
    const commentId = await t.withIdentity({ subject: 'member' }).mutation(api.social.createComment, { postId, body: 'Public reply' })
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.updateSettings, {
      circleId, discoverability: 'listed', discussionVisibility: 'signed_in',
      memberListVisibility: 'members_only', joinPolicy: 'approval_required',
    })
    const outsider = t.withIdentity({ subject: 'outsider' })

    await expect(outsider.query(api.social.circleFeed, { circleId, paginationOpts: { cursor: null, numItems: 10 } }))
      .resolves.toMatchObject({ page: [expect.objectContaining({ _id: postId, authorDisplayName: 'member' })] })
    await expect(outsider.query(api.social.requestedPost, { postId: String(postId) }))
      .resolves.toMatchObject({ _id: postId })
    await expect(outsider.query(api.social.commentsForPost, { postId }))
      .resolves.toEqual([expect.objectContaining({ _id: commentId })])
    await expect(outsider.query(api.social.commentPage, { postId, paginationOpts: { cursor: null, numItems: 10 } }))
      .resolves.toMatchObject({ page: [expect.objectContaining({ _id: commentId })] })
    await expect(outsider.query(api.circles.detail, { circleId }))
      .resolves.toMatchObject({ canRead: false, canReadDiscussion: true, canWrite: false, canModerate: false })
    await expect(outsider.mutation(api.social.createPost, { body: 'Outsider post', circleId }))
      .rejects.toThrow('Active Circle membership required')
    await expect(outsider.mutation(api.social.createComment, { postId, body: 'Outsider reply' }))
      .rejects.toThrow('Active Circle membership required')
    await expect(outsider.mutation(api.social.toggleLike, { postId })).rejects.toThrow('Active Circle membership required')
    await expect(t.withIdentity({ subject: 'reviewer-outsider' }).query(api.social.circleFeed, { circleId, paginationOpts: { cursor: null, numItems: 10 } }))
      .rejects.toThrow('Active Circle membership required')

    await t.withIdentity({ subject: 'host' }).mutation(api.circles.setPostRemoved, { postId, removed: true })
    expect((await outsider.query(api.social.circleFeed, { circleId, paginationOpts: { cursor: null, numItems: 10 } })).page).toEqual([])
    await expect(outsider.query(api.social.requestedPost, { postId: String(postId) })).resolves.toBeNull()
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.setPostRemoved, { postId, removed: false })
  })

  it('denies outsider discussion reads while member-only visibility is set', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    await insertUser(t, 'outsider')
    const circleId = await createCircle(t, 'admin', hostId, 'private-discussion')
    await insertMembership(t, circleId, memberId, 'active')
    const postId = await t.withIdentity({ subject: 'member' }).mutation(api.social.createPost, { body: 'Private discussion', circleId })
    const outsider = t.withIdentity({ subject: 'outsider' })

    await expect(outsider.query(api.social.circleFeed, { circleId, paginationOpts: { cursor: null, numItems: 10 } }))
      .rejects.toThrow('Active Circle membership required')
    await expect(outsider.query(api.social.requestedPost, { postId: String(postId) }))
      .rejects.toThrow('Active Circle membership required')
    await expect(outsider.query(api.circles.detail, { circleId }))
      .resolves.toMatchObject({ canReadDiscussion: false, canReadMembers: false })
  })

  it('keeps mutual blocks effective inside publicly visible discussions', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    await insertUser(t, 'outsider')
    const circleId = await createCircle(t, 'admin', hostId, 'public-blocked')
    await insertMembership(t, circleId, memberId, 'active')
    const postId = await t.withIdentity({ subject: 'member' }).mutation(api.social.createPost, { body: 'Blocked discussion', circleId })
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.updateSettings, {
      circleId, discoverability: 'listed', discussionVisibility: 'signed_in',
      memberListVisibility: 'members_only', joinPolicy: 'approval_required',
    })
    await t.withIdentity({ subject: 'outsider' }).mutation(api.safety.setBlocked, { userId: memberId, blocked: true })

    const outsider = t.withIdentity({ subject: 'outsider' })
    expect((await outsider.query(api.social.circleFeed, { circleId, paginationOpts: { cursor: null, numItems: 10 } })).page).toEqual([])
    await expect(outsider.query(api.social.requestedPost, { postId: String(postId) })).resolves.toBeNull()
    expect(postId).toBeTruthy()
  })

  it('exposes only active eligible member profiles through the public member list', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    const suspendedId = await insertUser(t, 'suspended-member', { suspended: true })
    const reviewerId = await insertUser(t, 'reviewer-member', { role: 'reviewer', verified: true })
    const requestedId = await insertUser(t, 'requested-member')
    const bannedId = await insertUser(t, 'banned-member')
    await insertUser(t, 'outsider')
    const circleId = await createCircle(t, 'admin', hostId, 'public-members')
    await insertMembership(t, circleId, memberId, 'active')
    await insertMembership(t, circleId, suspendedId, 'active')
    await insertMembership(t, circleId, reviewerId, 'active')
    await insertMembership(t, circleId, requestedId, 'requested')
    await insertMembership(t, circleId, bannedId, 'banned')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.updateSettings, {
      circleId, discoverability: 'listed', discussionVisibility: 'members_only',
      memberListVisibility: 'signed_in', joinPolicy: 'approval_required',
    })

    const rows = await t.withIdentity({ subject: 'outsider' }).query(api.circles.members, { circleId })
    expect(rows.map((row) => String(row.userId)).sort()).toEqual([String(hostId), String(memberId)].sort())
    expect(rows.every((row) => ['host', 'member', 'moderator'].includes(row.role))).toBe(true)
    expect(JSON.stringify(rows)).not.toContain('requested')
    expect(JSON.stringify(rows)).not.toContain('banned')
  })

  it('admits eligible outsiders instantly to open Circles while banned, archived, and suspended joins fail', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    await insertUser(t, 'joiner')
    await insertUser(t, 'reviewer-joiner', { role: 'reviewer' })
    const circleId = await createCircle(t, 'admin', hostId, 'open-circle')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.updateSettings, {
      circleId, discoverability: 'listed', discussionVisibility: 'members_only',
      memberListVisibility: 'members_only', joinPolicy: 'open',
    })
    const joiner = t.withIdentity({ subject: 'joiner' })

    const membershipId = await joiner.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true })
    expect(await t.run(async (ctx) => ctx.db.get(membershipId))).toMatchObject({ state: 'active', role: 'member' })
    await expect(joiner.mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true }))
      .rejects.toThrow('membership already exists')
    await expect(t.withIdentity({ subject: 'reviewer-joiner' }).mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true }))
      .rejects.toThrow('eligible account role')

    const bannedId = await insertUser(t, 'banned-joiner')
    const bannedMembership = await insertMembership(t, circleId, bannedId, 'banned')
    await expect(t.withIdentity({ subject: 'banned-joiner' }).mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true }))
      .rejects.toThrow('banned')
    expect((await t.run(async (ctx) => ctx.db.get(bannedMembership)))?.state).toBe('banned')

    await t.withIdentity({ subject: 'host' }).mutation(api.circles.setState, { circleId, state: 'archived' })
    await insertUser(t, 'late-joiner')
    await expect(t.withIdentity({ subject: 'late-joiner' }).mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true }))
      .rejects.toThrow('unavailable')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.setState, { circleId, state: 'active' })
    await t.withIdentity({ subject: 'admin' }).mutation(api.circles.setState, { circleId, state: 'suspended' })
    await expect(t.withIdentity({ subject: 'late-joiner' }).mutation(api.circles.requestToJoin, { circleId, rulesAcknowledged: true }))
      .rejects.toThrow('unavailable')
  })

  it('limits privacy settings changes to the verified Circle host on active Circles', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const moderatorId = await insertUser(t, 'moderator', { verified: true })
    const circleId = await createCircle(t, 'admin', hostId, 'settings-auth')
    await insertMembership(t, circleId, moderatorId, 'active', 'moderator')
    const settings = {
      circleId, discoverability: 'unlisted' as const, discussionVisibility: 'signed_in' as const,
      memberListVisibility: 'signed_in' as const, joinPolicy: 'open' as const,
    }

    await expect(t.withIdentity({ subject: 'moderator' }).mutation(api.circles.updateSettings, settings))
      .rejects.toThrow('Verified Circle host role required')
    await expect(t.withIdentity({ subject: 'admin' }).mutation(api.circles.updateSettings, settings))
      .rejects.toThrow('managed by its host')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.updateSettings, settings)
    expect(await t.run(async (ctx) => ctx.db.get(circleId))).toMatchObject({ discoverability: 'unlisted', joinPolicy: 'open' })
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.setState, { circleId, state: 'archived' })
    await expect(t.withIdentity({ subject: 'host' }).mutation(api.circles.updateSettings, settings))
      .rejects.toThrow('Active Circle required')
    const audits = await t.run(async (ctx) => ctx.db.query('auditLogs').collect())
    expect(audits.filter((entry) => entry.action === 'circle.settings_updated')).toHaveLength(1)
  })

  it('validates Circle images, replaces prior files, and leaves failures untouched', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    const circleId = await createCircle(t, 'admin', hostId, 'image-circle')
    await insertMembership(t, circleId, memberId, 'active')
    const host = t.withIdentity({ subject: 'host' })

    async function storeImage(type: string, bytes = 'circle-bytes') {
      return await t.run(async (ctx) => {
        const storageId = await ctx.storage.store(new Blob([bytes], { type: 'image/png' }))
        // convex-test omits Blob.type from synthetic storage metadata.
        await (ctx.db as any).patch(storageId, { contentType: type })
        return storageId
      })
    }

    await expect(t.withIdentity({ subject: 'member' }).mutation(api.circles.generateCircleImageUploadUrl, { circleId, kind: 'icon' }))
      .rejects.toThrow('Verified Circle host role required')
    expect(await host.mutation(api.circles.generateCircleImageUploadUrl, { circleId, kind: 'icon' })).toBeTruthy()

    const iconId = await storeImage('image/png')
    await host.mutation(api.circles.setCircleImage, { circleId, kind: 'icon', storageId: iconId })
    expect((await t.run(async (ctx) => ctx.db.get(circleId)))?.iconStorageId).toBe(iconId)

    const badType = await storeImage('video/mp4')
    await expect(host.mutation(api.circles.setCircleImage, { circleId, kind: 'cover', storageId: badType }))
      .rejects.toThrow('still images')
    const oversized = await storeImage('image/png')
    await t.run(async (ctx) => { await (ctx.db as any).patch(oversized, { contentType: 'image/png', size: 6 * 1024 * 1024 }) })
    await expect(host.mutation(api.circles.setCircleImage, { circleId, kind: 'cover', storageId: oversized }))
      .rejects.toThrow('5 MB')
    expect((await t.run(async (ctx) => ctx.db.get(circleId)))?.coverStorageId).toBeUndefined()

    const replacement = await storeImage('image/webp')
    await host.mutation(api.circles.setCircleImage, { circleId, kind: 'icon', storageId: replacement })
    expect((await t.run(async (ctx) => ctx.db.get(circleId)))?.iconStorageId).toBe(replacement)
    expect(await t.run(async (ctx) => ctx.db.system.get('_storage', iconId))).toBeNull()
    expect(await t.run(async (ctx) => ctx.storage.getUrl(replacement))).toBeTruthy()

    await host.mutation(api.circles.removeCircleImage, { circleId, kind: 'icon' })
    expect((await t.run(async (ctx) => ctx.db.get(circleId)))?.iconStorageId).toBeUndefined()
    expect(await t.run(async (ctx) => ctx.db.system.get('_storage', replacement))).toBeNull()
    await expect(host.mutation(api.circles.removeCircleImage, { circleId, kind: 'icon' }))
      .rejects.toThrow('no image to remove')
  })

  it('exposes privacy settings and media presence to full admins only', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    await insertUser(t, 'reviewer', { role: 'reviewer' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const circleId = await createCircle(t, 'admin', hostId, 'admin-privacy')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.updateSettings, {
      circleId, discoverability: 'unlisted', discussionVisibility: 'signed_in',
      memberListVisibility: 'signed_in', joinPolicy: 'open',
    })
    const iconId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(['icon'], { type: 'image/png' }))
      await (ctx.db as any).patch(storageId, { contentType: 'image/png' })
      return storageId
    })
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.setCircleImage, { circleId, kind: 'icon', storageId: iconId })

    await expect(t.withIdentity({ subject: 'reviewer' }).query(api.circles.adminList, { state: 'all' }))
      .rejects.toThrow('Full admin role required')
    const admin = t.withIdentity({ subject: 'admin' })
    await expect(admin.query(api.circles.adminList, { state: 'all' }))
      .resolves.toEqual([expect.objectContaining({
        _id: circleId,
        settings: { discoverability: 'unlisted', discussionVisibility: 'signed_in', memberListVisibility: 'signed_in', joinPolicy: 'open' },
        hasIcon: true, hasCover: false,
      })])
    await expect(admin.query(api.circles.adminDetail, { circleId })).resolves.toMatchObject({
      circle: expect.objectContaining({
        settings: { discoverability: 'unlisted', discussionVisibility: 'signed_in', memberListVisibility: 'signed_in', joinPolicy: 'open' },
        iconUrl: expect.any(String),
      }),
    })
  })

  it('atomically recovers ownership to one eligible active member and audits once', async () => {
    const t = convexTest(schema, convexModules)
    await insertUser(t, 'admin', { role: 'admin' })
    await insertUser(t, 'reviewer', { role: 'reviewer' })
    const hostId = await insertUser(t, 'host', { verified: true })
    const recipientId = await insertUser(t, 'recipient', { verified: true })
    const staleHostId = await insertUser(t, 'stale-host', { verified: true })
    const unverifiedId = await insertUser(t, 'unverified')
    const circleId = await createCircle(t, 'admin', hostId)
    const recipientMembershipId = await insertMembership(t, circleId, recipientId, 'active')
    await insertMembership(t, circleId, staleHostId, 'active', 'host')
    await insertMembership(t, circleId, unverifiedId, 'active')
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.initiateHostTransfer, { circleId, recipientUserId: recipientId })

    await expect(t.withIdentity({ subject: 'reviewer' }).mutation(api.circles.emergencyRecoverHost, { circleId, recipientUserId: recipientId, reason: 'Host unavailable' }))
      .rejects.toThrow('Full admin role required')
    await expect(t.withIdentity({ subject: 'admin' }).mutation(api.circles.emergencyRecoverHost, { circleId, recipientUserId: unverifiedId, reason: 'Host unavailable' }))
      .rejects.toThrow('identity approval')

    await t.withIdentity({ subject: 'admin' }).mutation(api.circles.setState, { circleId, state: 'suspended' })
    await t.withIdentity({ subject: 'admin' }).mutation(api.circles.emergencyRecoverHost, {
      circleId,
      recipientUserId: recipientId,
      reason: 'The current host cannot access their account.',
    })
    const snapshot = await t.run(async (ctx) => ({
      circle: await ctx.db.get(circleId),
      rows: await ctx.db.query('circleMemberships').withIndex('by_circle_state', (q) => q.eq('circleId', circleId).eq('state', 'active')).collect(),
      audits: await ctx.db.query('auditLogs').collect(),
      notifications: await ctx.db.query('notifications').collect(),
    }))
    expect(snapshot.circle).toMatchObject({ hostUserId: recipientId, state: 'suspended' })
    expect(snapshot.circle?.pendingHostUserId).toBeUndefined()
    expect(snapshot.rows.filter((row) => row.role === 'host')).toEqual([expect.objectContaining({ _id: recipientMembershipId, userId: recipientId })])
    expect(snapshot.audits.filter((entry) => entry.action === 'circle.host_emergency_recovered')).toEqual([
      expect.objectContaining({ note: 'The current host cannot access their account.' }),
    ])
    expect(snapshot.notifications.filter((row) => row.dedupeKey.startsWith(`circle-host-recovery:${circleId}:`)).map((row) => row.recipientUserId).sort())
      .toEqual([hostId, recipientId].sort())
  })
})
