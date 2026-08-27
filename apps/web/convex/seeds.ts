import { calculateMemberWalletBookingPrice } from '@lets-be-friends/shared'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { internalAction, internalMutation } from './_generated/server'
import { syncCompanionLocation } from './companionLocations'
import {
  approvedPhilippinesCompanions,
  pendingCompanionApplicants,
  philippinesMembers,
} from './seeds/philippinesCatalog'

const dayMs = 24 * 60 * 60 * 1_000

const pampangaReviewMembers = [
  { key: 'jules', displayName: 'Jules' },
  { key: 'pat', displayName: 'Pat' },
  { key: 'robin', displayName: 'Robin' },
  { key: 'casey', displayName: 'Casey' },
  { key: 'drew', displayName: 'Drew' },
  { key: 'alex', displayName: 'Alex' },
  { key: 'taylor', displayName: 'Taylor' },
] as const

const pampangaReviewBodies = [
  'Communication was clear from the start, and the whole experience felt comfortable.',
  'The plan was thoughtful, easy to follow, and paced well for me.',
  'I appreciated the friendly conversation and the clear expectations throughout.',
  'Everything felt organized and relaxed. I would gladly make another plan together.',
  'A kind and dependable Companion who made the session easy to enjoy.',
  'The experience matched the profile and stayed comfortable from beginning to end.',
  'Warm, respectful, and attentive to the pace we agreed on.',
] as const

function seededRatings(rating: number, reviewCount: number) {
  const targetTotal = Math.round(rating * reviewCount * 2) / 2
  let remainingAboveFour = targetTotal - reviewCount * 4
  return Array.from({ length: reviewCount }, () => {
    const increase = Math.min(1, Math.max(0, remainingAboveFour))
    remainingAboveFour -= increase
    return 4 + increase
  })
}

const pampangaCompanions = [
  {
    key: 'alyssa-bacolor',
    displayName: 'Alyssa',
    bio: 'Bacolor local who enjoys relaxed conversations, heritage stops, and coffee in public places.',
    city: 'Bacolor, Pampanga',
    approximateArea: 'Bacolor town area',
    latitude: 15.00,
    longitude: 120.65,
    intro: 'Coffee companion and local history buddy for relaxed public meetups around Bacolor.',
    strengths: ['Coffee companion', 'Local tour buddy', 'Good listener'],
    categories: ['Coffee or meal companion', 'Local walk or city guide'],
    mode: 'both' as const,
    rating: 4.9,
    reviewCount: 18,
    nearbyDiscoveryEnabled: true,
  },
  {
    key: 'nico-guagua',
    displayName: 'Nico',
    bio: 'Easygoing food-trip companion based around Guagua.',
    city: 'Guagua, Pampanga',
    approximateArea: 'Guagua town area',
    latitude: 14.97,
    longitude: 120.63,
    intro: 'Food-trip companion for daytime meals, market visits, and casual conversation around Guagua.',
    strengths: ['Food trip companion', 'Good listener'],
    categories: ['Coffee or meal companion', 'Travel or neighborhood guide'],
    mode: 'in_person' as const,
    rating: 4.7,
    reviewCount: 11,
    nearbyDiscoveryEnabled: true,
  },
  {
    key: 'mara-minalin',
    displayName: 'Mara',
    bio: 'Creative hobby partner available around Minalin and online.',
    city: 'Minalin, Pampanga',
    approximateArea: 'Minalin town area',
    latitude: 14.97,
    longitude: 120.68,
    intro: 'A patient creative companion for sketching, photography practice, and quiet café sessions.',
    strengths: ['Photography walk partner', 'Hobby partner', 'Good listener'],
    categories: ['Photography or creative walk', 'Hobby session'],
    mode: 'both' as const,
    rating: 4.8,
    reviewCount: 9,
    nearbyDiscoveryEnabled: true,
  },
  {
    key: 'paolo-san-fernando',
    displayName: 'Paolo',
    bio: 'Productivity and study companion near the City of San Fernando.',
    city: 'City of San Fernando, Pampanga',
    approximateArea: 'San Fernando city area',
    latitude: 15.03,
    longitude: 120.69,
    intro: 'Study and coworking companion for focused sessions in calm public spaces.',
    strengths: ['Study partner', 'Good listener'],
    categories: ['Study or productivity buddy', 'Online coworking'],
    mode: 'both' as const,
    rating: 4.6,
    reviewCount: 14,
    nearbyDiscoveryEnabled: true,
  },
  {
    key: 'bea-porac',
    displayName: 'Bea',
    bio: 'Outdoor and conversation companion based around Porac.',
    city: 'Porac, Pampanga',
    approximateArea: 'Porac town area',
    latitude: 15.07,
    longitude: 120.54,
    intro: 'Outdoor buddy for beginner-friendly public routes, light walks, and conversation breaks.',
    strengths: ['Outdoor activity buddy', 'Good listener'],
    categories: ['Fitness or outdoor buddy', 'Local walk or city guide'],
    mode: 'in_person' as const,
    rating: 4.9,
    reviewCount: 21,
    nearbyDiscoveryEnabled: true,
  },
  {
    key: 'luis-angeles',
    displayName: 'Luis',
    bio: 'Language-practice and city companion around Angeles.',
    city: 'Angeles, Pampanga',
    approximateArea: 'Angeles city area',
    latitude: 15.15,
    longitude: 120.59,
    intro: 'Friendly language-practice partner for public café sessions and relaxed city walks.',
    strengths: ['Language practice', 'Local tour buddy'],
    categories: ['Language practice', 'Local walk or city guide'],
    mode: 'both' as const,
    rating: 4.8,
    reviewCount: 27,
    nearbyDiscoveryEnabled: true,
  },
  {
    key: 'kai-mabalacat',
    displayName: 'Kai',
    bio: 'Gaming and events companion in the Mabalacat area.',
    city: 'Mabalacat, Pampanga',
    approximateArea: 'Mabalacat city area',
    latitude: 15.22,
    longitude: 120.57,
    intro: 'Gaming and event companion for members who prefer a friendly, low-pressure social plan.',
    strengths: ['Gaming buddy', 'Event companion'],
    categories: ['Gaming session', 'Event companion'],
    mode: 'both' as const,
    rating: 4.5,
    reviewCount: 7,
    nearbyDiscoveryEnabled: true,
  },
  {
    key: 'sam-hidden-bacolor',
    displayName: 'Sam',
    bio: 'An online conversation profile used to test always-on nearby discovery.',
    city: 'Bacolor, Pampanga',
    approximateArea: 'Private Bacolor test area',
    latitude: 15.00,
    longitude: 120.66,
    intro: 'This Companion offers relaxed online conversations and friendly check-ins.',
    strengths: ['Online chat friend', 'Good listener'],
    categories: ['Online conversation'],
    mode: 'both' as const,
    rating: 4.4,
    reviewCount: 5,
    nearbyDiscoveryEnabled: false,
  },
] as const

export const seedPampangaCompanions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    let created = 0
    let updated = 0
    let reviewMembersCreated = 0
    let reviewMembersUpdated = 0
    let bookingsCreated = 0
    let reviewsCreated = 0
    let reviewsUpdated = 0

    const reviewMembers: Array<Doc<'users'>> = []
    for (const memberSeed of pampangaReviewMembers) {
      const clerkUserId = `seed:pampanga:review-member:${memberSeed.key}`
      const existingMember = await ctx.db
        .query('users')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
        .unique()
      const memberFields = {
        username: `pampanga_review_${memberSeed.key}`,
        displayName: memberSeed.displayName,
        onboardingGoal: 'member' as const,
        onboardingCompletedAt: now,
        termsAcceptedAt: now,
        termsVersion: '2026-08-13',
        role: 'member' as const,
        verificationStatus: 'approved' as const,
        verificationSource: 'persona' as const,
        identityVerifiedAt: now,
        identityExpiresAt: now + 3_650 * dayMs,
        suspended: false,
        updatedAt: now,
      }
      const memberId = existingMember
        ? (await ctx.db.patch(existingMember._id, memberFields), existingMember._id)
        : await ctx.db.insert('users', { clerkUserId, ...memberFields, createdAt: now })
      if (existingMember) reviewMembersUpdated += 1
      else reviewMembersCreated += 1
      const member = await ctx.db.get(memberId)
      if (!member) throw new Error(`Seeded review member was not saved: ${memberSeed.key}`)
      reviewMembers.push(member)
    }

    for (const seed of pampangaCompanions) {
      const ratings = seededRatings(seed.rating, seed.reviewCount)
      const aggregateRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      const clerkUserId = `seed:pampanga:${seed.key}`
      const existingUser = await ctx.db
        .query('users')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
        .unique()

      const userFields = {
        username: seed.key.replaceAll('-', '_'),
        displayName: seed.displayName,
        bio: seed.bio,
        approximateLatitude: seed.latitude,
        approximateLongitude: seed.longitude,
        approximateLocationConsentedAt: now,
        termsAcceptedAt: now,
        termsVersion: '2026-08-13',
        role: 'companion' as const,
        verificationStatus: 'approved' as const,
        verificationSource: 'persona' as const,
        identityVerifiedAt: now,
        identityExpiresAt: now + 3_650 * dayMs,
        suspended: false,
        updatedAt: now,
      }

      const userId = existingUser
        ? (await ctx.db.patch(existingUser._id, userFields), existingUser._id)
        : await ctx.db.insert('users', {
            clerkUserId,
            ...userFields,
            createdAt: now,
          })

      const existingCompanion = await ctx.db
        .query('companionProfiles')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique()

      const companionFields = {
        displayName: seed.displayName,
        intro: seed.intro,
        city: seed.city,
        approximateArea: seed.approximateArea,
        approximateLatitude: seed.latitude,
        approximateLongitude: seed.longitude,
        nearbyDiscoveryEnabled: seed.nearbyDiscoveryEnabled,
        strengths: [...seed.strengths],
        categories: [...seed.categories],
        boundaries: ['Public places only', 'No dating or romantic expectations'],
        mode: seed.mode,
        hourlyRateCentavos: 50_000,
        status: 'approved' as const,
        applicationNote: 'Development seed for Pampanga nearby-search testing.',
        rating: aggregateRating,
        reviewCount: seed.reviewCount,
        updatedAt: now,
      }

      const companionProfileId = existingCompanion?._id ?? await ctx.db.insert('companionProfiles', {
        userId,
        ...companionFields,
        createdAt: now,
      })

      if (existingCompanion) {
        await ctx.db.patch(existingCompanion._id, companionFields)
        updated += 1
      } else {
        created += 1
      }

      const [user, companion] = await Promise.all([ctx.db.get(userId), ctx.db.get(companionProfileId)])
      if (!companion) throw new Error(`Seeded Companion profile was not saved: ${seed.key}`)
      await syncCompanionLocation(ctx, companion, user)

      const historicalBookings = await ctx.db
        .query('bookings')
        .withIndex('by_companion', (q) => q.eq('companionProfileId', companionProfileId))
        .collect()
      for (let reviewIndex = 0; reviewIndex < seed.reviewCount; reviewIndex += 1) {
        const notes = `Development seed completed experience ${reviewIndex + 1} with ${seed.displayName}.`
        let booking = historicalBookings.find((row) => row.notes === notes)
        if (!booking) {
          const member = reviewMembers[reviewIndex % reviewMembers.length]
          const requestedAt = now - (reviewIndex + 7) * dayMs
          const completedAt = requestedAt + 60 * 60 * 1_000
          const price = calculateMemberWalletBookingPrice(50_000, 60)
          const bookingId = await ctx.db.insert('bookings', {
            memberId: member._id,
            companionProfileId,
            category: seed.categories[reviewIndex % seed.categories.length],
            mode: 'in_person',
            requestedAt,
            durationMinutes: 60,
            notes,
            status: 'closed',
            ...price,
            settlementState: 'settled',
            memberCompletedAt: completedAt,
            companionCompletedAt: completedAt,
            jointlyCompletedAt: completedAt,
            settlementEligibleAt: completedAt,
            settlementResolvedAt: completedAt + dayMs,
            settlementResolution: 'released',
            createdAt: requestedAt - dayMs,
            updatedAt: completedAt + dayMs,
          })
          booking = await ctx.db.get(bookingId) ?? undefined
          if (!booking) throw new Error(`Seeded review booking was not saved: ${seed.key}`)
          historicalBookings.push(booking)
          bookingsCreated += 1
        }

        const reviewFields = {
          revieweeId: userId,
          companionProfileId,
          rating: ratings[reviewIndex],
          body: pampangaReviewBodies[reviewIndex % pampangaReviewBodies.length],
          hidden: false,
          createdAt: (booking.jointlyCompletedAt ?? booking.updatedAt) + 30 * 60 * 1_000,
          updatedAt: now,
        }
        const existingReview = await ctx.db
          .query('reviews')
          .withIndex('by_booking_reviewer', (q) => q.eq('bookingId', booking!._id).eq('reviewerId', booking!.memberId))
          .first()
        if (existingReview) {
          await ctx.db.patch(existingReview._id, reviewFields)
          reviewsUpdated += 1
        } else {
          await ctx.db.insert('reviews', {
            bookingId: booking._id,
            reviewerId: booking.memberId,
            ...reviewFields,
          })
          reviewsCreated += 1
        }
      }

      const reviews = await ctx.db.query('reviews')
        .withIndex('by_companion_profile', (q) => q.eq('companionProfileId', companionProfileId))
        .collect()
      await ctx.db.patch(companionProfileId, {
        rating: reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length,
        reviewCount: reviews.length,
        updatedAt: now,
      })
    }

    return {
      created,
      updated,
      reviewMembersCreated,
      reviewMembersUpdated,
      bookingsCreated,
      reviewsCreated,
      reviewsUpdated,
      total: pampangaCompanions.length,
      note: 'All eligible approved Companions are indexed using approximate coordinates.',
    }
  },
})

const presentationPostBodies = [
  'Coffee and a calm conversation can turn an ordinary afternoon into a good memory. I have a few public café spots around Bacolor to recommend.',
  'Planning a relaxed food trip this weekend. Good conversation, local favorites, and no rushed itinerary.',
  'A quiet creative session can be social too. Bring a sketchbook or camera and we can make something together.',
  'Small study goals are easier with company. I am opening a focused online coworking hour this week.',
  'Beginner-friendly outdoor plans are welcome. Comfortable pace, public routes, and plenty of conversation breaks.',
  'Language practice works best when it feels like a real conversation, not a classroom exercise.',
  'Games are more fun when everyone feels included. Casual sessions and first-time players are always welcome.',
  'Online conversation sessions are available for anyone who wants a friendly check-in from home.',
] as const

export const seedPresentationAccount = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now()
    const target = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', args.clerkUserId))
      .unique()
    if (!target) throw new Error('The requested account does not exist in Convex')
    const account = target

    await ctx.db.patch(account._id, {
      displayName: 'Angelo Santiago',
      firstName: 'Angelo',
      lastName: 'Santiago',
      bio: 'Product builder, coffee enthusiast, and curious local explorer. I enjoy thoughtful conversations, creative walks, and meeting people through safe shared experiences.',
      onboardingCategories: ['Coffee and meals', 'Explore the city', 'Study and coworking', 'Photo walks', 'Tech help'],
      updatedAt: now,
    })

    const seededUsers: Array<Doc<'users'>> = []
    const seededProfiles: Array<Doc<'companionProfiles'>> = []
    for (const seed of pampangaCompanions) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', `seed:pampanga:${seed.key}`))
        .unique()
      if (!user) throw new Error(`Run seedPampangaCompanions first: ${seed.key}`)
      const profile = await ctx.db
        .query('companionProfiles')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .unique()
      if (!profile) throw new Error(`Companion profile is missing: ${seed.key}`)
      seededUsers.push(user)
      seededProfiles.push(profile)
    }

    let postsCreated = 0
    let relationshipsCreated = 0
    let conversationsCreated = 0
    let messagesCreated = 0
    let bookingsCreated = 0
    let notificationsCreated = 0

    const postsByUser = new Map<string, Array<any>>()
    async function ensurePost(authorId: any, body: string, createdAt: number) {
      let authorPosts = postsByUser.get(String(authorId))
      if (!authorPosts) {
        authorPosts = await ctx.db.query('posts').withIndex('by_author', (q) => q.eq('authorId', authorId)).collect()
        postsByUser.set(String(authorId), authorPosts)
      }
      const existing = authorPosts.find((post) => post.body === body && !post.deletedAt)
      if (existing) return existing._id
      const postId = await ctx.db.insert('posts', {
        authorId,
        body,
        media: [],
        reportable: true,
        hidden: false,
        createdAt,
        updatedAt: createdAt,
      })
      authorPosts.push({ _id: postId, authorId, body, createdAt, updatedAt: createdAt, hidden: false, reportable: true })
      postsCreated += 1
      return postId
    }

    const companionPostIds = []
    for (let index = 0; index < seededUsers.length; index += 1) {
      companionPostIds.push(await ensurePost(
        seededUsers[index]._id,
        presentationPostBodies[index],
        now - (index + 1) * 2 * 60 * 60 * 1_000,
      ))
    }

    const targetPostIds = [
      await ensurePost(
        account._id,
        'Taking a closer look at how small, thoughtful social experiences can help people feel more connected. Coffee and a creative walk are at the top of my list this week.',
        now - 45 * 60 * 1_000,
      ),
      await ensurePost(
        account._id,
        'A good shared experience does not need a complicated plan. Clear expectations, a comfortable public place, and kind conversation go a long way.',
        now - 26 * 60 * 60 * 1_000,
      ),
    ]

    async function ensureFollow(followerId: any, followingId: any, createdAt: number) {
      const existing = await ctx.db.query('follows').withIndex('by_pair', (q) => q.eq('followerId', followerId).eq('followingId', followingId)).unique()
      if (existing) return existing._id
      relationshipsCreated += 1
      return await ctx.db.insert('follows', { followerId, followingId, createdAt })
    }

    for (const user of seededUsers.slice(0, 5)) await ensureFollow(account._id, user._id, now - 3 * dayMs)
    for (const user of seededUsers.slice(0, 3)) await ensureFollow(user._id, account._id, now - 2 * dayMs)

    async function ensureSavedProfile(companionProfileId: any) {
      const existing = await ctx.db.query('savedProfiles').withIndex('by_pair', (q) => q.eq('userId', account._id).eq('companionProfileId', companionProfileId)).unique()
      if (existing) return
      await ctx.db.insert('savedProfiles', { userId: account._id, companionProfileId, createdAt: now - dayMs })
      relationshipsCreated += 1
    }
    for (const profile of seededProfiles.slice(0, 4)) await ensureSavedProfile(profile._id)

    async function ensureReaction(userId: any, postId: any, createdAt: number) {
      const existing = await ctx.db.query('postReactions').withIndex('by_pair', (q) => q.eq('userId', userId).eq('postId', postId)).unique()
      if (existing) return
      await ctx.db.insert('postReactions', { userId, postId, reaction: 'like', createdAt })
      relationshipsCreated += 1
    }
    for (const postId of companionPostIds.slice(0, 6)) await ensureReaction(account._id, postId, now - 30 * 60 * 1_000)
    for (const user of seededUsers.slice(0, 4)) await ensureReaction(user._id, targetPostIds[0], now - 20 * 60 * 1_000)
    for (const user of seededUsers.slice(2, 6)) await ensureReaction(user._id, targetPostIds[1], now - 18 * 60 * 60 * 1_000)

    for (const postId of companionPostIds.slice(1, 4)) {
      const existing = await ctx.db.query('savedPosts').withIndex('by_pair', (q) => q.eq('userId', account._id).eq('postId', postId)).unique()
      if (!existing) {
        await ctx.db.insert('savedPosts', { userId: account._id, postId, createdAt: now - 10 * 60 * 1_000 })
        relationshipsCreated += 1
      }
    }

    const comments = [
      { author: seededUsers[0], body: 'This sounds like a thoughtful way to spend an afternoon. A quiet café would be a great starting point.' },
      { author: seededUsers[2], body: 'Creative walks are one of my favorite low-pressure ways to connect too.' },
      { author: seededUsers[3], body: 'Clear expectations make every shared session more comfortable. Well said.' },
    ]
    for (let index = 0; index < comments.length; index += 1) {
      const item = comments[index]
      const postId = index < 2 ? targetPostIds[0] : targetPostIds[1]
      const existing = (await ctx.db.query('postComments').withIndex('by_post', (q) => q.eq('postId', postId)).collect())
        .find((comment) => comment.authorId === item.author._id && comment.body === item.body)
      if (!existing) {
        await ctx.db.insert('postComments', {
          postId,
          authorId: item.author._id,
          body: item.body,
          reportable: true,
          hidden: false,
          createdAt: now - (15 - index * 2) * 60 * 1_000,
          updatedAt: now - (15 - index * 2) * 60 * 1_000,
        })
      }
    }

    function pairKey(first: any, second: any) {
      return [String(first), String(second)].sort().join(':')
    }

    async function ensureConversation(otherUser: any, messages: Array<{ senderId: any; body: string; ageMinutes: number; bookingId?: any }>) {
      const key = pairKey(account._id, otherUser._id)
      let conversation = await ctx.db.query('directConversations').withIndex('by_pair', (q) => q.eq('pairKey', key)).unique()
      const ordered = String(account._id) < String(otherUser._id)
        ? [account._id, otherUser._id]
        : [otherUser._id, account._id]
      if (!conversation) {
        const conversationId = await ctx.db.insert('directConversations', {
          participantOneId: ordered[0],
          participantTwoId: ordered[1],
          pairKey: key,
          createdAt: now - 2 * dayMs,
          updatedAt: now - 2 * dayMs,
        })
        conversation = await ctx.db.get(conversationId)
        conversationsCreated += 1
      }
      if (!conversation) throw new Error('Conversation could not be created')
      const existingMessages = await ctx.db.query('directMessages').withIndex('by_conversation_created_at', (q) => q.eq('conversationId', conversation!._id)).collect()
      let lastMessageAt = conversation.lastMessageAt ?? conversation.createdAt
      for (const message of messages) {
        const createdAt = now - message.ageMinutes * 60 * 1_000
        const existing = existingMessages.find((row) => row.senderId === message.senderId && row.body === message.body)
        if (!existing) {
          await ctx.db.insert('directMessages', {
            conversationId: conversation._id,
            senderId: message.senderId,
            body: message.body,
            reportable: true,
            ...(message.bookingId ? { bookingId: message.bookingId } : {}),
            createdAt,
          })
          messagesCreated += 1
        }
        lastMessageAt = Math.max(lastMessageAt, createdAt)
      }
      await ctx.db.patch(conversation._id, {
        lastMessageAt,
        participantOneLastReadAt: ordered[0] === account._id ? lastMessageAt : conversation.participantOneLastReadAt,
        participantTwoLastReadAt: ordered[1] === account._id ? lastMessageAt : conversation.participantTwoLastReadAt,
        updatedAt: lastMessageAt,
      })
      return conversation._id
    }

    const conversationIds = []
    conversationIds.push(await ensureConversation(seededUsers[0], [
      { senderId: seededUsers[0]._id, body: 'Hi Angelo, I saw that you are interested in coffee and local experiences. I know a calm public café in Bacolor.', ageMinutes: 190 },
      { senderId: account._id, body: 'That sounds perfect. I prefer somewhere quiet enough for conversation.', ageMinutes: 176 },
      { senderId: seededUsers[0]._id, body: 'Absolutely. I can share the location details once the booking is confirmed.', ageMinutes: 165 },
    ]))
    conversationIds.push(await ensureConversation(seededUsers[2], [
      { senderId: account._id, body: 'Would a beginner-friendly photo walk work this weekend?', ageMinutes: 92 },
      { senderId: seededUsers[2]._id, body: 'Yes. We can keep the route short and focus on simple composition exercises.', ageMinutes: 78 },
      { senderId: account._id, body: 'Great, that is exactly the pace I had in mind.', ageMinutes: 64 },
    ]))
    conversationIds.push(await ensureConversation(seededUsers[3], [
      { senderId: seededUsers[3]._id, body: 'I have an online coworking opening on Thursday afternoon if you still want a focused session.', ageMinutes: 38 },
      { senderId: account._id, body: 'Thursday works. A structured hour would help me finish my presentation.', ageMinutes: 24 },
      { senderId: seededUsers[3]._id, body: 'Perfect. I will prepare a simple focus plan and check in at the halfway point.', ageMinutes: 8 },
    ]))

    const bookingSpecs = [
      {
        companionProfile: seededProfiles[0],
        companionUser: seededUsers[0],
        category: seededProfiles[0].categories[0],
        mode: 'in_person' as const,
        requestedAt: now + 2 * dayMs,
        durationMinutes: 60,
        notes: 'A relaxed coffee conversation in a quiet public café.',
        status: 'request_sent' as const,
        settlementState: 'reserved' as const,
      },
      {
        companionProfile: seededProfiles[3],
        companionUser: seededUsers[3],
        category: seededProfiles[3].categories[0],
        mode: 'online' as const,
        requestedAt: now + 4 * dayMs,
        durationMinutes: 90,
        notes: 'A focused online coworking session for presentation preparation.',
        status: 'accepted' as const,
        settlementState: 'reserved' as const,
      },
      {
        companionProfile: seededProfiles[2],
        companionUser: seededUsers[2],
        category: seededProfiles[2].categories[0],
        mode: 'in_person' as const,
        requestedAt: now - 5 * dayMs,
        durationMinutes: 60,
        notes: 'A beginner-friendly photo walk with simple composition practice.',
        status: 'review_window' as const,
        settlementState: 'settled' as const,
      },
      {
        companionProfile: seededProfiles[5],
        companionUser: seededUsers[5],
        category: seededProfiles[5].categories[0],
        mode: 'online' as const,
        requestedAt: now - 12 * dayMs,
        durationMinutes: 60,
        notes: 'A casual language-practice conversation.',
        status: 'cancelled' as const,
        settlementState: 'refunded' as const,
      },
    ]

    const bookingIds = []
    for (const spec of bookingSpecs) {
      const existing = (await ctx.db.query('bookings').withIndex('by_member', (q) => q.eq('memberId', account._id)).collect())
        .find((booking) => booking.companionProfileId === spec.companionProfile._id && booking.notes === spec.notes)
      if (existing) {
        bookingIds.push(existing._id)
        continue
      }
      const price = calculateMemberWalletBookingPrice(spec.companionProfile.hourlyRateCentavos ?? 50_000, spec.durationMinutes)
      const createdAt = spec.requestedAt > now ? now - dayMs : spec.requestedAt - dayMs
      const bookingId = await ctx.db.insert('bookings', {
        memberId: account._id,
        companionProfileId: spec.companionProfile._id,
        category: spec.category,
        mode: spec.mode,
        requestedAt: spec.requestedAt,
        durationMinutes: spec.durationMinutes,
        notes: spec.notes,
        status: spec.status,
        pricingModel: price.pricingModel,
        serviceSubtotalCentavos: price.serviceSubtotalCentavos,
        memberBookingFeeBps: price.memberBookingFeeBps,
        memberBookingFeeCentavos: price.memberBookingFeeCentavos,
        memberTotalCentavos: price.memberTotalCentavos,
        companionEarningsCentavos: price.companionEarningsCentavos,
        currency: price.currency,
        settlementState: spec.settlementState,
        ...(spec.status === 'review_window' ? {
          memberCompletedAt: spec.requestedAt + spec.durationMinutes * 60 * 1_000,
          companionCompletedAt: spec.requestedAt + spec.durationMinutes * 60 * 1_000,
          jointlyCompletedAt: spec.requestedAt + spec.durationMinutes * 60 * 1_000,
          settlementEligibleAt: spec.requestedAt + spec.durationMinutes * 60 * 1_000,
          settlementResolvedAt: spec.requestedAt + spec.durationMinutes * 60 * 1_000 + dayMs,
          settlementResolution: 'released' as const,
        } : {}),
        ...(spec.status === 'cancelled' ? {
          cancelledByUserId: account._id,
          cancelledAt: spec.requestedAt - dayMs,
          cancellationReason: 'Schedule changed before the session.',
          settlementResolvedAt: spec.requestedAt - dayMs,
          settlementResolution: 'returned_to_member' as const,
        } : {}),
        createdAt,
        updatedAt: createdAt,
      })
      bookingIds.push(bookingId)
      bookingsCreated += 1
    }

    await ensureConversation(seededUsers[0], [{
      senderId: account._id,
      body: 'Angelo sent a booking request for a relaxed coffee conversation.',
      ageMinutes: 140,
      bookingId: bookingIds[0],
    }])
    await ensureConversation(seededUsers[3], [{
      senderId: seededUsers[3]._id,
      body: 'Paolo accepted the online coworking booking request.',
      ageMinutes: 12,
      bookingId: bookingIds[1],
    }])
    await ensureConversation(seededUsers[2], [{
      senderId: seededUsers[2]._id,
      body: 'The photo walk is complete. Reviews are now available.',
      ageMinutes: 4 * 24 * 60,
      bookingId: bookingIds[2],
    }])

    const completedBookingId = bookingIds[2]
    const existingReviews = await ctx.db.query('reviews').withIndex('by_booking', (q) => q.eq('bookingId', completedBookingId)).collect()
    let targetReview = existingReviews.find((review) => review.reviewerId === account._id)
    if (!targetReview) {
      const reviewId = await ctx.db.insert('reviews', {
        bookingId: completedBookingId,
        reviewerId: account._id,
        revieweeId: seededUsers[2]._id,
        companionProfileId: seededProfiles[2]._id,
        rating: 5,
        body: 'Mara made the photo walk comfortable and easy to follow. The pace was thoughtful and beginner-friendly.',
        hidden: false,
        createdAt: now - 4 * dayMs,
        updatedAt: now - 4 * dayMs,
      })
      const createdReview = await ctx.db.get(reviewId)
      if (!createdReview) throw new Error('Presentation review could not be created')
      targetReview = createdReview
    }
    if (!existingReviews.some((review) => review.reviewerId === seededUsers[2]._id)) {
      await ctx.db.insert('reviews', {
        bookingId: completedBookingId,
        reviewerId: seededUsers[2]._id,
        revieweeId: account._id,
        rating: 5,
        body: 'Angelo communicated clearly, arrived prepared, and made the creative session enjoyable.',
        hidden: false,
        createdAt: now - 4 * dayMs + 10 * 60 * 1_000,
        updatedAt: now - 4 * dayMs + 10 * 60 * 1_000,
      })
    }

    const notificationSpecs = [
      { kind: 'new_follower' as const, actorUserId: seededUsers[0]._id, dedupeKey: 'presentation:new-follower:alyssa', createdAt: now - 2 * 60 * 1_000 },
      { kind: 'post_commented' as const, actorUserId: seededUsers[2]._id, postId: targetPostIds[0], dedupeKey: 'presentation:comment:mara', createdAt: now - 11 * 60 * 1_000 },
      { kind: 'direct_message' as const, actorUserId: seededUsers[3]._id, conversationId: conversationIds[2], dedupeKey: 'presentation:message:paolo', createdAt: now - 8 * 60 * 1_000 },
      { kind: 'booking_accepted' as const, actorUserId: seededUsers[3]._id, bookingId: bookingIds[1], conversationId: conversationIds[2], dedupeKey: 'presentation:booking:accepted', createdAt: now - 3 * 60 * 60 * 1_000 },
      { kind: 'booking_review_window_opened' as const, actorUserId: seededUsers[2]._id, bookingId: bookingIds[2], dedupeKey: 'presentation:booking:review-window', createdAt: now - 4 * dayMs },
      { kind: 'review_received' as const, actorUserId: seededUsers[2]._id, bookingId: bookingIds[2], reviewId: targetReview?._id, dedupeKey: 'presentation:review:received', createdAt: now - 4 * dayMs + 10 * 60 * 1_000 },
    ]
    for (let index = 0; index < notificationSpecs.length; index += 1) {
      const spec = notificationSpecs[index]
      const existing = await ctx.db.query('notifications').withIndex('by_recipient_dedupe', (q) => q.eq('recipientUserId', account._id).eq('dedupeKey', spec.dedupeKey)).unique()
      if (!existing) {
        await ctx.db.insert('notifications', {
          recipientUserId: account._id,
          actorUserId: spec.actorUserId,
          kind: spec.kind,
          priority: index === 3 ? 'attention' : 'standard',
          ...(spec.postId ? { postId: spec.postId } : {}),
          ...(spec.conversationId ? { conversationId: spec.conversationId } : {}),
          ...(spec.bookingId ? { bookingId: spec.bookingId } : {}),
          ...(spec.reviewId ? { reviewId: spec.reviewId } : {}),
          dedupeKey: spec.dedupeKey,
          ...(index >= 4 ? { readAt: spec.createdAt + 5 * 60 * 1_000 } : {}),
          createdAt: spec.createdAt,
        })
        notificationsCreated += 1
      }
    }

    const walletKey = `member:${account._id}:booking`
    let wallet = await ctx.db.query('walletAccounts').withIndex('by_deterministic_key', (q) => q.eq('deterministicKey', walletKey)).unique()
    if (!wallet) {
      const walletId = await ctx.db.insert('walletAccounts', {
        deterministicKey: walletKey,
        accountType: 'member_booking',
        ownerUserId: account._id,
        currency: 'PHP',
        availableCentavos: 2_450_000,
        reservedCentavos: 130_000,
        pendingCentavos: 0,
        createdAt: now - 30 * dayMs,
        updatedAt: now,
      })
      wallet = await ctx.db.get(walletId)
    } else {
      await ctx.db.patch(wallet._id, { availableCentavos: Math.max(wallet.availableCentavos, 2_450_000), updatedAt: now })
    }

    const topUpSpecs = [
      { providerIntentId: `presentation:${account._id}:paid`, amountCentavos: 2_000_000, status: 'paid' as const, ageDays: 14 },
      { providerIntentId: `presentation:${account._id}:recent`, amountCentavos: 500_000, status: 'paid' as const, ageDays: 3 },
    ]
    for (const spec of topUpSpecs) {
      const existing = await ctx.db.query('paymongoTopUps').withIndex('by_provider_intent_id', (q) => q.eq('providerIntentId', spec.providerIntentId)).unique()
      if (!existing) {
        const createdAt = now - spec.ageDays * dayMs
        await ctx.db.insert('paymongoTopUps', {
          beneficiaryUserId: account._id,
          purpose: 'member_booking_balance',
          amountCentavos: spec.amountCentavos,
          currency: 'PHP',
          mode: 'test',
          status: spec.status,
          providerIntentId: spec.providerIntentId,
          providerStatus: 'succeeded',
          paidAt: createdAt + 2 * 60 * 1_000,
          createdAt,
          updatedAt: createdAt + 2 * 60 * 1_000,
        })
      }
    }

    return {
      accountId: account._id,
      companionsAvailable: seededProfiles.length,
      postsCreated,
      relationshipsCreated,
      conversationsCreated,
      messagesCreated,
      bookingsCreated,
      notificationsCreated,
      bookingIds,
      conversationIds,
    }
  },
})

const developmentConfirmation = v.literal('development')
const peopleBatchSize = 10
const activityBatchSize = 8

function requireDevelopmentConfirmation(confirm: string) {
  if (confirm !== 'development') throw new Error('Development seed confirmation is required')
}

function philippinesCompanionClerkUserId(key: string) {
  return `seed:philippines:companion:${key}`
}

function philippinesMemberClerkUserId(key: string) {
  return `seed:philippines:member:${key}`
}

function philippinesApplicantClerkUserId(key: string) {
  return `seed:philippines:applicant:${key}`
}

export const seedPhilippinesPeopleBatch = internalMutation({
  args: {
    confirm: developmentConfirmation,
    start: v.number(),
    referenceTime: v.number(),
  },
  handler: async (ctx, args) => {
    requireDevelopmentConfirmation(args.confirm)
    const people = [
      ...approvedPhilippinesCompanions.map((seed) => ({ kind: 'approved_companion' as const, seed })),
      ...philippinesMembers.map((seed) => ({ kind: 'member' as const, seed })),
      ...pendingCompanionApplicants.map((seed) => ({ kind: 'applicant' as const, seed })),
    ]
    const batch = people.slice(args.start, args.start + peopleBatchSize)
    let usersCreated = 0
    let usersUpdated = 0
    let profilesCreated = 0
    let profilesUpdated = 0

    for (const [batchIndex, item] of batch.entries()) {
      const catalogIndex = args.start + batchIndex
      const isMember = item.kind === 'member'
      const isApplicant = item.kind === 'applicant'
      const clerkUserId = isMember
        ? philippinesMemberClerkUserId(item.seed.key)
        : isApplicant
          ? philippinesApplicantClerkUserId(item.seed.key)
          : philippinesCompanionClerkUserId(item.seed.key)
      const existingUser = await ctx.db.query('users')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
        .unique()
      const userFields = {
        username: item.seed.key.replaceAll('-', '_'),
        displayName: item.seed.displayName,
        bio: item.seed.bio,
        onboardingCategories: isMember ? [...item.seed.onboardingCategories] : [...item.seed.categories],
        onboardingGoal: isMember ? 'member' as const : 'companion' as const,
        onboardingCompletedAt: args.referenceTime,
        ...(!isMember ? {
          approximateLatitude: item.seed.latitude,
          approximateLongitude: item.seed.longitude,
          approximateLocationConsentedAt: args.referenceTime,
        } : {}),
        termsAcceptedAt: args.referenceTime,
        termsVersion: '2026-08-13',
        role: isMember ? 'member' as const : 'companion' as const,
        verificationStatus: isApplicant ? 'pending' as const : 'approved' as const,
        verificationSource: isApplicant ? 'in_app' as const : 'persona' as const,
        ...(isApplicant ? {} : {
          identityVerifiedAt: args.referenceTime,
          identityExpiresAt: args.referenceTime + 3_650 * dayMs,
        }),
        suspended: isMember && catalogIndex >= approvedPhilippinesCompanions.length + philippinesMembers.length - 4,
        updatedAt: args.referenceTime,
      }
      const userId = existingUser
        ? (await ctx.db.patch(existingUser._id, userFields), existingUser._id)
        : await ctx.db.insert('users', { clerkUserId, ...userFields, createdAt: args.referenceTime })
      if (existingUser) usersUpdated += 1
      else usersCreated += 1

      if (isMember) continue
      const existingProfile = await ctx.db.query('companionProfiles')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique()
      const profileFields = {
        displayName: item.seed.displayName,
        intro: item.seed.intro,
        city: item.seed.city,
        approximateArea: item.seed.approximateArea,
        approximateLatitude: item.seed.latitude,
        approximateLongitude: item.seed.longitude,
        nearbyDiscoveryEnabled: true,
        strengths: [...item.seed.strengths],
        categories: [...item.seed.categories],
        boundaries: ['Public places only', 'No dating or romantic expectations'],
        mode: item.seed.mode,
        hourlyRateCentavos: item.seed.hourlyRateCentavos,
        status: isApplicant ? 'pending_review' as const : 'approved' as const,
        applicationNote: isApplicant
          ? 'Development seed awaiting admin review.'
          : 'Development seed for Philippines discovery testing.',
        rating: isApplicant ? 0 : 4.5 + (catalogIndex % 5) / 10,
        reviewCount: isApplicant ? 0 : 2,
        updatedAt: args.referenceTime,
      }
      const profileId = existingProfile?._id ?? await ctx.db.insert('companionProfiles', {
        userId,
        ...profileFields,
        createdAt: args.referenceTime,
      })
      if (existingProfile) {
        await ctx.db.patch(existingProfile._id, profileFields)
        profilesUpdated += 1
      } else profilesCreated += 1
      const [user, profile] = await Promise.all([ctx.db.get(userId), ctx.db.get(profileId)])
      if (!profile) throw new Error(`Seeded Companion profile was not saved: ${item.seed.key}`)
      await syncCompanionLocation(ctx, profile, user)
    }

    return { processed: batch.length, usersCreated, usersUpdated, profilesCreated, profilesUpdated }
  },
})

const pampangaActivitySeeds = pampangaCompanions.map((seed) => ({
  key: seed.key,
  displayName: seed.displayName,
  categories: [...seed.categories],
  mode: seed.mode,
  hourlyRateCentavos: 50_000,
  clerkUserId: `seed:pampanga:${seed.key}`,
}))

const philippinesActivitySeeds = [
  ...pampangaActivitySeeds,
  ...approvedPhilippinesCompanions.map((seed) => ({
    key: seed.key,
    displayName: seed.displayName,
    categories: seed.categories,
    mode: seed.mode,
    hourlyRateCentavos: seed.hourlyRateCentavos,
    clerkUserId: philippinesCompanionClerkUserId(seed.key),
  })),
]

export const seedPhilippinesActivityBatch = internalMutation({
  args: {
    confirm: developmentConfirmation,
    start: v.number(),
    referenceTime: v.number(),
  },
  handler: async (ctx, args) => {
    requireDevelopmentConfirmation(args.confirm)
    const batch = philippinesActivitySeeds.slice(args.start, args.start + activityBatchSize)
    const activeMembers = philippinesMembers.slice(0, philippinesMembers.length - 4)
    let postsCreated = 0
    let bookingsCreated = 0
    let reviewsCreated = 0

    for (const [batchIndex, seed] of batch.entries()) {
      const companionIndex = args.start + batchIndex
      const companionUser = await ctx.db.query('users')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', seed.clerkUserId))
        .unique()
      if (!companionUser) throw new Error(`Seed the Companion first: ${seed.key}`)
      const profile = await ctx.db.query('companionProfiles')
        .withIndex('by_user', (q) => q.eq('userId', companionUser._id))
        .unique()
      if (!profile) throw new Error(`Companion profile is missing: ${seed.key}`)

      const existingPosts = await ctx.db.query('posts')
        .withIndex('by_author', (q) => q.eq('authorId', companionUser._id))
        .collect()
      const postBodies = [
        `${seed.displayName} is opening a relaxed ${seed.categories[0].toLowerCase()} session this week. Clear expectations and kind conversation are welcome.`,
        `A good shared experience can be simple. ${seed.displayName} recommends choosing a comfortable pace and a public meeting place.`,
      ]
      for (const [postIndex, body] of postBodies.entries()) {
        if (existingPosts.some((post) => post.body === body && !post.deletedAt)) continue
        const createdAt = args.referenceTime - (companionIndex * 2 + postIndex + 1) * 60 * 60 * 1_000
        await ctx.db.insert('posts', {
          authorId: companionUser._id,
          body,
          media: [],
          reportable: true,
          hidden: false,
          createdAt,
          updatedAt: createdAt,
        })
        postsCreated += 1
      }

      for (let historyIndex = 0; historyIndex < 2; historyIndex += 1) {
        const memberSeed = activeMembers[(companionIndex * 2 + historyIndex) % activeMembers.length]
        const member = await ctx.db.query('users')
          .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', philippinesMemberClerkUserId(memberSeed.key)))
          .unique()
        if (!member) throw new Error(`Seed the member first: ${memberSeed.key}`)
        const notes = `Development seed completed experience ${historyIndex + 1} with ${seed.displayName}.`
        const companionBookings = await ctx.db.query('bookings')
          .withIndex('by_companion', (q) => q.eq('companionProfileId', profile._id))
          .collect()
        let booking = companionBookings.find((row) => row.notes === notes)
        if (!booking) {
          const requestedAt = args.referenceTime - (20 + historyIndex * 7 + companionIndex % 9) * dayMs
          const completedAt = requestedAt + 60 * 60 * 1_000
          const price = calculateMemberWalletBookingPrice(profile.hourlyRateCentavos ?? seed.hourlyRateCentavos, 60)
          const bookingId = await ctx.db.insert('bookings', {
            memberId: member._id,
            companionProfileId: profile._id,
            category: seed.categories[historyIndex % seed.categories.length],
            mode: seed.mode === 'online' ? 'online' : 'in_person',
            requestedAt,
            durationMinutes: 60,
            notes,
            status: 'closed',
            ...price,
            settlementState: 'settled',
            memberCompletedAt: completedAt,
            companionCompletedAt: completedAt,
            jointlyCompletedAt: completedAt,
            settlementEligibleAt: completedAt,
            settlementResolvedAt: completedAt + dayMs,
            settlementResolution: 'released',
            createdAt: requestedAt - dayMs,
            updatedAt: completedAt + dayMs,
          })
          booking = await ctx.db.get(bookingId) ?? undefined
          bookingsCreated += 1
        }
        if (!booking) throw new Error(`Historical booking was not saved: ${seed.key}`)
        const existingReview = await ctx.db.query('reviews')
          .withIndex('by_booking_reviewer', (q) => q.eq('bookingId', booking!._id).eq('reviewerId', booking!.memberId))
          .first()
        if (!existingReview) {
          const createdAt = booking.jointlyCompletedAt ?? booking.updatedAt
          await ctx.db.insert('reviews', {
            bookingId: booking._id,
            reviewerId: booking.memberId,
            revieweeId: companionUser._id,
            companionProfileId: profile._id,
            rating: (companionIndex + historyIndex) % 4 === 0 ? 4 : 5,
            body: `${seed.displayName} communicated clearly and kept the session comfortable. I appreciated the thoughtful pace.`,
            hidden: false,
            createdAt: createdAt + 30 * 60 * 1_000,
            updatedAt: createdAt + 30 * 60 * 1_000,
          })
          reviewsCreated += 1
        }
      }

      const reviews = await ctx.db.query('reviews')
        .withIndex('by_companion_profile', (q) => q.eq('companionProfileId', profile._id))
        .collect()
      if (reviews.length > 0) {
        await ctx.db.patch(profile._id, {
          rating: reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length,
          reviewCount: reviews.length,
          updatedAt: args.referenceTime,
        })
      }

      const incomingMemberSeed = activeMembers[(companionIndex * 3 + 5) % activeMembers.length]
      const incomingMember = await ctx.db.query('users')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', philippinesMemberClerkUserId(incomingMemberSeed.key)))
        .unique()
      if (!incomingMember) throw new Error(`Seed the member first: ${incomingMemberSeed.key}`)
      const incomingNotes = `Development seed incoming request for ${seed.displayName}.`
      const incomingBookings = await ctx.db.query('bookings')
        .withIndex('by_member', (q) => q.eq('memberId', incomingMember._id))
        .collect()
      if (!incomingBookings.some((row) => row.companionProfileId === profile._id && row.notes === incomingNotes)) {
        const durationMinutes = companionIndex % 3 === 0 ? 90 : 60
        const requestedAt = args.referenceTime + (2 + companionIndex % 21) * dayMs
        const price = calculateMemberWalletBookingPrice(profile.hourlyRateCentavos ?? seed.hourlyRateCentavos, durationMinutes)
        await ctx.db.insert('bookings', {
          memberId: incomingMember._id,
          companionProfileId: profile._id,
          category: seed.categories[0],
          mode: seed.mode === 'online' ? 'online' : 'in_person',
          requestedAt,
          durationMinutes,
          notes: incomingNotes,
          status: companionIndex % 4 === 0 ? 'accepted' : 'request_sent',
          ...price,
          settlementState: 'reserved',
          createdAt: args.referenceTime - (companionIndex % 5) * 60 * 60 * 1_000,
          updatedAt: args.referenceTime,
        })
        bookingsCreated += 1
      }
    }

    return { processed: batch.length, postsCreated, bookingsCreated, reviewsCreated }
  },
})

export const seedPhilippinesAdminFixtures = internalMutation({
  args: { confirm: developmentConfirmation, referenceTime: v.number() },
  handler: async (ctx, args) => {
    requireDevelopmentConfirmation(args.confirm)
    let identityRecordsCreated = 0
    let verificationRequestsCreated = 0
    const identityImageNeeds: Array<{
      identityRecordId: Id<'identityRecords'>
      userId: Id<'users'>
      kind: 'id_front' | 'selfie'
      seedKey: string
    }> = []

    for (const [index, seed] of pendingCompanionApplicants.entries()) {
      const user = await ctx.db.query('users')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', philippinesApplicantClerkUserId(seed.key)))
        .unique()
      if (!user) throw new Error(`Seed the applicant first: ${seed.key}`)
      const requests = await ctx.db.query('verificationRequests')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .collect()
      let request = requests.find((row) => row.reason === 'companion_application' && row.isCurrent === true)
      let identityRecord = request?.identityRecordId ? await ctx.db.get(request.identityRecordId) : null
      const recordFields = {
        reason: 'companion_application' as const,
        source: 'in_app' as const,
        stage: 'ready_for_review' as const,
        selectedIdType: 'national_id' as const,
        fullLegalName: `Seed Applicant ${index + 1}`,
        dateOfBirth: `199${index}-01-15`,
        idType: 'national_id' as const,
        idNumberLast4: `${4100 + index}`,
        nationality: 'Filipino',
        fieldsConfirmedAt: args.referenceTime - dayMs,
        thirdPartyProcessingConsentedAt: args.referenceTime - dayMs,
        reviewConsentedAt: args.referenceTime - dayMs,
        submittedAt: args.referenceTime - 12 * 60 * 60 * 1_000,
        updatedAt: args.referenceTime,
      }
      if (!identityRecord) {
        const identityRecordId = await ctx.db.insert('identityRecords', {
          userId: user._id,
          ...recordFields,
          createdAt: args.referenceTime - dayMs,
        })
        identityRecord = await ctx.db.get(identityRecordId)
        identityRecordsCreated += 1
      } else await ctx.db.patch(identityRecord._id, recordFields)
      if (!identityRecord) throw new Error(`Identity record was not saved: ${seed.key}`)
      const requestFields = {
        reason: 'companion_application' as const,
        personaStatus: 'not_started' as const,
        personaDecision: 'unknown' as const,
        verificationSource: 'in_app' as const,
        identityRecordId: identityRecord._id,
        identityStage: 'ready_for_review' as const,
        extractionNeedsReview: false,
        adminStatus: 'pending' as const,
        isCurrent: true,
        attempt: 1,
        providerCompletedAt: args.referenceTime - 12 * 60 * 60 * 1_000,
        adminQueuedAt: args.referenceTime - 12 * 60 * 60 * 1_000,
        updatedAt: args.referenceTime,
      }
      if (!request) {
        const requestId = await ctx.db.insert('verificationRequests', {
          userId: user._id,
          ...requestFields,
          createdAt: args.referenceTime - dayMs,
        })
        request = await ctx.db.get(requestId) ?? undefined
        verificationRequestsCreated += 1
      } else await ctx.db.patch(request._id, requestFields)
      if (!request) throw new Error(`Verification request was not saved: ${seed.key}`)
      await ctx.db.patch(identityRecord._id, { verificationRequestId: request._id })

      for (const kind of ['id_front', 'selfie'] as const) {
        const existingImage = await ctx.db.query('identityRecordImages')
          .withIndex('by_record_kind', (q) => q.eq('identityRecordId', identityRecord._id).eq('kind', kind))
          .unique()
        if (existingImage?.storageId && !existingImage.purgedAt) continue
        identityImageNeeds.push({ identityRecordId: identityRecord._id, userId: user._id, kind, seedKey: seed.key })
      }
    }

    const reporter = await ctx.db.query('users')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', philippinesMemberClerkUserId(philippinesMembers[0].key)))
      .unique()
    if (!reporter) throw new Error('Seeded report author is missing')
    const reportStatuses = ['open', 'open', 'reviewing', 'resolved', 'dismissed', 'open', 'reviewing', 'resolved'] as const
    let reportsCreated = 0
    let postsHidden = 0
    let reviewsHidden = 0

    for (let index = 0; index < reportStatuses.length; index += 1) {
      const activitySeed = philippinesActivitySeeds[pampangaActivitySeeds.length + index]
      const companionUser = await ctx.db.query('users')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', activitySeed.clerkUserId))
        .unique()
      if (!companionUser) throw new Error(`Seeded report target is missing: ${activitySeed.key}`)
      const profile = await ctx.db.query('companionProfiles')
        .withIndex('by_user', (q) => q.eq('userId', companionUser._id))
        .unique()
      if (!profile) throw new Error(`Seeded report profile is missing: ${activitySeed.key}`)
      const posts = await ctx.db.query('posts').withIndex('by_author', (q) => q.eq('authorId', companionUser._id)).collect()
      const reviews = await ctx.db.query('reviews').withIndex('by_companion_profile', (q) => q.eq('companionProfileId', profile._id)).collect()
      const bookings = await ctx.db.query('bookings').withIndex('by_companion', (q) => q.eq('companionProfileId', profile._id)).collect()
      const post = posts[0]
      const review = reviews[0]
      const booking = bookings[0]
      if (!post || !review || !booking) throw new Error(`Seed activity before admin fixtures: ${activitySeed.key}`)
      if (index < 4 && !post.hidden) {
        await ctx.db.patch(post._id, { hidden: true, updatedAt: args.referenceTime })
        postsHidden += 1
      }
      if (index < 4 && review.hidden !== true) {
        await ctx.db.patch(review._id, { hidden: true, updatedAt: args.referenceTime })
        reviewsHidden += 1
      }
      const target = index % 3 === 0
        ? { targetType: 'post' as const, targetId: String(post._id) }
        : index % 3 === 1
          ? { targetType: 'review' as const, targetId: String(review._id) }
          : { targetType: 'booking' as const, targetId: String(booking._id), bookingId: booking._id }
      const reason = `Development seed report ${index + 1}.`
      const reporterReports = await ctx.db.query('reports').withIndex('by_reporter', (q) => q.eq('reporterId', reporter._id)).collect()
      const existingReport = reporterReports.find((row) => row.reason === reason)
      const status = reportStatuses[index]
      const reportFields = {
        ...target,
        reason,
        status,
        ...('bookingId' in target && target.bookingId && status === 'open' ? { settlementHoldAppliedAt: args.referenceTime } : {}),
        ...(status === 'resolved' || status === 'dismissed' ? { settlementHoldReleasedAt: args.referenceTime } : {}),
        ...(status !== 'open' ? { reviewerNote: `Development seed ${status} report.` } : {}),
        updatedAt: args.referenceTime,
      }
      if (existingReport) await ctx.db.patch(existingReport._id, reportFields)
      else {
        await ctx.db.insert('reports', {
          reporterId: reporter._id,
          ...reportFields,
          createdAt: args.referenceTime - (index + 1) * 60 * 60 * 1_000,
        })
        reportsCreated += 1
      }
      if ('bookingId' in target && target.bookingId && status === 'open' && booking.settlementState !== 'blocked') {
        await ctx.db.patch(booking._id, {
          settlementState: 'blocked',
          settlementBlockedAt: args.referenceTime,
          updatedAt: args.referenceTime,
        })
      }
    }

    return {
      identityRecordsCreated,
      verificationRequestsCreated,
      identityImageNeeds,
      reportsCreated,
      postsHidden,
      reviewsHidden,
    }
  },
})

export const seedPhilippinesIdentityImages = internalMutation({
  args: {
    confirm: developmentConfirmation,
    referenceTime: v.number(),
    images: v.array(v.object({
      identityRecordId: v.id('identityRecords'),
      userId: v.id('users'),
      kind: v.union(v.literal('id_front'), v.literal('selfie')),
      storageId: v.id('_storage'),
      size: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    requireDevelopmentConfirmation(args.confirm)
    let created = 0
    let updated = 0
    for (const image of args.images) {
      const identityRecord = await ctx.db.get(image.identityRecordId)
      if (!identityRecord || identityRecord.userId !== image.userId) {
        throw new Error('Seeded identity image does not match its identity record')
      }
      const existing = await ctx.db.query('identityRecordImages')
        .withIndex('by_record_kind', (q) => q.eq('identityRecordId', image.identityRecordId).eq('kind', image.kind))
        .unique()
      const fields = {
        storageId: image.storageId,
        contentType: 'image/jpeg',
        size: image.size,
        createdAt: args.referenceTime - dayMs,
        retentionDueAt: args.referenceTime + 365 * dayMs,
        purgeAfter: args.referenceTime + 365 * dayMs,
        purgedAt: undefined,
        purgeReason: undefined,
      }
      if (existing) {
        await ctx.db.patch(existing._id, fields)
        updated += 1
      } else {
        await ctx.db.insert('identityRecordImages', {
          identityRecordId: image.identityRecordId,
          userId: image.userId,
          kind: image.kind,
          ...fields,
        })
        created += 1
      }
    }
    return { created, updated }
  },
})

export const seedPhilippinesDevelopment = internalAction({
  args: { confirm: developmentConfirmation },
  handler: async (ctx, args): Promise<{
    referenceTime: number
    peopleBatches: number
    activityBatches: number
  }> => {
    requireDevelopmentConfirmation(args.confirm)
    const referenceTime = Date.now()
    await ctx.runMutation(internal.seeds.seedPampangaCompanions, {})
    let peopleBatches = 0
    const peopleTotal = approvedPhilippinesCompanions.length + philippinesMembers.length + pendingCompanionApplicants.length
    for (let start = 0; start < peopleTotal; start += peopleBatchSize) {
      await ctx.runMutation(internal.seeds.seedPhilippinesPeopleBatch, {
        confirm: 'development',
        start,
        referenceTime,
      })
      peopleBatches += 1
    }
    let activityBatches = 0
    for (let start = 0; start < philippinesActivitySeeds.length; start += activityBatchSize) {
      await ctx.runMutation(internal.seeds.seedPhilippinesActivityBatch, {
        confirm: 'development',
        start,
        referenceTime,
      })
      activityBatches += 1
    }
    const adminFixtures = await ctx.runMutation(internal.seeds.seedPhilippinesAdminFixtures, {
      confirm: 'development',
      referenceTime,
    })
    if (adminFixtures.identityImageNeeds.length > 0) {
      const images = []
      for (const need of adminFixtures.identityImageNeeds) {
        const blob = new Blob([`Development seed ${need.kind} for ${need.seedKey}`], { type: 'image/jpeg' })
        images.push({
          identityRecordId: need.identityRecordId,
          userId: need.userId,
          kind: need.kind,
          storageId: await ctx.storage.store(blob),
          size: blob.size,
        })
      }
      await ctx.runMutation(internal.seeds.seedPhilippinesIdentityImages, {
        confirm: 'development',
        referenceTime,
        images,
      })
    }
    return { referenceTime, peopleBatches, activityBatches }
  },
})
