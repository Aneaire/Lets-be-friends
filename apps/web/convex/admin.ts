import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireViewer, writeAudit } from './lib'

async function requireAdmin(ctx: any) {
  const viewer = await requireViewer(ctx)
  if (viewer.role !== 'owner' && viewer.role !== 'reviewer') throw new Error('Admin role required')
  return viewer
}

export const queues = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const hostApplications = await ctx.db.query('hostProfiles').withIndex('by_status', (q) => q.eq('status', 'pending_review')).collect()
    const bookingVerifications = await ctx.db.query('verificationRequests').withIndex('by_admin_status', (q) => q.eq('adminStatus', 'pending')).collect()
    const reports = await ctx.db.query('reports').withIndex('by_status', (q) => q.eq('status', 'open')).collect()
    const auditLogs = await ctx.db.query('auditLogs').withIndex('by_created_at').order('desc').take(20)
    return { hostApplications, bookingVerifications, reports, auditLogs }
  },
})

export const reviewHostApplication = mutation({
  args: { hostProfileId: v.id('hostProfiles'), decision: v.union(v.literal('approved'), v.literal('rejected')), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    const host = await ctx.db.get(args.hostProfileId)
    if (!host) throw new Error('Host profile not found')
    const now = Date.now()
    await ctx.db.patch(args.hostProfileId, { status: args.decision, reviewerUserId: admin._id, reviewerNote: args.note, updatedAt: now })
    if (args.decision === 'approved') await ctx.db.patch(host.userId, { role: 'friend_host', verificationStatus: 'approved', updatedAt: now })
    const verification = await ctx.db.query('verificationRequests').withIndex('by_host_profile', (q) => q.eq('hostProfileId', args.hostProfileId)).first()
    if (verification) await ctx.db.patch(verification._id, { adminStatus: args.decision === 'approved' ? 'approved' : 'rejected', personaStatus: args.decision === 'approved' ? 'approved' : verification.personaStatus, reviewerUserId: admin._id, reviewerNote: args.note, updatedAt: now })
    await writeAudit(ctx, { actorUserId: admin._id, action: `host_application.${args.decision}`, targetType: 'hostProfile', targetId: String(args.hostProfileId), note: args.note })
  },
})

export const reviewBookingVerification = mutation({
  args: { verificationRequestId: v.id('verificationRequests'), decision: v.union(v.literal('approved'), v.literal('rejected')), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    const verification = await ctx.db.get(args.verificationRequestId)
    if (!verification) throw new Error('Verification request not found')
    const now = Date.now()
    await ctx.db.patch(args.verificationRequestId, { adminStatus: args.decision, personaStatus: args.decision, reviewerUserId: admin._id, reviewerNote: args.note, updatedAt: now })
    await ctx.db.patch(verification.userId, { verificationStatus: args.decision, updatedAt: now })
    if (verification.bookingId) {
      await ctx.db.patch(verification.bookingId, { status: args.decision === 'approved' ? 'request_sent' : 'cancelled', updatedAt: now })
    }
    await writeAudit(ctx, { actorUserId: admin._id, action: `booking_verification.${args.decision}`, targetType: 'verificationRequest', targetId: String(args.verificationRequestId), note: args.note })
  },
})

export const resolveReport = mutation({
  args: { reportId: v.id('reports'), status: v.union(v.literal('reviewing'), v.literal('resolved'), v.literal('dismissed')), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    await ctx.db.patch(args.reportId, { status: args.status, reviewerUserId: admin._id, reviewerNote: args.note, updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: admin._id, action: `report.${args.status}`, targetType: 'report', targetId: String(args.reportId), note: args.note })
  },
})
