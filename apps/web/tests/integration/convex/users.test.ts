import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'
import { currentPolicyVersion as termsVersion } from '@lets-be-friends/shared'
import { distanceKm } from '../../../src/lib/geo'

const modules = convexModules

// Saved locations are jittered up to 1 km and rounded to two decimals, so a
// stored point can sit a little under 2 km from the true device fix.
function expectStoredLocationNear(
  actual: { approximateLatitude?: number; approximateLongitude?: number } | null,
  expected: { latitude: number; longitude: number },
) {
  expect(actual?.approximateLatitude).toEqual(expect.any(Number))
  expect(actual?.approximateLongitude).toEqual(expect.any(Number))
  expect(Math.round(actual!.approximateLatitude! * 100) / 100).toBe(actual!.approximateLatitude)
  expect(Math.round(actual!.approximateLongitude! * 100) / 100).toBe(actual!.approximateLongitude)
  expect(distanceKm(
    { latitude: actual!.approximateLatitude!, longitude: actual!.approximateLongitude! },
    expected,
  )).toBeLessThanOrEqual(2)
}

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

async function insertAcceptedUser(t: ReturnType<typeof convexTest>, clerkUserId: string, displayName: string, username?: string) {
  const now = Date.now()
  return await t.run(async (ctx) => {
    return await ctx.db.insert('users', {
      clerkUserId,
      username,
      displayName,
      approximateLatitude: 10.31,
      approximateLongitude: 123.89,
      approximateLocationConsentedAt: now,
      termsAcceptedAt: now,
      termsVersion,
      privacyPolicyAcceptedAt: now,
      privacyPolicyVersion: termsVersion,
      identityConsentAcceptedAt: now,
      identityConsentVersion: termsVersion,
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

    // The message must ride on ConvexError data: Convex redacts a plain Error's
    // text in production, so a plain Error would reach the member as an envelope.
    const failure = await t.withIdentity({ subject: 'second-user' })
      .mutation(api.users.claimUsername, { username: 'maya_friend' })
      .then(() => null, (error: unknown) => error)
    expect((failure as { data?: unknown } | null)?.data).toBe('That username is already taken.')
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
      privacyAccepted: true,
      privacyVersion: 'outdated',
      identityAccepted: true,
      identityVersion: 'outdated',
    })).rejects.toThrow('current Terms')
    await expect(authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.31,
      longitude: 123.89,
      locationConsent: true,
      termsAccepted: true,
      termsVersion,
      privacyAccepted: false,
    })).rejects.toThrow('Privacy Policy')
    await expect(authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.31,
      longitude: 123.89,
      locationConsent: true,
      termsAccepted: true,
      termsVersion,
      privacyAccepted: true,
      privacyVersion: termsVersion,
      identityAccepted: false,
    })).rejects.toThrow('identity')
  })

  it('rejects a Terms-only request that omits the new privacy and identity scope without writing anything', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'terms-only-user', 'Terms Only', 'terms_only')
    const authenticated = t.withIdentity({ subject: 'terms-only-user' })

    await expect(authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.31,
      longitude: 123.89,
      locationConsent: true,
      termsAccepted: true,
      termsVersion,
    } as never)).rejects.toThrow('Privacy Policy')
    await expect(authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.31,
      longitude: 123.89,
      locationConsent: true,
      termsAccepted: true,
      termsVersion,
      privacyAccepted: true,
      privacyVersion: termsVersion,
    } as never)).rejects.toThrow('identity')

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    expect(user?.approximateLatitude).toBeUndefined()
    expect(user?.approximateLocationConsentedAt).toBeUndefined()
    expect(user?.termsAcceptedAt).toBeUndefined()
    expect(user?.privacyPolicyAcceptedAt).toBeUndefined()
    expect(user?.identityConsentAcceptedAt).toBeUndefined()
  })

  it('rejects explicitly refused scope without manufacturing acceptance or partial writes', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'refused-scope-user', 'Refused Scope', 'refused_scope')
    const authenticated = t.withIdentity({ subject: 'refused-scope-user' })

    await expect(authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.31,
      longitude: 123.89,
      locationConsent: true,
      termsAccepted: true,
      termsVersion,
      privacyAccepted: false,
      privacyVersion: termsVersion,
      identityAccepted: false,
      identityVersion: termsVersion,
    })).rejects.toThrow('Privacy Policy')

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    expect(user?.approximateLatitude).toBeUndefined()
    expect(user?.termsAcceptedAt).toBeUndefined()
    expect(user?.privacyPolicyAcceptedAt).toBeUndefined()
    expect(user?.identityConsentAcceptedAt).toBeUndefined()
  })

  it('jitters and rounds onboarding coordinates and records unified consent, terms, privacy, identity, and completion', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'complete-user', 'Complete User', 'complete_user')
    const authenticated = t.withIdentity({ subject: 'complete-user' })

    await authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.315699,
      longitude: 123.885437,
      locationConsent: true,
      termsAccepted: true,
      termsVersion,
      privacyAccepted: true,
      privacyVersion: termsVersion,
      identityAccepted: true,
      identityVersion: termsVersion,
    })
    await authenticated.mutation(api.users.completeOnboarding, { goal: 'companion' })

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    expectStoredLocationNear(user, { latitude: 10.315699, longitude: 123.885437 })
    expect(user).toMatchObject({
      onboardingGoal: 'companion',
      termsVersion,
      privacyPolicyVersion: termsVersion,
      identityConsentVersion: termsVersion,
    })
    expect(user?.approximateLocationConsentedAt).toEqual(expect.any(Number))
    expect(user?.termsAcceptedAt).toEqual(expect.any(Number))
    expect(user?.privacyPolicyAcceptedAt).toEqual(expect.any(Number))
    expect(user?.identityConsentAcceptedAt).toEqual(expect.any(Number))
    expect(user?.onboardingCompletedAt).toEqual(expect.any(Number))
  })

  it('preserves the original acceptance timestamp on repeated saves of the same version', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'repeat-user', 'Repeat User', 'repeat_user')
    const authenticated = t.withIdentity({ subject: 'repeat-user' })
    await authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.31,
      longitude: 123.89,
      locationConsent: true,
      termsAccepted: true,
      termsVersion,
      privacyAccepted: true,
      privacyVersion: termsVersion,
      identityAccepted: true,
      identityVersion: termsVersion,
    })
    const first = await t.run(async (ctx) => await ctx.db.get(userId))
    await authenticated.mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 10.32,
      longitude: 123.89,
      locationConsent: true,
      termsAccepted: true,
      termsVersion,
      privacyAccepted: true,
      privacyVersion: termsVersion,
      identityAccepted: true,
      identityVersion: termsVersion,
    })
    const second = await t.run(async (ctx) => await ctx.db.get(userId))
    expect(second?.termsAcceptedAt).toBe(first?.termsAcceptedAt)
    expect(second?.privacyPolicyAcceptedAt).toBe(first?.privacyPolicyAcceptedAt)
    expect(second?.identityConsentAcceptedAt).toBe(first?.identityConsentAcceptedAt)
    expectStoredLocationNear(second, { latitude: 10.32, longitude: 123.89 })
  })

  it('routes legacy general Terms acceptance back to onboarding instead of grandfathering new identity scope', async () => {
    const t = convexTest(schema, modules)
    const now = Date.now()
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        clerkUserId: 'legacy-user',
        username: 'legacy_user',
        displayName: 'Legacy User',
        approximateLatitude: 10.31,
        approximateLongitude: 123.89,
        approximateLocationConsentedAt: now,
        termsAcceptedAt: now,
        termsVersion: '2026-08-13',
        role: 'member',
        verificationStatus: 'not_started',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
    })
    await expect(t.withIdentity({ subject: 'legacy-user' }).mutation(api.users.completeOnboarding, { goal: 'member' }))
      .rejects.toThrow('acceptance is required')
  })

  it('normalizes custom onboarding categories and rejects filter labels and duplicates', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'category-user', 'Category User')
    const authenticated = t.withIdentity({ subject: 'category-user' })

    await authenticated.mutation(api.users.updateProfile, {
      displayName: 'Category User',
      onboardingCategories: ['  Board   game nights  ', 'Coffee and meals'],
    })
    expect(await t.run(async (ctx) => (await ctx.db.get(userId))?.onboardingCategories))
      .toEqual(['Board game nights', 'Coffee and meals'])

    await expect(authenticated.mutation(api.users.updateProfile, {
      displayName: 'Category User',
      onboardingCategories: ['Everything'],
    })).rejects.toThrow('filter and cannot be saved')
    await expect(authenticated.mutation(api.users.updateProfile, {
      displayName: 'Category User',
      onboardingCategories: ['Board games', ' board games '],
    })).rejects.toThrow('only once')
    expect(await t.run(async (ctx) => (await ctx.db.get(userId))?.onboardingCategories))
      .toEqual(['Board game nights', 'Coffee and meals'])
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

describe('approximate location updates', () => {
  it('saves a jittered, rounded location for a consented member and returns it', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertAcceptedUser(t, 'mover', 'Mover', 'mover')

    const saved = await t.withIdentity({ subject: 'mover' }).mutation(api.users.updateApproximateLocation, {
      latitude: 14.599512,
      longitude: 120.984222,
    })

    expect(saved.latitude).toEqual(expect.any(Number))
    expect(Math.round(saved.latitude * 100) / 100).toBe(saved.latitude)
    expect(Math.round(saved.longitude * 100) / 100).toBe(saved.longitude)
    expect(distanceKm(saved, { latitude: 14.599512, longitude: 120.984222 })).toBeLessThanOrEqual(2)

    expectStoredLocationNear(await t.run(async (ctx) => await ctx.db.get(userId)), {
      latitude: 14.599512,
      longitude: 120.984222,
    })
  })

  it('refuses to move the saved location without approximate-location consent', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'unconsented', 'Unconsented')
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { approximateLatitude: 10.31, approximateLongitude: 123.89 })
    })

    await expect(t.withIdentity({ subject: 'unconsented' }).mutation(api.users.updateApproximateLocation, {
      latitude: 14.599512,
      longitude: 120.984222,
    })).rejects.toThrow('Agree to store and use your approximate location')

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    expect(user?.approximateLatitude).toBe(10.31)
  })

  it('rejects out-of-range coordinates before writing', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertAcceptedUser(t, 'bad-coords', 'Bad Coords')

    await expect(t.withIdentity({ subject: 'bad-coords' }).mutation(api.users.updateApproximateLocation, {
      latitude: 120,
      longitude: 120.984222,
    })).rejects.toThrow('Latitude must be between -90 and 90')

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    expect(user?.approximateLatitude).toBe(10.31)
  })
})

describe('profile field updates', () => {
  it('keeps the current profile picture when name and bio are saved', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, 'name-bio-user', 'Old Name', 'name_bio_user')
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(['photo'], { type: 'image/webp' })))
    await t.run(async (ctx) => ctx.db.patch(userId, { profileImageStorageId: storageId }))

    await t.withIdentity({ subject: 'name-bio-user' }).mutation(api.users.updateProfile, {
      displayName: 'New Name',
      bio: 'A new introduction.',
    })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.displayName).toBe('New Name')
    expect(user?.bio).toBe('A new introduction.')
    expect(user?.profileImageStorageId).toBe(storageId)
  })
})
