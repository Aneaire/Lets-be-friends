import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
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
      reviewMembersCreated: 7,
      bookingsCreated: 112,
      reviewsCreated: 112,
      total: 8,
    })
    await expect(t.mutation(internal.seeds.seedPampangaCompanions, {})).resolves.toMatchObject({
      created: 0,
      updated: 8,
      reviewMembersCreated: 0,
      reviewMembersUpdated: 7,
      bookingsCreated: 0,
      reviewsCreated: 0,
      reviewsUpdated: 112,
      total: 8,
    })

    const counts = await t.run(async (ctx) => ({
      users: (await ctx.db.query('users').collect()).length,
      companions: (await ctx.db.query('companionProfiles').collect()).length,
      bookings: (await ctx.db.query('bookings').collect()).length,
      reviews: (await ctx.db.query('reviews').collect()).length,
    }))
    expect(counts).toEqual({ users: 15, companions: 8, bookings: 112, reviews: 112 })
  })

  it('populates a presentation account without replacing its identity', async () => {
    const t = createTest()
    const now = Date.now()
    const clerkUserId = 'user_presentation_niko'
    const accountId = await t.run(async (ctx) => await ctx.db.insert('users', {
      clerkUserId,
      username: 'niko2493',
      displayName: 'Niko Santiago.zoobook',
      bio: 'Niko\'s original profile bio.',
      onboardingCategories: ['Friendly conversation'],
      role: 'member',
      verificationStatus: 'approved',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    }))
    await t.mutation(internal.seeds.seedPampangaCompanions, {})

    await expect(t.mutation(internal.seeds.seedPresentationAccount, { clerkUserId })).resolves.toMatchObject({
      accountId,
      conversationsCreated: 3,
      messagesCreated: 12,
      bookingsCreated: 4,
      notificationsCreated: 6,
    })

    const firstSnapshot = await t.run(async (ctx) => {
      const account = await ctx.db.get(accountId)
      const conversations = (await ctx.db.query('directConversations').collect())
        .filter((conversation) => conversation.participantOneId === accountId || conversation.participantTwoId === accountId)
      const conversationIds = new Set(conversations.map((conversation) => conversation._id))
      const messages = (await ctx.db.query('directMessages').collect())
        .filter((message) => conversationIds.has(message.conversationId))
      const bookings = await ctx.db.query('bookings').withIndex('by_member', (q) => q.eq('memberId', accountId)).collect()
      const notifications = await ctx.db.query('notifications').withIndex('by_recipient_created_at', (q) => q.eq('recipientUserId', accountId)).collect()
      const posts = await ctx.db.query('posts').withIndex('by_author', (q) => q.eq('authorId', accountId)).collect()
      const reviews = (await ctx.db.query('reviews').collect())
        .filter((review) => review.reviewerId === accountId || review.revieweeId === accountId)
      const wallet = await ctx.db.query('walletAccounts').withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', `member:${accountId}:booking`)).unique()
      const topUps = (await ctx.db.query('paymongoTopUps').collect())
        .filter((topUp) => topUp.beneficiaryUserId === accountId)
      return {
        account,
        conversations: conversations.length,
        messages: messages.map((message) => message.body),
        bookingStatuses: bookings.map((booking) => booking.status).sort(),
        notifications: notifications.length,
        posts: posts.length,
        reviews: reviews.length,
        wallet,
        topUps: topUps.length,
      }
    })

    expect(firstSnapshot.account).toMatchObject({
      username: 'niko2493',
      displayName: 'Niko Santiago.zoobook',
      bio: 'Niko\'s original profile bio.',
      onboardingCategories: ['Friendly conversation'],
      role: 'member',
    })
    expect(firstSnapshot.conversations).toBe(3)
    expect(firstSnapshot.messages).toHaveLength(12)
    expect(firstSnapshot.messages).toContain('Hi Niko, I saw that you are interested in coffee and local experiences. I know a calm public café in Bacolor.')
    expect(firstSnapshot.messages).toContain('Niko sent a booking request for a relaxed coffee conversation.')
    expect(firstSnapshot.bookingStatuses).toEqual(['accepted', 'cancelled', 'request_sent', 'review_window'])
    expect(firstSnapshot.notifications).toBe(6)
    expect(firstSnapshot.posts).toBe(2)
    expect(firstSnapshot.reviews).toBe(2)
    expect(firstSnapshot.wallet).toMatchObject({
      accountType: 'member_booking',
      availableCentavos: 2_450_000,
      reservedCentavos: 130_000,
    })
    expect(firstSnapshot.topUps).toBe(2)

    await expect(t.mutation(internal.seeds.seedPresentationAccount, { clerkUserId })).resolves.toMatchObject({
      postsCreated: 0,
      relationshipsCreated: 0,
      conversationsCreated: 0,
      messagesCreated: 0,
      bookingsCreated: 0,
      notificationsCreated: 0,
    })

    const repeatedCounts = await t.run(async (ctx) => {
      const conversations = (await ctx.db.query('directConversations').collect())
        .filter((conversation) => conversation.participantOneId === accountId || conversation.participantTwoId === accountId)
      const conversationIds = new Set(conversations.map((conversation) => conversation._id))
      return {
        conversations: conversations.length,
        messages: (await ctx.db.query('directMessages').collect()).filter((message) => conversationIds.has(message.conversationId)).length,
        bookings: (await ctx.db.query('bookings').withIndex('by_member', (q) => q.eq('memberId', accountId)).collect()).length,
        notifications: (await ctx.db.query('notifications').withIndex('by_recipient_created_at', (q) => q.eq('recipientUserId', accountId)).collect()).length,
      }
    })
    expect(repeatedCounts).toEqual({ conversations: 3, messages: 12, bookings: 4, notifications: 6 })
  })

  it('backs every displayed review total with review records, including all seven for Kai', async () => {
    const t = createTest()
    await t.mutation(internal.seeds.seedPampangaCompanions, {})

    const profiles = await t.run(async (ctx) => await ctx.db.query('companionProfiles').collect())
    for (const profile of profiles) {
      const reviews = await t.run(async (ctx) => await ctx.db.query('reviews')
        .withIndex('by_companion_profile', (q) => q.eq('companionProfileId', profile._id))
        .collect())
      const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      expect(reviews).toHaveLength(profile.reviewCount)
      expect(average.toFixed(1)).toBe(profile.rating.toFixed(1))
    }

    const kai = profiles.find((profile) => profile.displayName === 'Kai')
    if (!kai) throw new Error('Kai seed profile not found')
    const kaiReviews = await t.query(api.reviews.forCompanion, { companionProfileId: kai._id })
    expect(kaiReviews).toHaveLength(7)
    expect(new Set(kaiReviews.map((review) => review.reviewerDisplayName)).size).toBe(7)
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
      earningMotivation: 'I want to earn by sharing everyday help with members in my city.',
    })
    expect((await t.query(api.companions.listApproved, nearbyArgs)).map((companion: { displayName: string }) => companion.displayName)).not.toContain('Alyssa')
    expect(await t.mutation(internal.migrations.backfillCompanionLocationIndex, {})).toMatchObject({ removed: 0 })
  })
})
