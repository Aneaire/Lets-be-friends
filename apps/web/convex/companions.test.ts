import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

async function insertApprovedCompanion(
  t: ReturnType<typeof convexTest>,
  subject: string,
  location: { latitude: number; longitude: number },
  nearbyDiscoveryEnabled?: boolean,
  mode: 'online' | 'in_person' | 'both' = 'in_person',
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      approximateLatitude: location.latitude,
      approximateLongitude: location.longitude,
      role: 'companion',
      verificationStatus: 'approved',
      verificationSource: 'persona',
      identityVerifiedAt: now,
      identityExpiresAt: now + 86_400_000,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId,
      displayName: subject,
      intro: `${subject} offers a safe and friendly local activity for members.`,
      city: 'Private city label',
      approximateArea: 'Private approximate area',
      approximateLatitude: location.latitude,
      approximateLongitude: location.longitude,
      nearbyDiscoveryEnabled,
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode,
      status: 'approved',
      rating: 4.8,
      reviewCount: 4,
      createdAt: now,
      updatedAt: now,
    })
    return { userId, companionProfileId }
  })
}

describe('nearby companion discovery privacy', () => {
  it('includes unverified members in Explore without exposing them as Companions', async () => {
    const t = createTest()
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('users', {
        clerkUserId: 'unverified-member',
        displayName: 'Unverified Member',
        role: 'member',
        verificationStatus: 'not_started',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('users', {
        clerkUserId: 'suspended-member',
        displayName: 'Suspended Member',
        role: 'member',
        verificationStatus: 'not_started',
        suspended: true,
        createdAt: now,
        updatedAt: now,
      })
    })

    const directory = await t.query(api.companions.listExploreDirectory, {})
    expect(directory).toEqual([
      expect.objectContaining({
        displayName: 'Unverified Member',
        kind: 'member',
        verified: false,
        bookable: false,
      }),
    ])
    expect(directory[0]).not.toHaveProperty('approximateLatitude')
    expect(directory[0]).not.toHaveProperty('approximateLongitude')
  })

  it('ignores legacy visibility flags and indexes every eligible approved companion', async () => {
    const t = createTest()
    await insertApprovedCompanion(t, 'legacy-true', { latitude: 10.31, longitude: 123.89 }, true)
    await insertApprovedCompanion(t, 'legacy-false', { latitude: 10.32, longitude: 123.90 }, false)
    await insertApprovedCompanion(t, 'legacy-missing', { latitude: 10.33, longitude: 123.91 })
    await insertApprovedCompanion(t, 'online-companion', { latitude: 10.34, longitude: 123.92 }, false, 'online')
    await expect(t.mutation(internal.migrations.backfillCompanionLocationIndex, {})).resolves.toMatchObject({ inserted: 4 })

    const nearby = await t.query(api.companions.listApproved, {
      latitude: 10.31,
      longitude: 123.89,
      radiusKm: 25,
    })
    expect(nearby.map((companion: { displayName: string }) => companion.displayName)).toEqual(expect.arrayContaining([
      'legacy-true',
      'legacy-false',
      'legacy-missing',
      'online-companion',
    ]))
  })

  it('never returns private location fields from discovery or public profiles', async () => {
    const t = createTest()
    const { companionProfileId } = await insertApprovedCompanion(t, 'privacy-companion', { latitude: 10.31, longitude: 123.89 }, true)
    await t.mutation(internal.migrations.backfillCompanionLocationIndex, {})

    const [discoveryCompanion] = await t.query(api.companions.listApproved, {
      latitude: 10.31,
      longitude: 123.89,
      radiusKm: 10,
    })
    const publicCompanion = await t.query(api.companions.getPublic, { companionProfileId })

    for (const companion of [discoveryCompanion, publicCompanion]) {
      expect(companion).not.toHaveProperty('approximateArea')
      expect(companion).not.toHaveProperty('approximateLatitude')
      expect(companion).not.toHaveProperty('approximateLongitude')
      expect(companion).not.toHaveProperty('nearbyDiscoveryEnabled')
    }
    expect(discoveryCompanion.distanceKm).toBe(0)
    expect(discoveryCompanion.latitude).toBe(10.31)
    expect(discoveryCompanion.longitude).toBe(123.89)
  })

  it('validates nearby radius and coordinate ranges', async () => {
    const t = createTest()

    await expect(t.query(api.companions.listApproved, { latitude: 91, longitude: 0, radiusKm: 25 }))
      .rejects.toThrow('Latitude must be between -90 and 90')
    await expect(t.query(api.companions.listApproved, { latitude: 0, longitude: 0, radiusKm: 20 }))
      .rejects.toThrow('Radius must be 5, 10, 25, 50, or 100 km')
    await expect(t.query(api.companions.listApproved, { latitude: 0, radiusKm: 25 }))
      .rejects.toThrow('Latitude and longitude must be provided together')
  })

  it('derives rounded application coordinates from the user onboarding record', async () => {
    const t = createTest()
    const now = Date.now()
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        clerkUserId: 'applicant',
        username: 'applicant',
        displayName: 'Applicant',
        approximateLatitude: 10.315699,
        approximateLongitude: 123.885437,
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

    await t.withIdentity({ subject: 'applicant' }).mutation(api.companions.submitApplication, {
      intro: 'A safe and friendly companion application with enough detail to review.',
      city: 'Cebu City',
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: 50_000,
    })

    const companion = await t.run(async (ctx) => ctx.db.query('companionProfiles').first())
    expect(companion).toMatchObject({
      approximateLatitude: 10.32,
      approximateLongitude: 123.89,
      status: 'pending_review',
    })
    expect(companion?.approximateArea).toBeUndefined()
  })

  it('rejects a companion application without onboarding coordinates', async () => {
    const t = createTest()
    const now = Date.now()
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        clerkUserId: 'missing-location',
        displayName: 'Missing Location',
        role: 'member',
        verificationStatus: 'not_started',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
    })

    await expect(t.withIdentity({ subject: 'missing-location' }).mutation(api.companions.submitApplication, {
      intro: 'A safe and friendly companion application with enough detail to review.',
      city: 'Cebu City',
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: 50_000,
    })).rejects.toThrow('Complete onboarding with an approximate location')
  })

  it('requires current location consent before a legacy Companion can resubmit', async () => {
    const t = createTest()
    const { userId } = await insertApprovedCompanion(t, 'legacy-editor', { latitude: 10.31, longitude: 123.89 })
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { approximateLatitude: undefined, approximateLongitude: undefined })
    })

    await expect(t.withIdentity({ subject: 'legacy-editor' }).mutation(api.companions.submitApplication, {
      intro: 'A revised safe and friendly companion application with enough detail to review.',
      city: 'Cebu City',
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: 50_000,
    })).rejects.toThrow('current location consent and Terms and Conditions')
  })

  it('rounds legacy coordinates during indexing before returning map coordinates', async () => {
    const t = createTest()
    await insertApprovedCompanion(t, 'precise-legacy', { latitude: 10.315699, longitude: 123.885437 })
    await t.mutation(internal.migrations.backfillCompanionLocationIndex, {})

    const [companion] = await t.query(api.companions.listApproved, { latitude: 10.32, longitude: 123.89, radiusKm: 5 })
    expect(companion).toMatchObject({ latitude: 10.32, longitude: 123.89 })
    const stored = await t.run(async (ctx) => ctx.db.query('companionProfiles').first())
    expect(stored).toMatchObject({ approximateLatitude: 10.32, approximateLongitude: 123.89 })
  })

  it('moves an existing approved companion when onboarding location is saved again', async () => {
    const t = createTest()
    const { userId } = await insertApprovedCompanion(t, 'moving-companion', { latitude: 10.31, longitude: 123.89 })
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { username: 'moving_companion' })
    })
    await t.mutation(internal.migrations.backfillCompanionLocationIndex, {})

    await t.withIdentity({ subject: 'moving-companion' }).mutation(api.users.saveOnboardingLocationAndConsent, {
      latitude: 11.315699,
      longitude: 124.885437,
      locationConsent: true,
      termsAccepted: true,
      termsVersion: '2026-08-13',
    })

    expect(await t.query(api.companions.listApproved, { latitude: 10.31, longitude: 123.89, radiusKm: 5 })).toEqual([])
    const [moved] = await t.query(api.companions.listApproved, { latitude: 11.32, longitude: 124.89, radiusKm: 5 })
    expect(moved).toMatchObject({ displayName: 'moving-companion', latitude: 11.32, longitude: 124.89 })
  })
})
