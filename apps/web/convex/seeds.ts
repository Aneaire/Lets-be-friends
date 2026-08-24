import { calculateMemberWalletBookingPrice } from '@lets-be-friends/shared'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { internalMutation } from './_generated/server'
import { syncCompanionLocation } from './companionLocations'

const dayMs = 24 * 60 * 60 * 1_000

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

    for (const seed of pampangaCompanions) {
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
        rating: seed.rating,
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
    }

    return {
      created,
      updated,
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
