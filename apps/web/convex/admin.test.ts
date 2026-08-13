import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

type TestRole = 'member' | 'companion' | 'reviewer' | 'admin' | 'owner'

async function insertUser(t: ReturnType<typeof convexTest>, clerkUserId: string, role: TestRole) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId,
      displayName: clerkUserId,
      role,
      verificationStatus: 'not_started',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('admin role management', () => {
  it('allows an admin to grant full admin access to several users', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'admin-primary', 'admin')
    const firstUserId = await insertUser(t, 'member-first', 'member')
    const secondUserId = await insertUser(t, 'member-second', 'member')
    const admin = t.withIdentity({ subject: 'admin-primary' })

    await admin.mutation(api.admin.setAdminStatus, { userId: firstUserId, admin: true })
    await admin.mutation(api.admin.setAdminStatus, { userId: secondUserId, admin: true })

    const promoted = await t.run(async (ctx) => Promise.all([
      ctx.db.get(firstUserId),
      ctx.db.get(secondUserId),
    ]))
    expect(promoted.map((user) => user?.role)).toEqual(['admin', 'admin'])

    const logs = await t.run(async (ctx) => ctx.db.query('auditLogs').collect())
    expect(logs.filter((log) => log.action === 'admin.granted')).toHaveLength(2)
  })

  it('does not let reviewers grant admin access or admins demote themselves', async () => {
    const t = convexTest(schema, modules)
    const adminId = await insertUser(t, 'admin-primary', 'admin')
    const memberId = await insertUser(t, 'member-target', 'member')
    await insertUser(t, 'reviewer-user', 'reviewer')

    await expect(t.withIdentity({ subject: 'reviewer-user' }).mutation(api.admin.setAdminStatus, {
      userId: memberId,
      admin: true,
    })).rejects.toThrow('Full admin role required')

    await expect(t.withIdentity({ subject: 'reviewer-user' }).query(api.admin.users, {}))
      .rejects.toThrow('Full admin role required')

    await expect(t.withIdentity({ subject: 'admin-primary' }).mutation(api.admin.setAdminStatus, {
      userId: adminId,
      admin: false,
    })).rejects.toThrow('Admins cannot change their own admin role')
  })

  it('normalizes and migrates legacy owner records to admin', async () => {
    const t = convexTest(schema, modules)
    const legacyOwnerId = await insertUser(t, 'legacy-owner', 'owner')

    const viewer = await t.withIdentity({ subject: 'legacy-owner' }).query(api.users.viewer, {})
    expect(viewer?.role).toBe('admin')

    const visibleAdmins = await t.withIdentity({ subject: 'legacy-owner' }).query(api.admin.users, { role: 'admin' })
    expect(visibleAdmins).toMatchObject([{ _id: legacyOwnerId, role: 'admin' }])

    await expect(t.mutation(internal.migrations.migrateOwnerRoles, {})).resolves.toEqual({ migrated: 1 })
    await expect(t.mutation(internal.migrations.migrateOwnerRoles, {})).resolves.toEqual({ migrated: 0 })
    expect((await t.run(async (ctx) => ctx.db.get(legacyOwnerId)))?.role).toBe('admin')

    const logs = await t.run(async (ctx) => ctx.db.query('auditLogs').collect())
    expect(logs).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'role.owner_migrated_to_admin', targetId: String(legacyOwnerId) }),
    ]))
  })
})
