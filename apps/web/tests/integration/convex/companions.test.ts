import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules

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

    const directory: any = await t.query(api.companions.listExploreDirectory, {})
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

  it('paginates the Explore directory in bounded pages without private location fields', async () => {
    const t = createTest()
    await t.run(async (ctx) => {
      const now = Date.now()
      for (let index = 0; index < 55; index += 1) {
        await ctx.db.insert('users', {
          clerkUserId: `explore-member-${index}`,
          displayName: `Explore Member ${index}`,
          role: 'member',
          verificationStatus: 'not_started',
          suspended: false,
          createdAt: now + index,
          updatedAt: now + index,
        })
      }
    })

    const first: any = await t.query(api.companions.listExploreDirectoryPage, {
      paginationOpts: { cursor: null, numItems: 50 },
    })
    expect(first.page).toHaveLength(50)
    expect(first.isDone).toBe(false)
    for (const person of first.page) {
      expect(person).not.toHaveProperty('approximateLatitude')
      expect(person).not.toHaveProperty('approximateLongitude')
      expect(person).not.toHaveProperty('approximateArea')
    }
    const second: any = await t.query(api.companions.listExploreDirectoryPage, {
      paginationOpts: { cursor: first.continueCursor, numItems: 50 },
    })
    expect(second.page).toHaveLength(5)
    expect(second.isDone).toBe(true)

    await expect(t.query(api.companions.listExploreDirectoryPage, {
      paginationOpts: { cursor: null, numItems: 51 },
    })).rejects.toThrow('Explore pages can include 1 to 50 people')
  })

  it('keeps accumulated Explore pages in stable global alphabetical order', async () => {
    const t = createTest()
    const names = ['Zed', 'Amy', 'Mara', 'Ben', 'Kai', 'Luz', 'Ivy', 'Noel', 'Omar', 'Pia']
    await t.run(async (ctx) => {
      const now = Date.now()
      for (const [index, displayName] of names.entries()) {
        await ctx.db.insert('users', {
          clerkUserId: `order-member-${index}`,
          displayName,
          role: 'member',
          verificationStatus: 'not_started',
          suspended: false,
          createdAt: now + index,
          updatedAt: now + index,
        })
      }
    })

    const accumulated: string[] = []
    let cursor: string | null = null
    let done = false
    while (!done) {
      const result: any = await t.query(api.companions.listExploreDirectoryPage, {
        paginationOpts: { cursor, numItems: 3 },
      })
      accumulated.push(...result.page.map((person: any) => person.displayName))
      cursor = result.continueCursor
      done = result.isDone
    }
    expect(accumulated).toEqual([...names].sort((left, right) => left.localeCompare(right)))
  })

  it('searches the directory with a bounded server-side query', async () => {
    const t = createTest()
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('users', {
        clerkUserId: 'search-maya',
        username: 'maya_makati',
        displayName: 'Maya Santos',
        role: 'member',
        verificationStatus: 'not_started',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('users', {
        clerkUserId: 'search-unrelated',
        username: 'unrelated_friend',
        displayName: 'Unrelated Friend',
        role: 'member',
        verificationStatus: 'not_started',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
    })

    const matches: any[] = await t.query(api.companions.searchDirectory, { search: '@maya', limit: 6 })
    expect(matches.map((person) => person.displayName)).toEqual(['Maya Santos'])
    expect(matches[0]).not.toHaveProperty('approximateLatitude')
    expect(await t.query(api.companions.searchDirectory, { search: '   ', limit: 6 })).toEqual([])
    expect(await t.query(api.companions.searchDirectory, { search: 'zzz-no-match', limit: 6 })).toEqual([])
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
    const applicantUserId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
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
      await ctx.db.insert('verificationRequests', {
        userId,
        reason: 'member',
        personaStatus: 'not_started',
        personaDecision: 'unknown',
        verificationSource: 'in_app',
        identityStage: 'ready_for_review',
        adminStatus: 'pending',
        isCurrent: true,
        attempt: 1,
        createdAt: now,
        updatedAt: now,
      })
      return userId
    })
    expect(applicantUserId).toBeTruthy()

    await t.withIdentity({ subject: 'applicant' }).mutation(api.companions.submitApplication, {
      intro: 'A safe and friendly companion application with enough detail to review.',
      city: 'Cebu City',
      strengths: ['Good listener'],
      categories: ['  Board   game nights  ', 'Coffee and meals'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: 50_000,
      bio: 'A personal bio about hobbies, family, and work.',
      earningMotivation: 'I want to earn by sharing everyday help with members in my city.',
    })

    const companion = await t.run(async (ctx) => ctx.db.query('companionProfiles').first())
    expect(companion).toMatchObject({
      approximateLatitude: 10.32,
      approximateLongitude: 123.89,
      categories: ['Board game nights', 'Coffee and meals'],
      status: 'pending_review',
    })
    expect(companion?.approximateArea).toBeUndefined()

    await expect(t.withIdentity({ subject: 'applicant' }).mutation(api.companions.submitApplication, {
      intro: 'A safe and friendly companion application with enough detail to review.',
      city: 'Cebu City',
      strengths: ['Good listener'],
      categories: ['Everything'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: 50_000,
      earningMotivation: 'I want to earn by sharing everyday help with members in my city.',
    })).rejects.toThrow('filter and cannot be saved')
    expect((await t.run(async (ctx) => ctx.db.query('companionProfiles').first()))?.categories)
      .toEqual(['Board game nights', 'Coffee and meals'])
  })

  it('rejects a companion application without onboarding coordinates', async () => {
    const t = createTest()
    const now = Date.now()
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        clerkUserId: 'missing-location',
        displayName: 'Missing Location',
        role: 'member',
        verificationStatus: 'approved',
        verificationSource: 'in_app',
        identityVerifiedAt: now,
        identityExpiresAt: now + 86_400_000,
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      expect(userId).toBeTruthy()
    })

    await expect(t.withIdentity({ subject: 'missing-location' }).mutation(api.companions.submitApplication, {
      intro: 'A safe and friendly companion application with enough detail to review.',
      city: 'Cebu City',
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: 50_000,
      earningMotivation: 'I want to earn by sharing everyday help with members in my city.',
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
      earningMotivation: 'I want to earn by sharing everyday help with members in my city.',
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

describe('companion application bio and earning motivation', () => {
  const validApplication = {
    intro: 'A safe and friendly companion application with enough detail to review.',
    city: 'Cebu City',
    strengths: ['Good listener'],
    categories: ['Coffee or meal companion'],
    boundaries: ['Public places only'],
    mode: 'both' as const,
    hourlyRateCentavos: 50_000,
    earningMotivation: 'I want to earn by sharing everyday help with members in my city.',
  }

  async function insertApplicant(t: ReturnType<typeof convexTest>, subject = 'bio-applicant', bio?: string) {
    const now = Date.now()
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        clerkUserId: subject,
        username: subject,
        displayName: 'Bio Applicant',
        bio,
        approximateLatitude: 10.31,
        approximateLongitude: 123.89,
        approximateLocationConsentedAt: now,
        termsAcceptedAt: now,
        termsVersion: '2026-08-13',
        role: 'member',
        verificationStatus: 'approved',
        verificationSource: 'in_app',
        identityVerifiedAt: now,
        identityExpiresAt: now + 86_400_000,
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
    })
  }

  it('saves the bio to the canonical member record and the motivation to the application', async () => {
    const t = createTest()
    await insertApplicant(t, 'bio-applicant', 'Existing member bio.')
    await t.withIdentity({ subject: 'bio-applicant' }).mutation(api.companions.submitApplication, {
      ...validApplication,
      bio: 'Something personal about hobbies, family, and work.',
    })

    const user = await t.run(async (ctx) => ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'bio-applicant')).unique())
    expect(user?.bio).toBe('Something personal about hobbies, family, and work.')
    const companion = await t.run(async (ctx) => ctx.db.query('companionProfiles').first())
    expect(companion).toMatchObject({ earningMotivation: validApplication.earningMotivation })
    expect(companion).not.toHaveProperty('bio')

    const mine: any = await t.withIdentity({ subject: 'bio-applicant' }).query(api.companions.myApplication, {})
    expect(mine).toMatchObject({ bio: 'Something personal about hobbies, family, and work.', earningMotivation: validApplication.earningMotivation })
  })

  it('requires a meaningful earning motivation and limits bio length', async () => {
    const t = createTest()
    await insertApplicant(t, 'motivation-applicant')

    await expect(t.withIdentity({ subject: 'motivation-applicant' }).mutation(api.companions.submitApplication, {
      ...validApplication,
      earningMotivation: undefined,
    })).rejects.toThrow('why you want to earn')

    await expect(t.withIdentity({ subject: 'motivation-applicant' }).mutation(api.companions.submitApplication, {
      ...validApplication,
      earningMotivation: 'Too short',
    })).rejects.toThrow('at least 20 characters')

    await expect(t.withIdentity({ subject: 'motivation-applicant' }).mutation(api.companions.submitApplication, {
      ...validApplication,
      bio: 'x'.repeat(501),
    })).rejects.toThrow('500 characters or fewer')

    await expect(t.withIdentity({ subject: 'motivation-applicant' }).mutation(api.companions.submitApplication, {
      ...validApplication,
      earningMotivation: 'x'.repeat(1001),
    })).rejects.toThrow('1000 characters or fewer')

    expect(await t.run(async (ctx) => ctx.db.query('companionProfiles').collect())).toEqual([])
  })

  it('keeps legacy applications without motivation readable and private from public queries', async () => {
    const t = createTest()
    const { companionProfileId } = await insertApprovedCompanion(t, 'legacy-private', { latitude: 10.31, longitude: 123.89 })
    await t.mutation(internal.migrations.backfillCompanionLocationIndex, {})

    const publicCompanion: any = await t.query(api.companions.getPublic, { companionProfileId })
    expect(publicCompanion).not.toHaveProperty('earningMotivation')
    expect(publicCompanion).not.toHaveProperty('approximateLatitude')

    const [listed]: any[] = await t.query(api.companions.listApproved, { latitude: 10.31, longitude: 123.89, radiusKm: 10 })
    expect(listed).not.toHaveProperty('earningMotivation')

    const stored = await t.run(async (ctx) => ctx.db.get(companionProfileId))
    expect(stored).not.toHaveProperty('earningMotivation')
  })

  it('exposes bio and motivation to admin reviewers', async () => {
    const t = createTest()
    const now = Date.now()
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        clerkUserId: 'review-admin',
        displayName: 'Review Admin',
        role: 'admin',
        verificationStatus: 'not_started',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
    })
    await insertApplicant(t, 'admin-visible-applicant', 'Member bio for admin review.')
    await t.withIdentity({ subject: 'admin-visible-applicant' }).mutation(api.companions.submitApplication, {
      ...validApplication,
      bio: 'Member bio for admin review.',
    })

    const rows: any[] = await t.withIdentity({ subject: 'review-admin' }).query(api.admin.companionApplications, { status: 'pending_review' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      applicantBio: 'Member bio for admin review.',
      earningMotivation: validApplication.earningMotivation,
    })
  })
})

describe('companion application identity gate', () => {
  const gatedApplication = {
    intro: 'A safe and friendly companion application with enough detail to review.',
    city: 'Cebu City',
    strengths: ['Good listener'],
    categories: ['Coffee or meal companion'],
    boundaries: ['Public places only'],
    mode: 'both' as const,
    hourlyRateCentavos: 50_000,
    earningMotivation: 'I want to earn by sharing everyday help with members in my city.',
  }

  async function insertGatedUser(
    t: ReturnType<typeof convexTest>,
    subject: string,
    identity: { status: 'not_started' | 'pending' | 'approved' | 'rejected'; source?: 'in_app' | 'persona'; verified?: boolean },
    request?: { adminStatus: 'not_ready' | 'pending' | 'approved' | 'rejected'; source?: 'in_app' | 'persona' | 'legacy_manual'; stage?: 'draft' | 'confirmation_required' | 'ready_for_review' | 'failed' | 'rejected'; isCurrent?: boolean; reason?: 'member' | 'booking' | 'companion_application' | 'reverification'; decision?: 'unknown' | 'passed' | 'needs_review' | 'declined' },
  ) {
    const now = Date.now()
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('users', {
        clerkUserId: subject,
        username: subject,
        displayName: 'Gated Applicant',
        approximateLatitude: 10.31,
        approximateLongitude: 123.89,
        approximateLocationConsentedAt: now,
        termsAcceptedAt: now,
        termsVersion: '2026-08-13',
        role: 'member',
        verificationStatus: identity.status,
        verificationSource: identity.source,
        identityVerifiedAt: identity.verified ? now : undefined,
        identityExpiresAt: identity.verified ? now + 86_400_000 : undefined,
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      if (request) {
        await ctx.db.insert('verificationRequests', {
          userId: id,
          reason: request.reason ?? 'member',
          personaStatus: 'not_started',
          personaDecision: request.decision ?? 'unknown',
          verificationSource: request.source ?? 'in_app',
          identityStage: request.stage ?? 'ready_for_review',
          adminStatus: request.adminStatus,
          isCurrent: request.isCurrent ?? true,
          attempt: 1,
          createdAt: now,
          updatedAt: now,
        })
      }
      return id
    })
    return userId
  }

  async function expectNoWrites(t: ReturnType<typeof convexTest>) {
    const state = await t.run(async (ctx) => ({
      companions: await ctx.db.query('companionProfiles').collect(),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    expect(state.companions).toEqual([])
    expect(state.audits).toEqual([])
  }

  it('rejects a Companion submission before identity is submitted for review', async () => {
    const t = createTest()
    await insertGatedUser(t, 'gate-not-started', { status: 'not_started' })

    await expect(t.withIdentity({ subject: 'gate-not-started' }).mutation(api.companions.submitApplication, gatedApplication))
      .rejects.toThrow('Submit your identity check for safety review first')
    await expectNoWrites(t)
  })

  it('locks incomplete, processing, expired, and rejected identity attempts', async () => {
    const t = createTest()
    await insertGatedUser(t, 'gate-incomplete', { status: 'pending' }, {
      adminStatus: 'not_ready',
      source: 'in_app',
      stage: 'confirmation_required',
    })
    await insertGatedUser(t, 'gate-processing', { status: 'pending' }, {
      adminStatus: 'not_ready',
      source: 'in_app',
      stage: 'draft',
    })
    await insertGatedUser(t, 'gate-expired', { status: 'pending' }, {
      adminStatus: 'not_ready',
      source: 'in_app',
      stage: 'failed',
    })
    await insertGatedUser(t, 'gate-rejected', { status: 'rejected' }, {
      adminStatus: 'rejected',
      source: 'in_app',
      stage: 'rejected',
    })

    for (const subject of ['gate-incomplete', 'gate-processing', 'gate-expired', 'gate-rejected']) {
      await expect(t.withIdentity({ subject }).mutation(api.companions.submitApplication, gatedApplication))
        .rejects.toThrow('Submit your identity check for safety review first')
    }
    await expectNoWrites(t)
  })

  it('locks dormant provider and booking-linked attempts even when marked pending', async () => {
    const t = createTest()
    await insertGatedUser(t, 'gate-persona', { status: 'pending' }, {
      adminStatus: 'pending',
      source: 'persona',
      stage: 'ready_for_review',
    })
    await insertGatedUser(t, 'gate-booking', { status: 'pending' }, {
      adminStatus: 'pending',
      source: 'in_app',
      stage: 'ready_for_review',
      reason: 'booking',
    })
    await insertGatedUser(t, 'gate-stale', { status: 'pending' }, {
      adminStatus: 'pending',
      source: 'in_app',
      stage: 'ready_for_review',
      isCurrent: false,
    })

    for (const subject of ['gate-persona', 'gate-booking', 'gate-stale']) {
      await expect(t.withIdentity({ subject }).mutation(api.companions.submitApplication, gatedApplication))
        .rejects.toThrow('Submit your identity check for safety review first')
    }
    await expectNoWrites(t)
  })

  it('accepts a current identity submitted for safety review, including a provider-declined attempt', async () => {
    const t = createTest()
    await insertGatedUser(t, 'gate-ready', { status: 'pending' }, {
      adminStatus: 'pending',
      source: 'in_app',
      stage: 'ready_for_review',
      decision: 'unknown',
    })
    await insertGatedUser(t, 'gate-declined-ready', { status: 'pending' }, {
      adminStatus: 'pending',
      source: 'in_app',
      stage: 'ready_for_review',
      decision: 'declined',
    })

    for (const subject of ['gate-ready', 'gate-declined-ready']) {
      await t.withIdentity({ subject }).mutation(api.companions.submitApplication, gatedApplication)
    }

    const companions = await t.run(async (ctx) => ctx.db.query('companionProfiles').collect())
    expect(companions).toHaveLength(2)
    expect(companions.every((companion) => companion.status === 'pending_review')).toBe(true)
  })

  it('accepts a resubmission with a current approved identity', async () => {
    const t = createTest()
    await insertGatedUser(t, 'gate-approved', { status: 'approved', source: 'in_app', verified: true })

    await t.withIdentity({ subject: 'gate-approved' }).mutation(api.companions.submitApplication, gatedApplication)
    await t.withIdentity({ subject: 'gate-approved' }).mutation(api.companions.submitApplication, {
      ...gatedApplication,
      city: 'Mandaue City',
    })

    const companions = await t.run(async (ctx) => ctx.db.query('companionProfiles').collect())
    expect(companions).toHaveLength(1)
    expect(companions[0]).toMatchObject({ city: 'Mandaue City', status: 'pending_review' })
  })
})
