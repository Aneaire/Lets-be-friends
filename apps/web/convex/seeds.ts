import { internalMutation } from './_generated/server'
import { syncHostLocation } from './hostLocations'

const dayMs = 24 * 60 * 60 * 1_000

const pampangaHosts = [
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
    bio: 'A privacy-control test profile that remains in ordinary discovery.',
    city: 'Bacolor, Pampanga',
    approximateArea: 'Private Bacolor test area',
    latitude: 15.00,
    longitude: 120.66,
    intro: 'This Friend Host intentionally stays hidden from nearby searches to test the privacy setting.',
    strengths: ['Online chat friend', 'Good listener'],
    categories: ['Online conversation'],
    mode: 'both' as const,
    rating: 4.4,
    reviewCount: 5,
    nearbyDiscoveryEnabled: false,
  },
] as const

export const seedPampangaHosts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    let created = 0
    let updated = 0

    for (const seed of pampangaHosts) {
      const clerkUserId = `seed:pampanga:${seed.key}`
      const existingUser = await ctx.db
        .query('users')
        .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
        .unique()

      const userFields = {
        displayName: seed.displayName,
        bio: seed.bio,
        role: 'friend_host' as const,
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

      const existingHost = await ctx.db
        .query('hostProfiles')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique()

      const hostFields = {
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
        status: 'approved' as const,
        applicationNote: 'Development seed for Pampanga nearby-search testing.',
        rating: seed.rating,
        reviewCount: seed.reviewCount,
        updatedAt: now,
      }

      const hostProfileId = existingHost?._id ?? await ctx.db.insert('hostProfiles', {
        userId,
        ...hostFields,
        createdAt: now,
      })

      if (existingHost) {
        await ctx.db.patch(existingHost._id, hostFields)
        updated += 1
      } else {
        created += 1
      }

      const [user, host] = await Promise.all([ctx.db.get(userId), ctx.db.get(hostProfileId)])
      if (!host) throw new Error(`Seeded Friend Host profile was not saved: ${seed.key}`)
      await syncHostLocation(ctx, host, user)
    }

    return {
      created,
      updated,
      total: pampangaHosts.length,
      note: 'Sam is intentionally hidden from nearby search for privacy testing.',
    }
  },
})
