import { internalMutation } from './_generated/server'
import { writeAudit } from './lib'

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
