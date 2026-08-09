import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { activityCategories, normalizeUsername, usernameValidationError } from '@lets-be-friends/shared'
import { requireViewer, writeAudit } from './lib'
import { hasCurrentIdentityApproval, identityTestBypassAllowed } from './identityVerification'

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
      role: user.role === 'owner' ? 'admin' as const : user.role,
      identityEligible: hasCurrentIdentityApproval(user),
      identityTestBypassAvailable: identityTestBypassAllowed(user),
      identityTestBypassActive: identityTestBypassAllowed(user) && user.identityTestBypass === true,
      profileImageUrl: await profileImageUrl(ctx, user),
    }
  },
})

export const usernameAvailability = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const username = normalizeUsername(args.username)
    const validationError = usernameValidationError(username)
    if (validationError) return { username, available: false, validationError }

    const clerkUserId = await getClerkUserId(ctx)
    const existing = await ctx.db.query('users').withIndex('by_username', (q) => q.eq('username', username)).unique()
    return {
      username,
      available: !existing || existing.clerkUserId === clerkUserId,
      validationError: null,
    }
  },
})

export const claimUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const username = normalizeUsername(args.username)
    const validationError = usernameValidationError(username)
    if (validationError) throw new Error(validationError)
    if (viewer.username && viewer.username !== username) {
      throw new Error('Your username is permanent and cannot be changed.')
    }
    if (viewer.username === username) return username

    const existing = await ctx.db.query('users').withIndex('by_username', (q) => q.eq('username', username)).unique()
    if (existing && existing._id !== viewer._id) throw new Error('That username is already taken.')

    await ctx.db.patch(viewer._id, { username, updatedAt: Date.now() })
    return username
  },
})

export const setIdentityTestBypass = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (!identityTestBypassAllowed(viewer)) throw new Error('Identity test bypass is not available for this account')
    const before = viewer.identityTestBypass === true
    if (before === args.enabled) return args.enabled
    await ctx.db.patch(viewer._id, { identityTestBypass: args.enabled, updatedAt: Date.now() })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: args.enabled ? 'identity.test_bypass_enabled' : 'identity.test_bypass_disabled',
      targetType: 'user',
      targetId: String(viewer._id),
      before: { identityTestBypass: before },
      after: { identityTestBypass: args.enabled },
      note: 'Testing only. No provider or admin identity approval was created.',
    })
    return args.enabled
  },
})

export const latestMemberVerification = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    const requests = await memberVerificationRequests(ctx, viewer._id)
    const latest = requests.slice().sort((a: any, b: any) => {
      if (a.isCurrent === true && b.isCurrent !== true) return -1
      if (b.isCurrent === true && a.isCurrent !== true) return 1
      return b.updatedAt - a.updatedAt
    })[0]
    if (!latest) return null
    return {
      _id: latest._id,
      reason: latest.reason,
      personaInquiryId: latest.personaInquiryId,
      personaStatus: latest.personaStatus,
      personaDecision: latest.personaDecision ?? 'unknown',
      adminStatus: latest.adminStatus,
      isCurrent: latest.isCurrent,
      attempt: latest.attempt,
      providerCompletedAt: latest.providerCompletedAt,
      adminQueuedAt: latest.adminQueuedAt,
      reviewedAt: latest.reviewedAt,
      providerFailureCode: latest.providerFailureCode,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    }
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
    const existingAdmin = await hasAdminAccount(ctx)
    return await ctx.db.insert('users', {
      clerkUserId,
      displayName: args.displayName.trim() || 'New friend',
      role: existingAdmin ? 'member' : 'admin',
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
    if (!viewer.username) throw new Error('Choose a username before completing your welcome guide')
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
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    onboardingCategories: v.optional(v.array(v.string())),
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
    const firstName = normalizeOptional(args.firstName, 40)
    const lastName = normalizeOptional(args.lastName, 40)
    const onboardingCategories = args.onboardingCategories
      ? [...new Set(args.onboardingCategories.map((category) => category.trim()).filter(Boolean))]
      : undefined
    if (onboardingCategories && onboardingCategories.length > 6) throw new Error('Choose up to 6 categories')
    if (onboardingCategories?.some((category) => !(activityCategories as readonly string[]).includes(category))) {
      throw new Error('Choose categories from the available list')
    }

    const bio = normalizeOptional(args.bio, 500)
    const existing = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId)).unique()
    if (args.profileImageStorageId) await requireImageStorage(ctx, args.profileImageStorageId)

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName,
        ...(args.firstName !== undefined ? { firstName } : {}),
        ...(args.lastName !== undefined ? { lastName } : {}),
        ...(args.onboardingCategories !== undefined ? { onboardingCategories } : {}),
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

    const existingAdmin = await hasAdminAccount(ctx)
    return await ctx.db.insert('users', {
      clerkUserId,
      displayName,
      firstName,
      lastName,
      onboardingCategories,
      profileImageStorageId: args.profileImageStorageId,
      bio,
      role: existingAdmin ? 'member' : 'admin',
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
  return await ctx.db.query('verificationRequests').withIndex('by_user', (q: any) => q.eq('userId', userId)).collect()
}

async function hasAdminAccount(ctx: any) {
  const admin = await ctx.db.query('users').withIndex('by_role', (q: any) => q.eq('role', 'admin')).first()
  if (admin) return true
  const legacyOwner = await ctx.db.query('users').withIndex('by_role', (q: any) => q.eq('role', 'owner')).first()
  return Boolean(legacyOwner)
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
