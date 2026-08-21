import { convexTest } from 'convex-test'
import { afterEach, describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
const previousAllowlist = process.env.IDENTITY_TEST_BYPASS_USER_IDS

afterEach(() => {
  if (previousAllowlist === undefined) delete process.env.IDENTITY_TEST_BYPASS_USER_IDS
  else process.env.IDENTITY_TEST_BYPASS_USER_IDS = previousAllowlist
})

async function insertUser(t: ReturnType<typeof convexTest>, clerkUserId: string) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId,
      displayName: 'Test member',
      role: 'member',
      verificationStatus: 'not_started',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('identity test bypass', () => {
  it('is unavailable unless the account is explicitly allowlisted', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'not-allowlisted')

    await expect(t.withIdentity({ subject: 'not-allowlisted' }).mutation(api.users.setIdentityTestBypass, { enabled: true }))
      .rejects.toThrow('Identity test bypass is not available for this account')
  })

  it('toggles test access for one allowlisted account without creating a provider approval', async () => {
    process.env.IDENTITY_TEST_BYPASS_USER_IDS = 'allowlisted-user'
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'allowlisted-user')

    await t.withIdentity({ subject: 'allowlisted-user' }).mutation(api.users.setIdentityTestBypass, { enabled: true })
    const enabledViewer = await t.withIdentity({ subject: 'allowlisted-user' }).query(api.users.viewer, {})
    expect(enabledViewer).toMatchObject({
      identityEligible: true,
      identityTestBypassAvailable: true,
      identityTestBypassActive: true,
      verificationStatus: 'not_started',
    })
    expect(enabledViewer).not.toHaveProperty('verificationSource')

    const audit = await t.run(async (ctx) => ctx.db.query('auditLogs').first())
    expect(audit).toMatchObject({
      actorUserId: userId,
      action: 'identity.test_bypass_enabled',
      targetType: 'user',
    })

    await t.withIdentity({ subject: 'allowlisted-user' }).mutation(api.users.setIdentityTestBypass, { enabled: false })
    const disabledViewer = await t.withIdentity({ subject: 'allowlisted-user' }).query(api.users.viewer, {})
    expect(disabledViewer).toMatchObject({ identityEligible: false, identityTestBypassActive: false })
  })
})
