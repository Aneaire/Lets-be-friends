import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

async function insertUser(t: ReturnType<typeof convexTest>, clerkUserId: string, displayName: string, username?: string) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId,
      username,
      displayName,
      role: 'member',
      verificationStatus: 'not_started',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('usernames', () => {
  it('normalizes claims and enforces uniqueness server-side', async () => {
    const t = convexTest(schema, modules)
    const firstUserId = await insertUser(t, 'first-user', 'Maya Santos')
    await insertUser(t, 'second-user', 'Maya Reyes')

    await expect(t.withIdentity({ subject: 'first-user' }).mutation(api.users.claimUsername, {
      username: '@Maya_Friend',
    })).resolves.toBe('maya_friend')

    const firstUser = await t.run(async (ctx) => await ctx.db.get(firstUserId))
    expect(firstUser?.username).toBe('maya_friend')
    await expect(t.withIdentity({ subject: 'second-user' }).query(api.users.usernameAvailability, {
      username: 'MAYA_FRIEND',
    })).resolves.toMatchObject({ username: 'maya_friend', available: false })
    await expect(t.withIdentity({ subject: 'second-user' }).mutation(api.users.claimUsername, {
      username: 'maya_friend',
    })).rejects.toThrow('already taken')
    await expect(t.withIdentity({ subject: 'first-user' }).mutation(api.users.claimUsername, {
      username: 'maya_changed',
    })).rejects.toThrow('permanent and cannot be changed')
  })

  it('requires a username before onboarding can be completed', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'new-user', 'New Friend')

    await expect(t.withIdentity({ subject: 'new-user' }).mutation(api.users.completeOnboarding, {
      goal: 'member',
    })).rejects.toThrow('Choose a username')
  })

  it('backfills deterministic collision-safe usernames and is idempotent', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'existing-user', 'Alex Santos', 'alex_santos')
    await insertUser(t, 'legacy-one', 'Alex Santos')
    await insertUser(t, 'legacy-two', 'Alex Santos')

    await expect(t.mutation(internal.migrations.backfillUsernames, {})).resolves.toMatchObject({
      migrated: 2,
      isDone: true,
    })
    await expect(t.mutation(internal.migrations.backfillUsernames, {})).resolves.toMatchObject({ migrated: 0 })

    const usernames = await t.run(async (ctx) => (await ctx.db.query('users').collect()).map((user) => user.username).sort())
    expect(usernames).toEqual(['alex_santos', 'alex_santos_2', 'alex_santos_3'])
  })
})
