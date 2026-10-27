import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireViewer } from './lib'

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    const rows = await ctx.db.query('notificationMutes')
      .withIndex('by_user', (q) => q.eq('userId', viewer._id))
      .collect()
    return rows.map((row) => ({
      targetType: row.targetType,
      targetId: row.targetId,
      createdAt: row.createdAt,
    }))
  },
})

export const setMuted = mutation({
  args: {
    targetType: v.union(v.literal('post'), v.literal('circle')),
    targetId: v.string(),
    muted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    await requireExistingTarget(ctx, args.targetType, args.targetId)
    const existing = await ctx.db.query('notificationMutes')
      .withIndex('by_user_target', (q) => q.eq('userId', viewer._id).eq('targetType', args.targetType).eq('targetId', args.targetId))
      .unique()
    if (args.muted) {
      if (!existing) {
        await ctx.db.insert('notificationMutes', {
          userId: viewer._id,
          targetType: args.targetType,
          targetId: args.targetId,
          createdAt: Date.now(),
        })
      }
    } else if (existing) {
      await ctx.db.delete(existing._id)
    }
    return args.muted
  },
})

/**
 * A viewer can silence notifications from one post or Circle without affecting
 * anyone else. Booking, message, safety, and identity notifications never carry
 * these targets, so they are never skipped here.
 */
export async function isNotificationTargetMuted(
  ctx: { db: any },
  userId: Id<'users'>,
  target: { postId?: string; circleId?: string },
): Promise<boolean> {
  const checks: Array<{ targetType: 'post' | 'circle'; targetId: string }> = []
  if (target.postId) checks.push({ targetType: 'post', targetId: String(target.postId) })
  if (target.circleId) checks.push({ targetType: 'circle', targetId: String(target.circleId) })
  for (const check of checks) {
    const row = await ctx.db.query('notificationMutes')
      .withIndex('by_user_target', (q: any) => q.eq('userId', userId).eq('targetType', check.targetType).eq('targetId', check.targetId))
      .unique()
    if (row) return true
  }
  return false
}

async function requireExistingTarget(
  ctx: { db: any },
  targetType: 'post' | 'circle',
  targetId: string,
) {
  let target: unknown = null
  try {
    target = await ctx.db.get(targetType === 'post' ? 'posts' : 'circles', targetId)
  } catch {
    target = null
  }
  if (!target) throw new ConvexError(targetType === 'post' ? 'Post not found' : 'Circle not found')
}
