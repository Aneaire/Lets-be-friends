import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { USERNAME_MAX_LENGTH, usernameBaseFromDisplayName } from '@lets-be-friends/shared'
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

export const backfillUsernames = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 50), 1), 100)
    const page = await ctx.db.query('users').paginate({
      cursor: args.cursor ?? null,
      numItems: limit,
    })
    const migratedAt = Date.now()
    let migrated = 0

    for (const user of page.page) {
      if (user.username) continue
      const base = usernameBaseFromDisplayName(user.displayName)
      let username = base
      let suffix = 2

      while (await ctx.db.query('users').withIndex('by_username', (q) => q.eq('username', username)).first()) {
        const suffixText = `_${suffix}`
        username = `${base.slice(0, USERNAME_MAX_LENGTH - suffixText.length).replace(/_+$/g, '')}${suffixText}`
        suffix += 1
      }

      await ctx.db.patch(user._id, { username, updatedAt: migratedAt })
      await writeAudit(ctx, {
        actorUserId: user._id,
        action: 'user.username_backfilled',
        targetType: 'user',
        targetId: String(user._id),
        before: { username: undefined },
        after: { username },
        note: 'Generated a unique username for an existing account.',
      })
      migrated += 1
    }

    return {
      processed: page.page.length,
      migrated,
      isDone: page.isDone,
      nextCursor: page.isDone ? null : page.continueCursor,
    }
  },
})
