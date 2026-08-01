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

async function insertApprovedHost(
  t: ReturnType<typeof convexTest>,
  subject: string,
  location: { latitude: number; longitude: number },
  nearbyDiscoveryEnabled?: boolean,
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      role: 'friend_host',
      verificationStatus: 'approved',
      verificationSource: 'persona',
      identityVerifiedAt: now,
      identityExpiresAt: now + 86_400_000,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
    const hostProfileId = await ctx.db.insert('hostProfiles', {
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
      mode: 'in_person',
      status: 'approved',
      rating: 4.8,
      reviewCount: 4,
      createdAt: now,
      updatedAt: now,
    })
    return { userId, hostProfileId }
  })
}

describe('nearby host discovery privacy', () => {
  it('keeps opted-out and legacy hosts in ordinary discovery but excludes them from nearby', async () => {
    const t = createTest()
    await insertApprovedHost(t, 'nearby-opted-in', { latitude: 10.31, longitude: 123.89 }, true)
    await insertApprovedHost(t, 'nearby-opted-out', { latitude: 10.32, longitude: 123.90 }, false)
    await insertApprovedHost(t, 'nearby-legacy-default', { latitude: 10.33, longitude: 123.91 })
    await t.mutation(internal.migrations.backfillHostLocationIndex, {})

    const ordinary = await t.query(api.hosts.listApproved, {})
    expect(ordinary.map((host: { displayName: string }) => host.displayName)).toEqual(expect.arrayContaining([
      'nearby-opted-in',
      'nearby-opted-out',
      'nearby-legacy-default',
    ]))

    const nearby = await t.query(api.hosts.listApproved, {
      latitude: 10.31,
      longitude: 123.89,
      radiusKm: 25,
    })
    expect(nearby.map((host: { displayName: string }) => host.displayName)).toEqual(['nearby-opted-in'])
  })

  it('never returns private location fields from discovery or public profiles', async () => {
    const t = createTest()
    const { hostProfileId } = await insertApprovedHost(
      t,
      'privacy-host',
      { latitude: 10.31, longitude: 123.89 },
      true,
    )
    await t.mutation(internal.migrations.backfillHostLocationIndex, {})

    const [discoveryHost] = await t.query(api.hosts.listApproved, {
      latitude: 10.31,
      longitude: 123.89,
      radiusKm: 10,
    })
    const publicHost = await t.query(api.hosts.getPublic, { hostProfileId })

    for (const host of [discoveryHost, publicHost]) {
      expect(host).not.toHaveProperty('approximateArea')
      expect(host).not.toHaveProperty('approximateLatitude')
      expect(host).not.toHaveProperty('approximateLongitude')
      expect(host).not.toHaveProperty('nearbyDiscoveryEnabled')
    }
    expect(discoveryHost.distanceKm).toBe(0)
  })

  it('validates nearby radius and coordinate ranges', async () => {
    const t = createTest()

    await expect(t.query(api.hosts.listApproved, { latitude: 91, longitude: 0, radiusKm: 25 }))
      .rejects.toThrow('Latitude must be between -90 and 90')
    await expect(t.query(api.hosts.listApproved, { latitude: 0, longitude: 0, radiusKm: 20 }))
      .rejects.toThrow('Radius must be 5, 10, 25, 50, or 100 km')
    await expect(t.query(api.hosts.listApproved, { latitude: 0, radiusKm: 25 }))
      .rejects.toThrow('Latitude and longitude must be provided together')
  })

  it('rounds application coordinates and defaults nearby visibility to off', async () => {
    const t = createTest()
    const now = Date.now()
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        clerkUserId: 'applicant',
        displayName: 'Applicant',
        role: 'member',
        verificationStatus: 'not_started',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
    })

    await t.withIdentity({ subject: 'applicant' }).mutation(api.hosts.submitApplication, {
      intro: 'A safe and friendly host application with enough detail to review.',
      city: 'Cebu City',
      approximateLatitude: 10.315699,
      approximateLongitude: 123.885437,
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode: 'both',
    })

    const host = await t.run(async (ctx) => ctx.db.query('hostProfiles').first())
    expect(host).toMatchObject({
      approximateLatitude: 10.32,
      approximateLongitude: 123.89,
      nearbyDiscoveryEnabled: false,
    })
  })
})
