import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'

export const RATE_LIMIT_FAMILIES = {
  create_post: { limit: 10, windowMs: 60 * 60 * 1_000 },
  create_comment: { limit: 30, windowMs: 60 * 1_000 },
  toggle_reaction: { limit: 120, windowMs: 60 * 1_000 },
} as const

export type RateLimitFamily = keyof typeof RATE_LIMIT_FAMILIES

const RATE_LIMIT_MESSAGES: Record<RateLimitFamily, string> = {
  create_post: 'You have reached the hourly limit for creating posts',
  create_comment: 'You are commenting too quickly. Please slow down.',
  toggle_reaction: 'Slow down a little before reacting again.',
}

// Keep roughly two windows so a bucket that stops being used ages out promptly.
const WINDOW_RETENTION = 2

/**
 * Fixed-window rate limit partitioned by member and action family.
 *
 * Exactly one document exists per (member, action family). Its bucketStart is
 * reset in place when the window rolls, so scans stay O(1) per member and never
 * become a hot global document. Callers must run this before any domain write,
 * audit, or notification so a rejected call leaves no side effects.
 */
export async function consumeRateLimit(ctx: any, userId: Id<'users'>, family: RateLimitFamily) {
  const { limit, windowMs } = RATE_LIMIT_FAMILIES[family]
  const now = Date.now()
  const bucketStart = Math.floor(now / windowMs) * windowMs
  const row = await ctx.db.query('rateLimits')
    .withIndex('by_key', (q: any) => q.eq('userId', userId).eq('actionFamily', family))
    .first()
  if (row) {
    if (row.bucketStart !== bucketStart) {
      await ctx.db.patch(row._id, {
        bucketStart,
        count: 1,
        expiresAt: bucketStart + windowMs * WINDOW_RETENTION,
        updatedAt: now,
      })
      return
    }
    if (row.count >= limit) throw new Error(RATE_LIMIT_MESSAGES[family])
    await ctx.db.patch(row._id, { count: row.count + 1, updatedAt: now })
    return
  }
  await ctx.db.insert('rateLimits', {
    userId,
    actionFamily: family,
    bucketStart,
    count: 1,
    expiresAt: bucketStart + windowMs * WINDOW_RETENTION,
    createdAt: now,
    updatedAt: now,
  })
}

export const purgeExpiredRateLimits = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 500), 1), 1_000)
    const rows = await ctx.db.query('rateLimits')
      .withIndex('by_expires_at', (q: any) => q.lt('expiresAt', Date.now()))
      .take(limit)
    for (const row of rows) await ctx.db.delete(row._id)
    const fullBatch = rows.length === limit
    // Reschedule while a full batch was still expired so a large backlog drains
    // in bounded chunks, matching the feed-event purge.
    if (fullBatch) {
      await ctx.scheduler.runAfter(0, internal.rateLimit.purgeExpiredRateLimits, { limit })
    }
    return { deleted: rows.length, fullBatch }
  },
})
