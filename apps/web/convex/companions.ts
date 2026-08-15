import {
  MAX_COMPANION_HOURLY_RATE_CENTAVOS,
  MIN_COMPANION_HOURLY_RATE_CENTAVOS,
  bookingEligibility,
  canBookCompanion,
  validateCompanionHourlyRateCentavos,
} from '@lets-be-friends/shared'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { v } from 'convex/values'
import { getViewer, requireViewer, writeAudit } from './lib'
import { hasCurrentIdentityApproval, isIdentityVerificationReason } from './identityVerification'
import { findNearbyCompanionLocations, syncCompanionLocation } from './companionLocations'
import { isHiddenByPreference, requireNotBlocked } from './safety'

const nearbyRadiusOptions = [5, 10, 25, 50, 100] as const

export const listApproved = query({
  args: {
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    radiusKm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const origin = validateNearbyOrigin(args)
    const viewer = await getViewer(ctx)
    const radiusKm = args.radiusKm ?? 25
    const withDistance = origin
      ? await indexedNearbyCompanions(ctx, origin, radiusKm)
      : (await ctx.db.query('companionProfiles').withIndex('by_status', (q) => q.eq('status', 'approved')).collect())
          .map((companion) => ({ companion, distanceKm: undefined }))

    withDistance
      .sort((a, b) => {
        if (!origin) return b.companion.rating - a.companion.rating
        if (a.companion.mode === 'online' && b.companion.mode !== 'online') return 1
        if (b.companion.mode === 'online' && a.companion.mode !== 'online') return -1
        return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY)
      })

    const results = await Promise.all(withDistance.map(async ({ companion, distanceKm }) => {
      const user = await ctx.db.get(companion.userId)
      if (!user || user.suspended || !hasCurrentIdentityApproval(user)) return null
      if (viewer && viewer._id !== user._id && await isHiddenByPreference(ctx, viewer._id, user._id)) return null
      const [profileImage, savedProfile, followedUser] = await Promise.all([
        profileImageUrl(ctx, user),
        viewer ? ctx.db.query('savedProfiles').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('companionProfileId', companion._id)).first() : null,
        viewer ? ctx.db.query('follows').withIndex('by_pair', (q) => q.eq('followerId', viewer._id).eq('followingId', companion.userId)).first() : null,
      ])
      return {
        ...publicCompanionProfile(companion),
        username: user.username,
        displayName: user.displayName,
        profileImageUrl: profileImage,
        bio: user.bio,
        distanceKm: typeof distanceKm === 'number' ? Math.round(distanceKm * 10) / 10 : undefined,
        latitude: typeof companion.approximateLatitude === 'number' ? roundCoordinate(companion.approximateLatitude) : undefined,
        longitude: typeof companion.approximateLongitude === 'number' ? roundCoordinate(companion.approximateLongitude) : undefined,
        _id: companion._id,
        bookable: hasConfiguredHourlyRate(companion.hourlyRateCentavos),
        viewerCanBook: canBookCompanion(viewer ? String(viewer._id) : null, String(companion.userId)),
        viewerBookingEligibility: bookingEligibility(
          viewer ? String(viewer._id) : null,
          viewer?.verificationStatus,
          String(companion.userId),
          viewer ? hasCurrentIdentityApproval(viewer) : false,
        ),
        saved: Boolean(savedProfile),
        following: Boolean(followedUser),
      }
    }))
    return results.filter((companion) => companion !== null)
  },
})

export const getPublic = query({
  args: { companionProfileId: v.id('companionProfiles') },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    const companion = await ctx.db.get(args.companionProfileId)
    if (!companion || companion.status !== 'approved') return null
    const user = await ctx.db.get(companion.userId)
    if (!user || user.suspended || !hasCurrentIdentityApproval(user)) return null
    if (viewer && viewer._id !== user._id && await isHiddenByPreference(ctx, viewer._id, user._id)) return null
    return {
      ...publicCompanionProfile(companion),
      username: user.username,
      displayName: user.displayName,
      firstName: user.firstName ?? user.displayName,
      profileImageUrl: await profileImageUrl(ctx, user),
      bio: user.bio,
      bookable: hasConfiguredHourlyRate(companion.hourlyRateCentavos),
      viewerCanBook: canBookCompanion(viewer ? String(viewer._id) : null, String(companion.userId)),
      viewerBookingEligibility: bookingEligibility(
        viewer ? String(viewer._id) : null,
        viewer?.verificationStatus,
        String(companion.userId),
        viewer ? hasCurrentIdentityApproval(viewer) : false,
      ),
      saved: viewer ? Boolean(await ctx.db.query('savedProfiles').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('companionProfileId', companion._id)).first()) : false,
      following: viewer ? Boolean(await ctx.db.query('follows').withIndex('by_pair', (q) => q.eq('followerId', viewer._id).eq('followingId', companion.userId)).first()) : false,
    }
  },
})

export const toggleSaveProfile = mutation({
  args: { companionProfileId: v.id('companionProfiles') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const companion = await ctx.db.get(args.companionProfileId)
    if (!companion || companion.status !== 'approved') throw new Error('Profile is not available')
    await requireNotBlocked(ctx, viewer._id, companion.userId)
    const existing = await ctx.db.query('savedProfiles').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('companionProfileId', args.companionProfileId)).first()
    if (existing) {
      await ctx.db.delete(existing._id)
      await writeAudit(ctx, { actorUserId: viewer._id, action: 'profile.unsaved', targetType: 'companionProfile', targetId: String(args.companionProfileId) })
      return false
    }
    await ctx.db.insert('savedProfiles', { userId: viewer._id, companionProfileId: args.companionProfileId, createdAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'profile.saved', targetType: 'companionProfile', targetId: String(args.companionProfileId) })
    return true
  },
})

export const myApplication = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return null
    const companion = await ctx.db.query('companionProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    if (!companion) return null
    const identityRequests = await ctx.db.query('verificationRequests').withIndex('by_user', (q) => q.eq('userId', viewer._id)).collect()
    const identityVerification = identityRequests
      .filter((request) => isIdentityVerificationReason(request.reason))
      .sort((a, b) => {
        if (a.isCurrent === true && b.isCurrent !== true) return -1
        if (b.isCurrent === true && a.isCurrent !== true) return 1
        return b.updatedAt - a.updatedAt
      })[0]
    return {
      ...companion,
      displayName: viewer.displayName,
      profileImageUrl: await profileImageUrl(ctx, viewer),
      bio: viewer.bio,
      identityEligible: hasCurrentIdentityApproval(viewer),
      identityVerification: identityVerification ? {
        _id: identityVerification._id,
        personaStatus: identityVerification.personaStatus,
        personaDecision: identityVerification.personaDecision ?? 'unknown',
        adminStatus: identityVerification.adminStatus,
      } : null,
    }
  },
})

export const submitApplication = mutation({
  args: {
    intro: v.string(),
    city: v.string(),
    strengths: v.array(v.string()),
    categories: v.array(v.string()),
    boundaries: v.array(v.string()),
    mode: v.union(v.literal('online'), v.literal('in_person'), v.literal('both')),
    hourlyRateCentavos: v.number(),
    applicationNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const now = Date.now()
    validateCompanionHourlyRateCentavos(args.hourlyRateCentavos)
    const existing = await ctx.db.query('companionProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    const sourceLatitude = viewer.approximateLatitude ?? existing?.approximateLatitude
    const sourceLongitude = viewer.approximateLongitude ?? existing?.approximateLongitude
    validateCoordinatePair(sourceLatitude, sourceLongitude)
    if (typeof sourceLatitude !== 'number' || typeof sourceLongitude !== 'number') {
      throw new Error('Complete onboarding with an approximate location before applying as a Companion')
    }
    if (!viewer.approximateLocationConsentedAt || !viewer.termsAcceptedAt || viewer.termsVersion !== '2026-08-13') {
      throw new Error('Accept the current location consent and Terms and Conditions before applying as a Companion')
    }
    const patch = {
      ...args,
      displayName: viewer.displayName,
      approximateArea: undefined,
      approximateLatitude: roundCoordinate(sourceLatitude),
      approximateLongitude: roundCoordinate(sourceLongitude),
      status: 'pending_review' as const,
      rating: existing?.rating ?? 0,
      reviewCount: existing?.reviewCount ?? 0,
      updatedAt: now,
    }
    const companionProfileId = existing
      ? (await ctx.db.patch(existing._id, patch), existing._id)
      : await ctx.db.insert('companionProfiles', { userId: viewer._id, ...patch, createdAt: now })

    const companion = await ctx.db.get(companionProfileId)
    if (!companion) throw new Error('Companion profile was not saved')
    await syncCompanionLocation(ctx, companion, viewer)

    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'companion_application.submitted',
      targetType: 'companionProfile',
      targetId: String(companionProfileId),
      after: { status: 'pending_review', identityApproved: hasCurrentIdentityApproval(viewer) },
    })
    return companionProfileId
  },
})

export const updateHourlyRate = mutation({
  args: { hourlyRateCentavos: v.number() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const hourlyRateCentavos = validateCompanionHourlyRateCentavos(args.hourlyRateCentavos)
    const companion = await ctx.db.query('companionProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    if (!companion) throw new Error('Create a Companion profile before setting an hourly rate')
    await ctx.db.patch(companion._id, { hourlyRateCentavos, updatedAt: Date.now() })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'companion_profile.hourly_rate_updated',
      targetType: 'companionProfile',
      targetId: String(companion._id),
      before: { hourlyRateCentavos: companion.hourlyRateCentavos },
      after: { hourlyRateCentavos },
    })
    return hourlyRateCentavos
  },
})

function validateNearbyOrigin(args: { latitude?: number; longitude?: number; radiusKm?: number }) {
  if (args.radiusKm !== undefined && !nearbyRadiusOptions.includes(args.radiusKm as typeof nearbyRadiusOptions[number])) {
    throw new Error('Radius must be 5, 10, 25, 50, or 100 km')
  }
  validateCoordinatePair(args.latitude, args.longitude)
  if (args.latitude === undefined || args.longitude === undefined) return null
  return { latitude: args.latitude, longitude: args.longitude }
}

function validateCoordinatePair(latitude?: number, longitude?: number) {
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new Error('Latitude and longitude must be provided together')
  }
  if (latitude === undefined || longitude === undefined) return
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90')
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180')
  }
}

function publicCompanionProfile(companion: Doc<'companionProfiles'>) {
  const {
    approximateArea: _approximateArea,
    approximateLatitude: _approximateLatitude,
    approximateLongitude: _approximateLongitude,
    nearbyDiscoveryEnabled: _nearbyDiscoveryEnabled,
    ...publicCompanion
  } = companion
  return publicCompanion
}

function hasConfiguredHourlyRate(value: number | undefined) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= MIN_COMPANION_HOURLY_RATE_CENTAVOS
    && value <= MAX_COMPANION_HOURLY_RATE_CENTAVOS
}

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100
}

async function indexedNearbyCompanions(
  ctx: Parameters<typeof findNearbyCompanionLocations>[0],
  origin: { latitude: number; longitude: number },
  radiusKm: number,
) {
  const locations = await findNearbyCompanionLocations(ctx, origin, radiusKm)
  const locatedCompanions = await Promise.all(locations.map(async ({ key, distance }) => ({
    companion: await ctx.db.get(key),
    distanceKm: distance / 1_000,
  })))

  return locatedCompanions.flatMap(({ companion, distanceKm }) => companion
    && companion.status === 'approved'
    ? [{ companion, distanceKm }]
    : [])
}

async function profileImageUrl(ctx: any, user: { profileImageStorageId?: any; profileImageUrl?: string }) {
  if (!user.profileImageStorageId) return user.profileImageUrl
  return await ctx.storage.getUrl(user.profileImageStorageId) ?? user.profileImageUrl
}
