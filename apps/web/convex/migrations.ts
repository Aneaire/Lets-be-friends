import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { writeAudit } from './lib'
import { syncHostLocation } from './hostLocations'

export const migrateOwnerRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const owners = await ctx.db.query('users').withIndex('by_role', (q) => q.eq('role', 'owner')).collect()
    const migratedAt = Date.now()

    for (const owner of owners) {
      const after = { ...owner, role: 'admin' as const, updatedAt: migratedAt }
      await ctx.db.patch(owner._id, { role: 'admin', updatedAt: migratedAt })
      await writeAudit(ctx, {
        actorUserId: owner._id,
        action: 'role.owner_migrated_to_admin',
        targetType: 'user',
        targetId: String(owner._id),
        before: owner,
        after,
        note: 'Renamed the legacy owner role to admin.',
      })
    }

    return { migrated: owners.length }
  },
})

export const backfillHostLocationIndex = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 25), 1), 50)
    const page = await ctx.db.query('hostProfiles').paginate({
      cursor: args.cursor ?? null,
      numItems: limit,
    })
    const outcomes = []

    for (const host of page.page) {
      const user = await ctx.db.get(host.userId)
      outcomes.push(await syncHostLocation(ctx, host, user))
    }

    return {
      processed: page.page.length,
      inserted: outcomes.filter((outcome) => outcome === 'inserted').length,
      updated: outcomes.filter((outcome) => outcome === 'updated').length,
      removed: outcomes.filter((outcome) => outcome === 'removed').length,
      unchanged: outcomes.filter((outcome) => outcome === 'unchanged').length,
      isDone: page.isDone,
      nextCursor: page.isDone ? null : page.continueCursor,
    }
  },
})
