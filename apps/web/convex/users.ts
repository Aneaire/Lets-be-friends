import { isMemberVerificationReason } from '@lets-be-friends/shared'
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireViewer, writeAudit } from './lib'

async function getClerkUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.subject ?? null
}

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const clerkUserId = await getClerkUserId(ctx)
    if (!clerkUserId) return null
    const user = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId)).unique()
    if (!user) return null
    return {
      ...user,
      profileImageUrl: await profileImageUrl(ctx, user),
    }
  },
})

export const latestMemberVerification = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    const requests = await memberVerificationRequests(ctx, viewer._id)
    const latest = requests.slice().sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0]
    if (!latest) return null
    return {
      _id: latest._id,
      reason: latest.reason,
      adminStatus: latest.adminStatus,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    }
  },
})

export const startIdentityVerification = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    if (viewer.verificationStatus === 'approved') {
      return { requestId: null, status: 'approved' as const, created: false }
    }

    const requests = await memberVerificationRequests(ctx, viewer._id)
    const pending = requests.find((request) => request.adminStatus === 'pending')
    if (pending) {
      if (viewer.verificationStatus !== 'pending') {
        await ctx.db.patch(viewer._id, { verificationStatus: 'pending', updatedAt: Date.now() })
      }
      return { requestId: pending._id, status: 'pending' as const, created: false }
    }

    const latest = requests.slice().sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0]
    const reason: 'member' | 'reverification' =
      viewer.verificationStatus === 'rejected' || latest?.adminStatus === 'rejected'
        ? 'reverification'
        : 'member'
    const now = Date.now()
    const requestId = await ctx.db.insert('verificationRequests', {
      userId: viewer._id,
      reason,
      personaStatus: 'not_started',
      adminStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(viewer._id, { verificationStatus: 'pending', updatedAt: now })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: reason === 'reverification' ? 'member_verification.retried' : 'member_verification.started',
      targetType: 'verificationRequest',
      targetId: String(requestId),
    })
    return { requestId, status: 'pending' as const, created: true }
  },
})

export const ensureViewer = mutation({
  args: {
    displayName: v.string(),
    expectedClerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx)
    if (args.expectedClerkUserId !== undefined && args.expectedClerkUserId !== clerkUserId) {
      throw new Error('Your signed-in account changed. Please reload and try again.')
    }
    if (!clerkUserId) throw new Error('Authentication required')
    const existing = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId)).unique()
    if (existing) return existing._id

    const now = Date.now()
    const existingOwner = await ctx.db.query('users').withIndex('by_role', (q) => q.eq('role', 'owner')).first()
    return await ctx.db.insert('users', {
      clerkUserId,
      displayName: args.displayName.trim() || 'New friend',
      role: existingOwner ? 'member' : 'owner',
      verificationStatus: 'not_started',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const completeOnboarding = mutation({
  args: { goal: v.union(v.literal('member'), v.literal('friend_host')) },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx)
    if (!clerkUserId) throw new Error('Authentication required')
    const viewer = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId)).unique()
    if (!viewer) throw new Error('Account setup is not complete')
    const now = Date.now()
    await ctx.db.patch(viewer._id, {
      onboardingGoal: args.goal,
      onboardingCompletedAt: viewer.onboardingCompletedAt ?? now,
      updatedAt: now,
    })
    return viewer._id
  },
})

export const updateProfile = mutation({
  args: {
    displayName: v.string(),
    profileImageStorageId: v.optional(v.id('_storage')),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx)
    if (!clerkUserId) throw new Error('Authentication required')
    const now = Date.now()
    const displayName = args.displayName.trim()
    if (displayName.length < 1) throw new Error('Name is required')
    if (displayName.length > 80) throw new Error('Name is too long')

    const bio = normalizeOptional(args.bio, 500)
    const existing = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId)).unique()
    if (args.profileImageStorageId) await requireImageStorage(ctx, args.profileImageStorageId)

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName,
        ...(args.profileImageStorageId ? { profileImageStorageId: args.profileImageStorageId, profileImageUrl: undefined } : {}),
        bio,
        updatedAt: now,
      })
      const hostProfile = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', existing._id)).first()
      if (hostProfile) await ctx.db.patch(hostProfile._id, { displayName, updatedAt: now })
      if (args.profileImageStorageId && existing.profileImageStorageId && existing.profileImageStorageId !== args.profileImageStorageId) {
        await ctx.storage.delete(existing.profileImageStorageId)
      }
      return existing._id
    }

    const existingOwner = await ctx.db.query('users').withIndex('by_role', (q) => q.eq('role', 'owner')).first()
    return await ctx.db.insert('users', {
      clerkUserId,
      displayName,
      profileImageStorageId: args.profileImageStorageId,
      bio,
      role: existingOwner ? 'member' : 'owner',
      verificationStatus: 'not_started',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const generateProfileImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const clerkUserId = await getClerkUserId(ctx)
    if (!clerkUserId) throw new Error('Authentication required')
    return await ctx.storage.generateUploadUrl()
  },
})

async function memberVerificationRequests(ctx: any, userId: any) {
  const reasons = ['member', 'reverification', 'booking'] as const
  const groups = await Promise.all(reasons.map((reason) =>
    ctx.db
      .query('verificationRequests')
      .withIndex('by_user_reason', (q: any) => q.eq('userId', userId).eq('reason', reason))
      .collect(),
  ))
  return groups.flat().filter((request: any) => isMemberVerificationReason(request.reason))
}

function normalizeOptional(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (trimmed.length > maxLength) throw new Error('Profile field is too long')
  return trimmed
}

async function profileImageUrl(ctx: any, user: { profileImageStorageId?: any; profileImageUrl?: string }) {
  if (!user.profileImageStorageId) return user.profileImageUrl
  return await ctx.storage.getUrl(user.profileImageStorageId) ?? user.profileImageUrl
}

async function requireImageStorage(ctx: any, storageId: any) {
  const metadata = await ctx.db.system.get('_storage', storageId)
  if (!metadata) throw new Error('Uploaded profile image was not found')
  if (metadata.size > 5 * 1024 * 1024) throw new Error('Profile image must be 5 MB or smaller')
  if (metadata.contentType && !metadata.contentType.startsWith('image/')) {
    throw new Error('Profile image must be an image file')
  }
}
