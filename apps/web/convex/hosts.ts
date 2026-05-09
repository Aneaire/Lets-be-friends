import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getViewer, requireViewer, writeAudit } from './lib'

const demoHosts = [
  { _id: 'demo-1', displayName: 'Maya', city: 'Cebu City', mode: 'both', rating: 4.9, reviewCount: 24, intro: 'Coffee companion and local walk buddy who knows calm cafes and beginner-friendly city routes.', strengths: ['Coffee companion', 'Local tour buddy', 'Good listener'], categories: ['Coffee or meal companion', 'Local walk or city guide'] },
  { _id: 'demo-2', displayName: 'Jo', city: 'Online', mode: 'online', rating: 4.8, reviewCount: 18, intro: 'Online coworking and study partner for people who want accountability without pressure.', strengths: ['Study partner', 'Online chat friend', 'Language practice'], categories: ['Online coworking', 'Language practice'] },
  { _id: 'demo-3', displayName: 'Rafi', city: 'Bohol', mode: 'in_person', rating: 4.7, reviewCount: 12, intro: 'Photography walk partner for safe public routes, food stops, and relaxed creative exploration.', strengths: ['Photography walk partner', 'Food trip companion', 'Local tour buddy'], categories: ['Photography or creative walk', 'Travel or neighborhood guide'] },
] as const

export const listApproved = query({
  args: {},
  handler: async (ctx) => {
    const hosts = await ctx.db.query('hostProfiles').withIndex('by_status', (q) => q.eq('status', 'approved')).collect()
    if (hosts.length === 0) return demoHosts as any
    return hosts.map((host) => ({ ...host, _id: host._id }))
  },
})

export const myApplication = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return null
    return await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
  },
})

export const submitApplication = mutation({
  args: {
    displayName: v.string(),
    intro: v.string(),
    city: v.string(),
    approximateArea: v.optional(v.string()),
    strengths: v.array(v.string()),
    categories: v.array(v.string()),
    boundaries: v.array(v.string()),
    mode: v.union(v.literal('online'), v.literal('in_person'), v.literal('both')),
    applicationNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const now = Date.now()
    const existing = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    const patch = { ...args, status: 'pending_review' as const, rating: existing?.rating ?? 0, reviewCount: existing?.reviewCount ?? 0, updatedAt: now }
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
