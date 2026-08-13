import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
type SeededDiscoveryCompanion = { displayName: string; approximateLatitude?: number }

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

describe('Pampanga development seed', () => {
  it('creates its own approved companions and is idempotent', async () => {
    const t = createTest()

    await expect(t.mutation(internal.seeds.seedPampangaCompanions, {})).resolves.toMatchObject({
      created: 8,
      updated: 0,
      total: 8,
    })
    await expect(t.mutation(internal.seeds.seedPampangaCompanions, {})).resolves.toMatchObject({
      created: 0,
      updated: 8,
      total: 8,
    })

    const counts = await t.run(async (ctx) => ({
      users: (await ctx.db.query('users').collect()).length,
      companions: (await ctx.db.query('companionProfiles').collect()).length,
    }))
    expect(counts).toEqual({ users: 8, companions: 8 })
  })

  it('supports Bacolor radius and always-on nearby discovery', async () => {
    const t = createTest()
    await t.mutation(internal.seeds.seedPampangaCompanions, {})

    const ordinary = await t.query(api.companions.listApproved, {}) as SeededDiscoveryCompanion[]
    expect(ordinary).toHaveLength(8)
    expect(ordinary.map((companion) => companion.displayName)).toContain('Sam')

    const withinFiveKm = await t.query(api.companions.listApproved, {
      latitude: 15.00,
      longitude: 120.65,
      radiusKm: 5,
    }) as SeededDiscoveryCompanion[]
    expect(withinFiveKm.map((companion) => companion.displayName)).toEqual(
      expect.arrayContaining(['Alyssa', 'Nico', 'Mara']),
    )
    expect(withinFiveKm.map((companion) => companion.displayName)).toContain('Sam')
    expect(withinFiveKm.every((companion) => !('approximateLatitude' in companion))).toBe(true)

    const withinTwentyFiveKm = await t.query(api.companions.listApproved, {
      latitude: 15.00,
      longitude: 120.65,
      radiusKm: 25,
    }) as SeededDiscoveryCompanion[]
    expect(withinTwentyFiveKm.map((companion) => companion.displayName)).toEqual(
      expect.arrayContaining(['Alyssa', 'Nico', 'Mara', 'Paolo', 'Bea', 'Luis']),
    )
    expect(withinTwentyFiveKm.map((companion) => companion.displayName)).toContain('Sam')
  })

  it('keeps the spatial index synchronized with suspension and companion resubmission', async () => {
    const t = createTest()
    await t.mutation(internal.seeds.seedPampangaCompanions, {})
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
    expect((await t.query(api.companions.listApproved, nearbyArgs)).map((companion: { displayName: string }) => companion.displayName)).not.toContain('Alyssa')
    expect(await t.mutation(internal.migrations.backfillCompanionLocationIndex, {})).toMatchObject({ removed: 0 })

    await admin.mutation(api.admin.setUserSuspended, { userId: alyssaUserId, suspended: false })
    expect((await t.query(api.companions.listApproved, nearbyArgs)).map((companion: { displayName: string }) => companion.displayName)).toContain('Alyssa')
    expect(await t.mutation(internal.migrations.backfillCompanionLocationIndex, {})).toMatchObject({ updated: 0, inserted: 0 })

    await t.withIdentity({ subject: 'seed:pampanga:alyssa-bacolor' }).mutation(api.companions.submitApplication, {
      intro: 'Coffee companion and local history buddy for relaxed public meetups around Bacolor.',
      city: 'Bacolor, Pampanga',
      strengths: ['Coffee companion', 'Local tour buddy', 'Good listener'],
      categories: ['Coffee or meal companion', 'Local walk or city guide'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: 50_000,
    })
    expect((await t.query(api.companions.listApproved, nearbyArgs)).map((companion: { displayName: string }) => companion.displayName)).not.toContain('Alyssa')
    expect(await t.mutation(internal.migrations.backfillCompanionLocationIndex, {})).toMatchObject({ removed: 0 })
  })
})
