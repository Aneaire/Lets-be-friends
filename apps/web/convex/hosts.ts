import {
  MAX_HOST_HOURLY_RATE_CENTAVOS,
  MIN_HOST_HOURLY_RATE_CENTAVOS,
  bookingEligibility,
  canBookHost,
  validateHostHourlyRateCentavos,
} from '@lets-be-friends/shared'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { v } from 'convex/values'
import { getViewer, requireViewer, writeAudit } from './lib'
import { hasCurrentIdentityApproval, isIdentityVerificationReason } from './identityVerification'
import { findNearbyHostLocations, syncHostLocation } from './hostLocations'

const nearbyRadiusOptions = [5, 10, 25, 50, 100] as const

const demoHosts = [
  { _id: 'demo-1', username: 'maya_cebu', displayName: 'Maya', city: 'Cebu City', mode: 'both', rating: 4.9, reviewCount: 24, intro: 'Coffee companion and local walk buddy who knows calm cafes and beginner-friendly city routes.', strengths: ['Coffee companion', 'Local tour buddy', 'Good listener'], categories: ['Coffee and meals', 'Explore the city'], bookable: false, viewerCanBook: true, demo: true },
  { _id: 'demo-2', username: 'jo_online', displayName: 'Jo', city: 'Online', mode: 'online', rating: 4.8, reviewCount: 18, intro: 'Online coworking and study partner for people who want accountability without pressure.', strengths: ['Study partner', 'Online chat friend', 'Language practice'], categories: ['Study and coworking', 'Language exchange'], bookable: false, viewerCanBook: true, demo: true },
  { _id: 'demo-3', username: 'rafi_bohol', displayName: 'Rafi', city: 'Bohol', mode: 'in_person', rating: 4.7, reviewCount: 12, intro: 'Photography walk partner for safe public routes, food stops, and relaxed creative exploration.', strengths: ['Photography walk partner', 'Food trip companion', 'Local tour buddy'], categories: ['Photo walks', 'Explore the city'], bookable: false, viewerCanBook: true, demo: true },
] as const

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
      ? await indexedNearbyHosts(ctx, origin, radiusKm)
      : (await ctx.db.query('hostProfiles').withIndex('by_status', (q) => q.eq('status', 'approved')).collect())
          .map((host) => ({ host, distanceKm: undefined }))

    if (!origin && withDistance.length === 0) return demoHosts as any

    withDistance
      .sort((a, b) => {
        if (!origin) return b.host.rating - a.host.rating
        if (a.host.mode === 'online' && b.host.mode !== 'online') return 1
        if (b.host.mode === 'online' && a.host.mode !== 'online') return -1
        return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY)
      })

    const results = await Promise.all(withDistance.map(async ({ host, distanceKm }) => {
      const user = await ctx.db.get(host.userId)
      if (!user || user.suspended || !hasCurrentIdentityApproval(user)) return null
      const [profileImage, savedProfile, followedUser] = await Promise.all([
        profileImageUrl(ctx, user),
        viewer ? ctx.db.query('savedProfiles').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('hostProfileId', host._id)).first() : null,
        viewer ? ctx.db.query('follows').withIndex('by_pair', (q) => q.eq('followerId', viewer._id).eq('followingId', host.userId)).first() : null,
      ])
      return {
        ...publicHostProfile(host),
        username: user.username,
        displayName: user.displayName,
        profileImageUrl: profileImage,
        bio: user.bio,
        distanceKm: typeof distanceKm === 'number' ? Math.round(distanceKm * 10) / 10 : undefined,
        latitude: typeof host.approximateLatitude === 'number' ? host.approximateLatitude : undefined,
        longitude: typeof host.approximateLongitude === 'number' ? host.approximateLongitude : undefined,
        _id: host._id,
        bookable: hasConfiguredHourlyRate(host.hourlyRateCentavos),
        viewerCanBook: canBookHost(viewer ? String(viewer._id) : null, String(host.userId)),
        viewerBookingEligibility: bookingEligibility(
          viewer ? String(viewer._id) : null,
          viewer?.verificationStatus,
          String(host.userId),
          viewer ? hasCurrentIdentityApproval(viewer) : false,
        ),
        demo: false,
        saved: Boolean(savedProfile),
        following: Boolean(followedUser),
      }
    }))
    return results.filter((host) => host !== null)
  },
})

export const getPublic = query({
  args: { hostProfileId: v.id('hostProfiles') },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    const host = await ctx.db.get(args.hostProfileId)
    if (!host || host.status !== 'approved') return null
    const user = await ctx.db.get(host.userId)
    if (!user || user.suspended || !hasCurrentIdentityApproval(user)) return null
    return {
      ...publicHostProfile(host),
      username: user.username,
      displayName: user.displayName,
      firstName: user.firstName ?? user.displayName,
      profileImageUrl: await profileImageUrl(ctx, user),
      bio: user.bio,
      bookable: hasConfiguredHourlyRate(host.hourlyRateCentavos),
      viewerCanBook: canBookHost(viewer ? String(viewer._id) : null, String(host.userId)),
      viewerBookingEligibility: bookingEligibility(
        viewer ? String(viewer._id) : null,
        viewer?.verificationStatus,
        String(host.userId),
        viewer ? hasCurrentIdentityApproval(viewer) : false,
      ),
      saved: viewer ? Boolean(await ctx.db.query('savedProfiles').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('hostProfileId', host._id)).first()) : false,
      following: viewer ? Boolean(await ctx.db.query('follows').withIndex('by_pair', (q) => q.eq('followerId', viewer._id).eq('followingId', host.userId)).first()) : false,
    }
  },
})

export const toggleSaveProfile = mutation({
  args: { hostProfileId: v.id('hostProfiles') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const host = await ctx.db.get(args.hostProfileId)
    if (!host || host.status !== 'approved') throw new Error('Profile is not available')
    const existing = await ctx.db.query('savedProfiles').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('hostProfileId', args.hostProfileId)).first()
    if (existing) {
      await ctx.db.delete(existing._id)
      await writeAudit(ctx, { actorUserId: viewer._id, action: 'profile.unsaved', targetType: 'hostProfile', targetId: String(args.hostProfileId) })
      return false
    }
    await ctx.db.insert('savedProfiles', { userId: viewer._id, hostProfileId: args.hostProfileId, createdAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'profile.saved', targetType: 'hostProfile', targetId: String(args.hostProfileId) })
    return true
  },
})

export const myApplication = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return null
    const host = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    if (!host) return null
    const identityRequests = await ctx.db.query('verificationRequests').withIndex('by_user', (q) => q.eq('userId', viewer._id)).collect()
    const identityVerification = identityRequests
      .filter((request) => isIdentityVerificationReason(request.reason))
      .sort((a, b) => {
        if (a.isCurrent === true && b.isCurrent !== true) return -1
        if (b.isCurrent === true && a.isCurrent !== true) return 1
        return b.updatedAt - a.updatedAt
      })[0]
    return {
      ...host,
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
    approximateArea: v.optional(v.string()),
    approximateLatitude: v.optional(v.number()),
    approximateLongitude: v.optional(v.number()),
    nearbyDiscoveryEnabled: v.optional(v.boolean()),
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
    validateHostHourlyRateCentavos(args.hourlyRateCentavos)
    validateCoordinatePair(args.approximateLatitude, args.approximateLongitude)
    const approximateLatitude = typeof args.approximateLatitude === 'number' ? roundCoordinate(args.approximateLatitude) : undefined
    const approximateLongitude = typeof args.approximateLongitude === 'number' ? roundCoordinate(args.approximateLongitude) : undefined
    const existing = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    const patch = {
      ...args,
      displayName: viewer.displayName,
      approximateArea: args.approximateArea?.trim() || undefined,
      approximateLatitude,
      approximateLongitude,
      // Missing values opt out so legacy records are never exposed to a new nearby search by surprise.
      nearbyDiscoveryEnabled: args.nearbyDiscoveryEnabled === true,
      status: 'pending_review' as const,
      rating: existing?.rating ?? 0,
      reviewCount: existing?.reviewCount ?? 0,
      updatedAt: now,
    }
    const hostProfileId = existing
      ? (await ctx.db.patch(existing._id, patch), existing._id)
      : await ctx.db.insert('hostProfiles', { userId: viewer._id, ...patch, createdAt: now })

    const host = await ctx.db.get(hostProfileId)
    if (!host) throw new Error('Friend Host profile was not saved')
    await syncHostLocation(ctx, host, viewer)

    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'host_application.submitted',
      targetType: 'hostProfile',
      targetId: String(hostProfileId),
      after: { status: 'pending_review', identityApproved: hasCurrentIdentityApproval(viewer) },
    })
    return hostProfileId
  },
})

export const updateHourlyRate = mutation({
  args: { hourlyRateCentavos: v.number() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const hourlyRateCentavos = validateHostHourlyRateCentavos(args.hourlyRateCentavos)
    const host = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    if (!host) throw new Error('Create a Friend Host profile before setting an hourly rate')
    await ctx.db.patch(host._id, { hourlyRateCentavos, updatedAt: Date.now() })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'host_profile.hourly_rate_updated',
      targetType: 'hostProfile',
      targetId: String(host._id),
      before: { hourlyRateCentavos: host.hourlyRateCentavos },
      after: { hourlyRateCentavos },
    })
    return hourlyRateCentavos
  },
})

export const setNearbyDiscoveryVisibility = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const host = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    if (!host) throw new Error('Create a Friend Host profile before changing nearby search visibility')
    if (args.enabled && (typeof host.approximateLatitude !== 'number' || typeof host.approximateLongitude !== 'number')) {
      throw new Error('Add an approximate location before turning on nearby search')
    }
    if (host.nearbyDiscoveryEnabled === args.enabled) return args.enabled

    const now = Date.now()
    await ctx.db.patch(host._id, { nearbyDiscoveryEnabled: args.enabled, updatedAt: now })
    const updatedHost = await ctx.db.get(host._id)
    if (!updatedHost) throw new Error('Friend Host profile was not updated')
    await syncHostLocation(ctx, updatedHost, viewer)
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'host_profile.nearby_visibility_updated',
      targetType: 'hostProfile',
      targetId: String(host._id),
      before: { nearbyDiscoveryEnabled: host.nearbyDiscoveryEnabled === true },
      after: { nearbyDiscoveryEnabled: args.enabled },
    })
    return args.enabled
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

function publicHostProfile(host: Doc<'hostProfiles'>) {
  const {
    approximateArea: _approximateArea,
    approximateLatitude: _approximateLatitude,
    approximateLongitude: _approximateLongitude,
    nearbyDiscoveryEnabled: _nearbyDiscoveryEnabled,
    ...publicHost
  } = host
  return publicHost
}

function hasConfiguredHourlyRate(value: number | undefined) {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= MIN_HOST_HOURLY_RATE_CENTAVOS
    && value <= MAX_HOST_HOURLY_RATE_CENTAVOS
}

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100
}

async function indexedNearbyHosts(
  ctx: Parameters<typeof findNearbyHostLocations>[0],
  origin: { latitude: number; longitude: number },
  radiusKm: number,
) {
  const [locations, onlineHosts] = await Promise.all([
    findNearbyHostLocations(ctx, origin, radiusKm),
    ctx.db
      .query('hostProfiles')
      .withIndex('by_nearby_status_mode', (q) => q
        .eq('status', 'approved')
        .eq('nearbyDiscoveryEnabled', true)
        .eq('mode', 'online'))
      .collect(),
  ])
  const locatedHosts = await Promise.all(locations.map(async ({ key, distance }) => ({
    host: await ctx.db.get(key),
    distanceKm: distance / 1_000,
  })))

  return [
    ...locatedHosts.flatMap(({ host, distanceKm }) => host
      && host.status === 'approved'
      && host.nearbyDiscoveryEnabled === true
      && host.mode !== 'online'
      ? [{ host, distanceKm }]
      : []),
    ...onlineHosts.map((host) => ({ host, distanceKm: undefined })),
  ]
}

async function profileImageUrl(ctx: any, user: { profileImageStorageId?: any; profileImageUrl?: string }) {
  if (!user.profileImageStorageId) return user.profileImageUrl
  return await ctx.storage.getUrl(user.profileImageStorageId) ?? user.profileImageUrl
}
