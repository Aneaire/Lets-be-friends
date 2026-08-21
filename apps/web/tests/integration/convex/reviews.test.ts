import geospatialTest from '@convex-dev/geospatial/test'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

function createTest() {
  const t = convexTest(schema, convexModules)
  geospatialTest.register(t)
  return t
}

async function seedReviewableBooking(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const user = (clerkUserId: string, role: 'member' | 'companion' = 'member') => ({
      clerkUserId,
      displayName: clerkUserId,
      role,
      verificationStatus: 'not_started' as const,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
    const memberId = await ctx.db.insert('users', user('review-member'))
    const companionUserId = await ctx.db.insert('users', user('review-companion', 'companion'))
    await ctx.db.insert('users', user('review-outsider'))
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Review Companion',
      intro: 'A Companion used to verify review behavior.',
      city: 'Test City',
      strengths: ['Good listener'],
      categories: ['Good company'],
      boundaries: ['Public places only'],
      mode: 'both',
      status: 'approved',
      rating: 4,
      reviewCount: 2,
      createdAt: now,
      updatedAt: now,
    })
    const bookingId = await ctx.db.insert('bookings', {
      memberId,
      companionProfileId,
      category: 'Good company',
      mode: 'online',
      requestedAt: now - 86_400_000,
      durationMinutes: 60,
      status: 'review_window',
      createdAt: now,
      updatedAt: now,
    })
    return { bookingId, companionProfileId }
  })
}

describe('review submission', () => {
  it('records participant reviews, updates the Companion rating, and closes after both sides review', async () => {
    const t = createTest()
    const { bookingId, companionProfileId } = await seedReviewableBooking(t)

    await t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, {
      bookingId,
      rating: 5,
      body: '  Thoughtful session  ',
    })
    let state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      companion: await ctx.db.get(companionProfileId),
      reviews: await ctx.db.query('reviews').collect(),
    }))
    expect(state.booking?.status).toBe('review_window')
    expect(state.companion).toMatchObject({ rating: 13 / 3, reviewCount: 3 })
    expect(state.reviews[0]).toMatchObject({ rating: 5, body: 'Thoughtful session', companionProfileId })

    await t.withIdentity({ subject: 'review-companion' }).mutation(api.reviews.submit, {
      bookingId,
      rating: 4,
    })
    state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      companion: await ctx.db.get(companionProfileId),
      reviews: await ctx.db.query('reviews').collect(),
    }))
    expect(state.booking?.status).toBe('closed')
    expect(state.companion?.reviewCount).toBe(3)
    expect(state.reviews).toHaveLength(2)
    expect(await t.run(async (ctx) => ctx.db.query('auditLogs').collect())).toHaveLength(2)
    expect(await t.run(async (ctx) => ctx.db.query('notifications').collect())).toHaveLength(2)
  })

  it('rejects invalid, unauthorized, and duplicate reviews without partial writes', async () => {
    const t = createTest()
    const { bookingId, companionProfileId } = await seedReviewableBooking(t)

    await expect(t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, {
      bookingId,
      rating: 6,
    })).rejects.toThrow('between 1 and 5')
    await expect(t.withIdentity({ subject: 'review-outsider' }).mutation(api.reviews.submit, {
      bookingId,
      rating: 5,
    })).rejects.toThrow('Not your booking')
    await t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, { bookingId, rating: 5 })
    await expect(t.withIdentity({ subject: 'review-member' }).mutation(api.reviews.submit, {
      bookingId,
      rating: 1,
    })).rejects.toThrow('already reviewed')

    const state = await t.run(async (ctx) => ({
      booking: await ctx.db.get(bookingId),
      companion: await ctx.db.get(companionProfileId),
      reviews: await ctx.db.query('reviews').collect(),
      audits: await ctx.db.query('auditLogs').collect(),
      notifications: await ctx.db.query('notifications').collect(),
    }))
    expect(state.booking?.status).toBe('review_window')
    expect(state.companion).toMatchObject({ rating: 13 / 3, reviewCount: 3 })
    expect(state.reviews).toHaveLength(1)
    expect(state.audits).toHaveLength(1)
    expect(state.notifications).toHaveLength(1)
  })
})
