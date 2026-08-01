import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
type SeededDiscoveryHost = { displayName: string; approximateLatitude?: number }

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

describe('Pampanga development seed', () => {
  it('creates its own approved hosts and is idempotent', async () => {
    const t = createTest()

    await expect(t.mutation(internal.seeds.seedPampangaHosts, {})).resolves.toMatchObject({
      created: 8,
      updated: 0,
      total: 8,
    })
    await expect(t.mutation(internal.seeds.seedPampangaHosts, {})).resolves.toMatchObject({
      created: 0,
      updated: 8,
      total: 8,
    })

    const counts = await t.run(async (ctx) => ({
      users: (await ctx.db.query('users').collect()).length,
      hosts: (await ctx.db.query('hostProfiles').collect()).length,
    }))
    expect(counts).toEqual({ users: 8, hosts: 8 })
  })

  it('supports Bacolor radius and nearby-privacy testing', async () => {
    const t = createTest()
    await t.mutation(internal.seeds.seedPampangaHosts, {})

    const ordinary = await t.query(api.hosts.listApproved, {}) as SeededDiscoveryHost[]
    expect(ordinary).toHaveLength(8)
    expect(ordinary.map((host) => host.displayName)).toContain('Sam')

    const withinFiveKm = await t.query(api.hosts.listApproved, {
      latitude: 15.00,
      longitude: 120.65,
      radiusKm: 5,
    }) as SeededDiscoveryHost[]
    expect(withinFiveKm.map((host) => host.displayName)).toEqual(
      expect.arrayContaining(['Alyssa', 'Nico', 'Mara']),
    )
    expect(withinFiveKm.map((host) => host.displayName)).not.toContain('Sam')
    expect(withinFiveKm.every((host) => !('approximateLatitude' in host))).toBe(true)

    const withinTwentyFiveKm = await t.query(api.hosts.listApproved, {
      latitude: 15.00,
      longitude: 120.65,
      radiusKm: 25,
    }) as SeededDiscoveryHost[]
    expect(withinTwentyFiveKm.map((host) => host.displayName)).toEqual(
      expect.arrayContaining(['Alyssa', 'Nico', 'Mara', 'Paolo', 'Bea', 'Luis']),
    )
    expect(withinTwentyFiveKm.map((host) => host.displayName)).not.toContain('Sam')
  })

  it('keeps the spatial index synchronized with suspension and location privacy changes', async () => {
    const t = createTest()
    await t.mutation(internal.seeds.seedPampangaHosts, {})
    const { alyssaUserId } = await t.run(async (ctx) => {
      const alyssa = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'seed:pampanga:alyssa-bacolor')).unique()
      if (!alyssa) throw new Error('Alyssa seed user not found')
      const now = Date.now()
      await ctx.db.insert('users', {
        clerkUserId: 'seed:index-admin',
        displayName: 'Index admin',
        role: 'admin',
        verificationStatus: 'approved',
        verificationSource: 'persona',
        identityVerifiedAt: now,
        identityExpiresAt: now + 86_400_000,
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      return { alyssaUserId: alyssa._id }
    })
    const nearbyArgs = { latitude: 15.00, longitude: 120.65, radiusKm: 5 }

    const admin = t.withIdentity({ subject: 'seed:index-admin' })
    await admin.mutation(api.admin.setUserSuspended, {
      userId: alyssaUserId,
      suspended: true,
      note: 'Testing nearby index removal.',
    })
    expect((await t.query(api.hosts.listApproved, nearbyArgs)).map((host: { displayName: string }) => host.displayName)).not.toContain('Alyssa')
    expect(await t.mutation(internal.migrations.backfillHostLocationIndex, {})).toMatchObject({ removed: 0 })

    await admin.mutation(api.admin.setUserSuspended, { userId: alyssaUserId, suspended: false })
    expect((await t.query(api.hosts.listApproved, nearbyArgs)).map((host: { displayName: string }) => host.displayName)).toContain('Alyssa')
    expect(await t.mutation(internal.migrations.backfillHostLocationIndex, {})).toMatchObject({ updated: 0, inserted: 0 })

    await t.withIdentity({ subject: 'seed:pampanga:alyssa-bacolor' }).mutation(api.hosts.submitApplication, {
      intro: 'Coffee companion and local history buddy for relaxed public meetups around Bacolor.',
      city: 'Bacolor, Pampanga',
      approximateArea: 'Bacolor town area',
      approximateLatitude: 15.00,
      approximateLongitude: 120.65,
      nearbyDiscoveryEnabled: false,
      strengths: ['Coffee companion', 'Local tour buddy', 'Good listener'],
      categories: ['Coffee or meal companion', 'Local walk or city guide'],
      boundaries: ['Public places only'],
      mode: 'both',
    })
    expect((await t.query(api.hosts.listApproved, nearbyArgs)).map((host: { displayName: string }) => host.displayName)).not.toContain('Alyssa')
    expect(await t.mutation(internal.migrations.backfillHostLocationIndex, {})).toMatchObject({ removed: 0 })
  })
})
