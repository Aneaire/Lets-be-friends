import { bookingEligibility, canBookHost } from '@lets-be-friends/shared'
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getViewer, requireViewer, writeAudit } from './lib'

const demoHosts = [
  { _id: 'demo-1', displayName: 'Maya', city: 'Cebu City', mode: 'both', rating: 4.9, reviewCount: 24, intro: 'Coffee companion and local walk buddy who knows calm cafes and beginner-friendly city routes.', strengths: ['Coffee companion', 'Local tour buddy', 'Good listener'], categories: ['Coffee or meal companion', 'Local walk or city guide'], bookable: false, viewerCanBook: true, demo: true },
  { _id: 'demo-2', displayName: 'Jo', city: 'Online', mode: 'online', rating: 4.8, reviewCount: 18, intro: 'Online coworking and study partner for people who want accountability without pressure.', strengths: ['Study partner', 'Online chat friend', 'Language practice'], categories: ['Online coworking', 'Language practice'], bookable: false, viewerCanBook: true, demo: true },
  { _id: 'demo-3', displayName: 'Rafi', city: 'Bohol', mode: 'in_person', rating: 4.7, reviewCount: 12, intro: 'Photography walk partner for safe public routes, food stops, and relaxed creative exploration.', strengths: ['Photography walk partner', 'Food trip companion', 'Local tour buddy'], categories: ['Photography or creative walk', 'Travel or neighborhood guide'], bookable: false, viewerCanBook: true, demo: true },
] as const

export const listApproved = query({
  args: {
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    radiusKm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    const hosts = await ctx.db.query('hostProfiles').withIndex('by_status', (q) => q.eq('status', 'approved')).collect()
    if (hosts.length === 0) return demoHosts as any
    const radiusKm = Math.min(Math.max(args.radiusKm ?? 25, 1), 200)
    const hasOrigin = typeof args.latitude === 'number' && typeof args.longitude === 'number'
    const withDistance = hosts
      .map((host) => ({
        host,
        distanceKm: hasOrigin && typeof host.approximateLatitude === 'number' && typeof host.approximateLongitude === 'number'
          ? distanceKm(args.latitude!, args.longitude!, host.approximateLatitude, host.approximateLongitude)
          : undefined,
      }))
      .filter(({ host, distanceKm }) => !hasOrigin || host.mode === 'online' || (typeof distanceKm === 'number' && distanceKm <= radiusKm))
      .sort((a, b) => {
        if (!hasOrigin) return b.host.rating - a.host.rating
        if (a.host.mode === 'online' && b.host.mode !== 'online') return 1
        if (b.host.mode === 'online' && a.host.mode !== 'online') return -1
        return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY)
      })

    return await Promise.all(withDistance.map(async ({ host, distanceKm }) => {
      const user = await ctx.db.get(host.userId)
      const { approximateArea: _approximateArea, approximateLatitude: _approximateLatitude, approximateLongitude: _approximateLongitude, ...publicHost } = host
      return {
        ...publicHost,
        displayName: user?.displayName ?? host.displayName,
        profileImageUrl: user ? await profileImageUrl(ctx, user) : undefined,
        bio: user?.bio,
        distanceKm: typeof distanceKm === 'number' ? Math.round(distanceKm * 10) / 10 : undefined,
        _id: host._id,
        bookable: true,
        viewerCanBook: canBookHost(viewer ? String(viewer._id) : null, String(host.userId)),
        viewerBookingEligibility: bookingEligibility(
          viewer ? String(viewer._id) : null,
          viewer?.verificationStatus,
          String(host.userId),
        ),
        demo: false,
        saved: viewer ? Boolean(await ctx.db.query('savedProfiles').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('hostProfileId', host._id)).first()) : false,
        following: viewer ? Boolean(await ctx.db.query('follows').withIndex('by_pair', (q) => q.eq('followerId', viewer._id).eq('followingId', host.userId)).first()) : false,
      }
    }))
  },
})

export const getPublic = query({
  args: { hostProfileId: v.id('hostProfiles') },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    const host = await ctx.db.get(args.hostProfileId)
    if (!host || host.status !== 'approved') return null
    const user = await ctx.db.get(host.userId)
    const { approximateArea: _approximateArea, approximateLatitude: _approximateLatitude, approximateLongitude: _approximateLongitude, ...publicHost } = host
    return {
      ...publicHost,
      displayName: user?.displayName ?? host.displayName,
      profileImageUrl: user ? await profileImageUrl(ctx, user) : undefined,
      bio: user?.bio,
      viewerCanBook: canBookHost(viewer ? String(viewer._id) : null, String(host.userId)),
      viewerBookingEligibility: bookingEligibility(
        viewer ? String(viewer._id) : null,
        viewer?.verificationStatus,
        String(host.userId),
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
    return {
      ...host,
      displayName: viewer.displayName,
      profileImageUrl: await profileImageUrl(ctx, viewer),
      bio: viewer.bio,
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
    strengths: v.array(v.string()),
    categories: v.array(v.string()),
    boundaries: v.array(v.string()),
    mode: v.union(v.literal('online'), v.literal('in_person'), v.literal('both')),
    applicationNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const now = Date.now()
    const approximateLatitude = typeof args.approximateLatitude === 'number' ? roundCoordinate(args.approximateLatitude) : undefined
    const approximateLongitude = typeof args.approximateLongitude === 'number' ? roundCoordinate(args.approximateLongitude) : undefined
    const existing = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    const patch = { ...args, displayName: viewer.displayName, approximateLatitude, approximateLongitude, status: 'pending_review' as const, rating: existing?.rating ?? 0, reviewCount: existing?.reviewCount ?? 0, updatedAt: now }
    const hostProfileId = existing
      ? (await ctx.db.patch(existing._id, patch), existing._id)
      : await ctx.db.insert('hostProfiles', { userId: viewer._id, ...patch, createdAt: now })

    const verificationId = await ctx.db.insert('verificationRequests', {
      userId: viewer._id,
      reason: 'host_application',
      personaInquiryId: `persona_dummy_host_${hostProfileId}`,
      personaStatus: 'pending',
      adminStatus: 'pending',
      hostProfileId,
      createdAt: now,
      updatedAt: now,
    })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'host_application.submitted', targetType: 'hostProfile', targetId: String(hostProfileId), note: `Verification placeholder ${verificationId}` })
    return hostProfileId
  },
})

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRadians(value: number) {
  return value * Math.PI / 180
}

async function profileImageUrl(ctx: any, user: { profileImageStorageId?: any; profileImageUrl?: string }) {
  if (!user.profileImageStorageId) return user.profileImageUrl
  return await ctx.storage.getUrl(user.profileImageStorageId) ?? user.profileImageUrl
}
