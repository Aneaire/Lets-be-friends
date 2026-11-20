import geospatialTest from '@convex-dev/geospatial/test'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

function createTest() {
  const t = convexTest(schema, convexModules)
  geospatialTest.register(t)
  return t
}

const now = Date.now()

async function seedUser(t: ReturnType<typeof convexTest>, clerkUserId = 'reviewer-account') {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('users', {
      clerkUserId,
      displayName: 'Play Reviewer',
      role: 'member',
      verificationStatus: 'not_started',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('reviewer account preparation', () => {
  it('refuses to run without the explicit confirmation', async () => {
    const t = createTest()
    const userId = await seedUser(t)
    await expect(t.mutation(internal.reviewerAccess.prepareReviewerAccount, {
      confirm: 'yes',
      clerkUserId: 'reviewer-account',
    })).rejects.toThrow(/confirm: "reviewer"/)

    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      expect(user?.verificationStatus).toBe('not_started')
      expect(await ctx.db.query('walletAccounts').collect()).toHaveLength(0)
    })
  })

  it('requires the account to have signed in at least once', async () => {
    const t = createTest()
    await expect(t.mutation(internal.reviewerAccess.prepareReviewerAccount, {
      confirm: 'reviewer',
      clerkUserId: 'never-signed-in',
    })).rejects.toThrow(/Sign the reviewer account in once/)
  })

  it('approves identity and credits the wallet through the ledger', async () => {
    const t = createTest()
    const userId = await seedUser(t)

    const result = await t.mutation(internal.reviewerAccess.prepareReviewerAccount, {
      confirm: 'reviewer',
      clerkUserId: 'reviewer-account',
      fundCentavos: 50_000,
    })

    expect(result.userId).toBe(userId)
    expect(result.fundApplied).toBe(true)
    expect(result.availableCentavos).toBe(50_000)

    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      expect(user?.verificationStatus).toBe('approved')
      expect(user?.verificationSource).toBe('in_app')
      expect(user?.identityExpiresAt).toBeGreaterThan(Date.now())

      const wallet = await ctx.db.query('walletAccounts').first()
      expect(wallet?.availableCentavos).toBe(50_000)

      const transactions = await ctx.db.query('walletTransactions').collect()
      expect(transactions).toHaveLength(1)
      expect(transactions[0].kind).toBe('test_member_credit')

      const entries = await ctx.db.query('walletEntries').collect()
      expect(entries).toHaveLength(1)
      expect(entries[0].direction).toBe('credit')

      const audit = await ctx.db.query('auditLogs').collect()
      expect(audit.some((entry) => entry.action === 'reviewer.account_prepared')).toBe(true)
    })
  })

  it('is idempotent, so re-running never double funds the account', async () => {
    const t = createTest()
    await seedUser(t)

    const first = await t.mutation(internal.reviewerAccess.prepareReviewerAccount, {
      confirm: 'reviewer',
      clerkUserId: 'reviewer-account',
      fundCentavos: 50_000,
    })
    const second = await t.mutation(internal.reviewerAccess.prepareReviewerAccount, {
      confirm: 'reviewer',
      clerkUserId: 'reviewer-account',
      fundCentavos: 50_000,
    })

    expect(first.fundApplied).toBe(true)
    expect(second.fundApplied).toBe(false)
    expect(second.availableCentavos).toBe(50_000)

    await t.run(async (ctx) => {
      expect(await ctx.db.query('walletTransactions').collect()).toHaveLength(1)
    })
  })
})
