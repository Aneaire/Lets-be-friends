import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

function createTest() {
  return convexTest(schema, convexModules)
}

async function insertUser(t: ReturnType<typeof convexTest>, subject: string) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      role: 'member',
      verificationStatus: 'not_started',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('sensitive-flow rate limits', () => {
  it('rejects the 61st direct message in the window without writing it', async () => {
    const t = createTest()
    await insertUser(t, 'send-limit-a')
    await insertUser(t, 'send-limit-b')
    const a = t.withIdentity({ subject: 'send-limit-a' })
    const b = t.withIdentity({ subject: 'send-limit-b' })
    const bId = await t.run(async (ctx) => {
      const user = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'send-limit-b')).unique()
      return user!._id
    })
    const conversationId = await a.mutation(api.conversations.start, { otherUserId: bId })

    for (let index = 0; index < 60; index += 1) {
      await a.mutation(api.conversations.sendMessage, { conversationId, body: `Message ${index}` })
    }
    const before = await t.run(async (ctx) => ctx.db.query('directMessages').collect())
    expect(before).toHaveLength(60)

    await expect(a.mutation(api.conversations.sendMessage, { conversationId, body: 'Over limit' })).rejects.toThrow('sending messages too quickly')
    const after = await t.run(async (ctx) => ctx.db.query('directMessages').collect())
    expect(after).toHaveLength(60)

    await b.mutation(api.conversations.sendMessage, { conversationId, body: 'Other participant is not limited' })
    expect(await t.run(async (ctx) => ctx.db.query('directMessages').collect())).toHaveLength(61)
  })

  it('rejects the 11th report in the hour without creating a report', async () => {
    const t = createTest()
    const reporterId = await insertUser(t, 'report-limit-reporter')
    await insertUser(t, 'report-limit-target')
    const reporter = t.withIdentity({ subject: 'report-limit-reporter' })
    const targetId = await t.run(async (ctx) => {
      const user = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'report-limit-target')).unique()
      return user!._id
    })

    for (let index = 0; index < 10; index += 1) {
      await reporter.mutation(api.reports.create, { targetType: 'user', targetId: String(targetId), reason: `Report ${index}` })
    }
    const before = await t.run(async (ctx) => ctx.db.query('reports').collect())
    expect(before).toHaveLength(10)

    await expect(reporter.mutation(api.reports.create, { targetType: 'user', targetId: String(targetId), reason: 'Over limit' })).rejects.toThrow('hourly limit for submitting reports')
    expect(await t.run(async (ctx) => ctx.db.query('reports').collect())).toHaveLength(10)

    void reporterId
  })

  it('does not penalize continuing an active identity attempt', async () => {
    const t = createTest()
    await insertUser(t, 'identity-limit')
    const viewer = t.withIdentity({ subject: 'identity-limit' })

    const started = await viewer.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'passport' })
    expect(started.mode).toBe('started')

    const continued = await viewer.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'passport' })
    expect(continued.mode).toBe('continue')
    expect(continued.identityRecordId).toBe(started.identityRecordId)
  })
})
