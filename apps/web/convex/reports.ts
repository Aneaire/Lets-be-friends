import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireViewer, writeAudit } from './lib'

export const create = mutation({
  args: {
    targetType: v.union(v.literal('profile'), v.literal('booking'), v.literal('message'), v.literal('review'), v.literal('post'), v.literal('comment'), v.literal('user')),
    targetId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const now = Date.now()
    const reportId = await ctx.db.insert('reports', { reporterId: viewer._id, ...args, status: 'open', createdAt: now, updatedAt: now })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'report.created', targetType: args.targetType, targetId: args.targetId, note: args.reason })
    return reportId
  },
})
