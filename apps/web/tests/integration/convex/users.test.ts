import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
const termsVersion = '2026-08-13'

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

describe('usernames and onboarding', () => {
  it('returns a privacy-limited public profile without requiring identity verification', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'public-member', 'Public Member', 'public_member')
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, {
        bio: 'Coffee, walks, and thoughtful conversations.',
        onboardingCategories: ['Good company'],
        approximateLatitude: 10.31,
        approximateLongitude: 123.89,
      })
    })

    const profile = await t.query(api.users.publicProfile, { userId })
    expect(profile).toMatchObject({
      displayName: 'Public Member',
      username: 'public_member',
      bio: 'Coffee, walks, and thoughtful conversations.',
      onboardingCategories: ['Good company'],
      identityVerified: false,
    })
    expect(profile).not.toHaveProperty('clerkUserId')
    expect(profile).not.toHaveProperty('approximateLatitude')
    expect(profile).not.toHaveProperty('approximateLongitude')
    expect(profile).not.toHaveProperty('verificationStatus')
  })

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

  it('rejects onboarding completion without username, location, or consent metadata', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'new-user', 'New Friend')
    const authenticated = t.withIdentity({ subject: 'new-user' })

    await expect(authenticated.mutation(api.users.completeOnboarding, { goal: 'member' }))
      .rejects.toThrow('Choose a username')
    await authenticated.mutation(api.users.claimUsername, { username: 'new_friend' })
    await expect(authenticated.mutation(api.users.completeOnboarding, { goal: 'member' }))
      .rejects.toThrow('Save an approximate location')
    await expect(authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.31,
      longitude: 123.89,
      locationConsent: false,
      termsAccepted: true,
      termsVersion,
    })).rejects.toThrow('Consent')
    await expect(authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.31,
      longitude: 123.89,
      locationConsent: true,
      termsAccepted: false,
      termsVersion,
    })).rejects.toThrow('Terms and Conditions')
    await expect(authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.31,
      longitude: 123.89,
      locationConsent: true,
      termsAccepted: true,
      termsVersion: 'outdated',
    })).rejects.toThrow('current Terms and Conditions')
  })

  it('rounds onboarding coordinates and records consent, terms, and completion', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'complete-user', 'Complete User', 'complete_user')
    const authenticated = t.withIdentity({ subject: 'complete-user' })

    await authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.315699,
      longitude: 123.885437,
      locationConsent: true,
      termsAccepted: true,
      termsVersion,
    })
    await authenticated.mutation(api.users.completeOnboarding, { goal: 'companion' })

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    expect(user).toMatchObject({
      approximateLatitude: 10.32,
      approximateLongitude: 123.89,
      onboardingGoal: 'companion',
      termsVersion,
    })
    expect(user?.approximateLocationConsentedAt).toEqual(expect.any(Number))
    expect(user?.termsAcceptedAt).toEqual(expect.any(Number))
    expect(user?.onboardingCompletedAt).toEqual(expect.any(Number))
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
