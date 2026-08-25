import geospatialTest from '@convex-dev/geospatial/test'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { approvedPhilippinesCompanions } from '../../../convex/seeds/philippinesCatalog'
import { convexModules } from '../../helpers/convex'

function createTest() {
  const t = convexTest(schema, convexModules)
  geospatialTest.register(t)
  return t
}

async function seedCounts(t: ReturnType<typeof createTest>) {
  return await t.run(async (ctx) => ({
    users: (await ctx.db.query('users').collect()).length,
    profiles: (await ctx.db.query('companionProfiles').collect()).length,
    approvedProfiles: (await ctx.db.query('companionProfiles').withIndex('by_status', (q) => q.eq('status', 'approved')).collect()).length,
    pendingProfiles: (await ctx.db.query('companionProfiles').withIndex('by_status', (q) => q.eq('status', 'pending_review')).collect()).length,
    posts: (await ctx.db.query('posts').collect()).length,
    bookings: (await ctx.db.query('bookings').collect()).length,
    reviews: (await ctx.db.query('reviews').collect()).length,
    identityRecords: (await ctx.db.query('identityRecords').collect()).length,
    identityRecordImages: (await ctx.db.query('identityRecordImages').collect()).length,
    verificationRequests: (await ctx.db.query('verificationRequests').collect()).length,
    reports: (await ctx.db.query('reports').collect()).length,
  }))
}

describe('Philippines development seed', () => {
  it('creates the full regional dataset, activity, and admin queues idempotently', async () => {
    const t = createTest()

    await expect(t.action(internal.seeds.seedPhilippinesDevelopment, { confirm: 'development' })).resolves.toMatchObject({
      peopleBatches: 12,
      activityBatches: 11,
    })

    const expectedCounts = {
      users: 128,
      profiles: 96,
      approvedProfiles: 88,
      pendingProfiles: 8,
      posts: 176,
      bookings: 264,
      reviews: 176,
      identityRecords: 8,
      identityRecordImages: 16,
      verificationRequests: 8,
      reports: 8,
    }
    expect(await seedCounts(t)).toEqual(expectedCounts)

    const details = await t.run(async (ctx) => {
      const users = await ctx.db.query('users').collect()
      const islandGroups = { luzon: 0, visayas: 0, mindanao: 0 }
      for (const seed of approvedPhilippinesCompanions) {
        const user = await ctx.db.query('users')
          .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', `seed:philippines:companion:${seed.key}`))
          .unique()
        if (!user) throw new Error('Seeded Companion user is missing')
        const profile = await ctx.db.query('companionProfiles').withIndex('by_user', (q) => q.eq('userId', user._id)).unique()
        if (!profile) throw new Error('Seeded profile is missing')
        expect(profile.approximateLatitude).toBe(Math.round(seed.latitude * 100) / 100)
        expect(profile.approximateLongitude).toBe(Math.round(seed.longitude * 100) / 100)
        islandGroups[seed.islandGroup] += 1
      }
      const bookings = await ctx.db.query('bookings').collect()
      const reports = await ctx.db.query('reports').collect()
      return {
        newCompanionUsers: approvedPhilippinesCompanions.length,
        islandGroups,
        incoming: bookings.filter((booking) => booking.notes?.startsWith('Development seed incoming request')).length,
        completed: bookings.filter((booking) => booking.notes?.startsWith('Development seed completed experience')).length,
        acceptedIncoming: bookings.filter((booking) => booking.notes?.startsWith('Development seed incoming request') && booking.status === 'accepted').length,
        requestedIncoming: bookings.filter((booking) => booking.notes?.startsWith('Development seed incoming request') && booking.status === 'request_sent').length,
        suspended: users.filter((user) => user.suspended).length,
        hiddenPosts: (await ctx.db.query('posts').collect()).filter((post) => post.hidden).length,
        hiddenReviews: (await ctx.db.query('reviews').collect()).filter((review) => review.hidden === true).length,
        reportStatuses: {
          open: reports.filter((report) => report.status === 'open').length,
          reviewing: reports.filter((report) => report.status === 'reviewing').length,
          resolved: reports.filter((report) => report.status === 'resolved').length,
          dismissed: reports.filter((report) => report.status === 'dismissed').length,
        },
      }
    })
    expect(details).toEqual({
      newCompanionUsers: 80,
      islandGroups: { luzon: 56, visayas: 14, mindanao: 10 },
      incoming: 88,
      completed: 176,
      acceptedIncoming: 22,
      requestedIncoming: 66,
      suspended: 4,
      hiddenPosts: 4,
      hiddenReviews: 4,
      reportStatuses: { open: 3, reviewing: 2, resolved: 2, dismissed: 1 },
    })

    await t.action(internal.seeds.seedPhilippinesDevelopment, { confirm: 'development' })
    expect(await seedCounts(t)).toEqual(expectedCounts)

    const now = Date.now()
    await t.run(async (ctx) => {
      await ctx.db.insert('users', {
        clerkUserId: 'seed:philippines:test-admin',
        displayName: 'Seed test admin',
        role: 'admin',
        verificationStatus: 'approved',
        verificationSource: 'persona',
        identityVerifiedAt: now,
        identityExpiresAt: now + 365 * 24 * 60 * 60 * 1_000,
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
    })
    const admin = t.withIdentity({ subject: 'seed:philippines:test-admin' })
    const overview = await admin.query(api.admin.overview, {})
    expect(overview.counts).toMatchObject({
      companionApplicationsPending: 8,
      memberVerificationsPending: 8,
      reportsOpen: 3,
      usersSuspended: 4,
      postsHidden: 4,
      reviewsHidden: 4,
    })
    const queues = await admin.query(api.admin.queues, {})
    expect(queues.companionApplications).toHaveLength(8)
    expect(queues.memberVerifications).toHaveLength(8)
    expect(queues.memberVerifications.every((request) => request.identityStage === 'ready_for_review')).toBe(true)
    expect(queues.reports).toHaveLength(3)
    const memberVerifications = await admin.query(api.admin.memberVerifications, { status: 'pending' })
    expect(memberVerifications).toHaveLength(8)
    expect(memberVerifications.every((request) => request.reviewAllowed && request.approvalAllowed)).toBe(true)

    await expect(admin.mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: memberVerifications[0]._id,
      decision: 'approved',
      note: 'Development seed approval check.',
    })).resolves.toBeNull()
    const approvedVerification = await admin.query(api.admin.memberVerifications, { status: 'approved' })
    expect(approvedVerification).toHaveLength(1)
    expect(approvedVerification[0].memberVerificationStatus).toBe('approved')
  }, 30_000)
})
