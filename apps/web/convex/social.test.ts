import { rerankFeedCandidates, scoreFeedCandidate, type FeedRankingCandidate } from '@lets-be-friends/shared'
import geospatialTest from '@convex-dev/geospatial/test'
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

async function insertUser(t: ReturnType<typeof convexTest>, subject: string, options: { suspended?: boolean; approvedIdentity?: boolean } = {}) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      role: 'member',
      verificationStatus: options.approvedIdentity ? 'approved' : 'not_started',
      verificationSource: options.approvedIdentity ? 'persona' : undefined,
      identityVerifiedAt: options.approvedIdentity ? now : undefined,
      identityExpiresAt: options.approvedIdentity ? now + 86_400_000 : undefined,
      suspended: options.suspended ?? false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function insertPost(t: ReturnType<typeof convexTest>, authorId: any, body: string, options: { hidden?: boolean; deleted?: boolean; createdAt?: number } = {}) {
  return await t.run(async (ctx) => {
    const createdAt = options.createdAt ?? Date.now()
    return await ctx.db.insert('posts', {
      authorId,
      body,
      reportable: true,
      hidden: options.hidden ?? false,
      deletedAt: options.deleted ? createdAt : undefined,
      createdAt,
      updatedAt: createdAt,
    })
  })
}

async function insertCompanion(t: ReturnType<typeof convexTest>, userId: any, status: 'approved' | 'draft' = 'approved') {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('companionProfiles', {
      userId,
      displayName: 'Private companion field',
      intro: 'A thoughtful Companion profile for safe public activities.',
      city: 'Private city',
      approximateArea: 'Private area',
      approximateLatitude: 10.31,
      approximateLongitude: 123.89,
      nearbyDiscoveryEnabled: true,
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode: 'both',
      status,
      rating: 4.8,
      reviewCount: 8,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('For You ranking helpers', () => {
  it('scores and re-ranks deterministically, bounding exploration while alternatives remain', () => {
    const candidates: FeedRankingCandidate[] = Array.from({ length: 12 }, (_, index) => ({
      id: `post-${String(index).padStart(2, '0')}`,
      authorId: index < 4 ? 'author-a' : `author-${Math.floor(index / 2)}`,
      category: index % 2 === 0 ? 'Coffee' : 'Walking',
      source: index >= 8 ? 'exploration' : 'interest',
      seen: index === 0,
      signals: {
        relationship: index < 4 ? 1 : 0.4,
        category: 0.8,
        freshness: 0.9 - index * 0.02,
        meaningfulEngagement: 0.4,
        trustQuality: 0.7,
        underexposure: index >= 8 ? 1 : 0.3,
      },
    }))

    expect(scoreFeedCandidate(candidates[0].signals)).toBeCloseTo(0.78)
    const first = rerankFeedCandidates(candidates, { pageSize: 10, maxPerAuthor: 2, explorationShare: 0.2 })
    const second = rerankFeedCandidates([...candidates].reverse(), { pageSize: 10, maxPerAuthor: 2, explorationShare: 0.2 })

    expect(first.map((candidate) => candidate.id)).toEqual(second.map((candidate) => candidate.id))
    expect(first.filter((candidate) => candidate.authorId === 'author-a')).toHaveLength(2)
    expect(first.length).toBeGreaterThanOrEqual(8)
    expect(first.slice(0, 8).filter((candidate) => candidate.source === 'exploration').length).toBeLessThanOrEqual(2)
    expect(first.every((candidate, index) => index === 0 || candidate.authorId !== first[index - 1].authorId)).toBe(true)
    expect(first[0].seen).not.toBe(true)
  })
})

describe('social feed behavior', () => {
  it('filters hidden, deleted, and suspended-author posts before ranking', async () => {
    const t = createTest()
    const safeAuthor = await insertUser(t, 'safe-author')
    const suspendedAuthor = await insertUser(t, 'suspended-author', { suspended: true })
    await insertPost(t, safeAuthor, 'safe post')
    await insertPost(t, safeAuthor, 'hidden post', { hidden: true })
    await insertPost(t, safeAuthor, 'deleted post', { hidden: true, deleted: true })
    await insertPost(t, suspendedAuthor, 'suspended post')

    const items = await t.query(api.social.feed, { filter: 'for_you' }) as any[]
    const postBodies = items.filter((item) => item.kind === 'post').map((item) => item.post.body)
    expect(postBodies).toEqual(['safe post'])
    expect(items.at(-1)).toMatchObject({ kind: 'guidance', source: 'first_party_guidance' })
  })

  it('uses only real approved, unsuspended, currently identity-approved companions as fallback', async () => {
    const t = createTest()
    const approvedUser = await insertUser(t, 'approved-companion', { approvedIdentity: true })
    const expiredUser = await insertUser(t, 'expired-companion')
    const suspendedUser = await insertUser(t, 'suspended-companion', { approvedIdentity: true, suspended: true })
    await insertCompanion(t, approvedUser)
    await insertCompanion(t, expiredUser)
    await insertCompanion(t, suspendedUser)

    const items = await t.query(api.social.feed, { filter: 'for_you' }) as any[]
    const companions = items.filter((item) => item.kind === 'companion')
    expect(companions).toHaveLength(1)
    expect(companions[0].companion.displayName).toBe('approved-companion')
    expect(companions[0].companion).not.toHaveProperty('city')
    expect(companions[0].companion).not.toHaveProperty('approximateArea')
    expect(companions[0].companion).not.toHaveProperty('approximateLatitude')
    expect(companions[0].companion).not.toHaveProperty('approximateLongitude')
    expect(items.at(-1).kind).toBe('guidance')
  })

  it('adds a public profile target to posts only for eligible Companions', async () => {
    const t = createTest()
    const approvedUser = await insertUser(t, 'approved-post-author', { approvedIdentity: true })
    const memberUser = await insertUser(t, 'member-post-author')
    const approvedCompanionId = await insertCompanion(t, approvedUser)
    await insertPost(t, approvedUser, 'companion post')
    await insertPost(t, memberUser, 'member post')

    const items = await t.query(api.social.feed, { filter: 'for_you' }) as any[]
    const posts = items.filter((item) => item.kind === 'post').map((item) => item.post)
    expect(posts.find((post) => post.body === 'companion post').authorCompanionProfileId).toBe(approvedCompanionId)
    expect(posts.find((post) => post.body === 'member post').authorCompanionProfileId).toBeUndefined()
  })

  it('keeps Following chronological and Following/Saved free of fallback items', async () => {
    const t = createTest()
    const viewerId = await insertUser(t, 'viewer')
    const followedId = await insertUser(t, 'followed')
    await t.run(async (ctx) => ctx.db.insert('follows', { followerId: viewerId, followingId: followedId, createdAt: Date.now() }))

    const emptySaved = await t.withIdentity({ subject: 'viewer' }).query(api.social.feed, { filter: 'saved' })
    expect(emptySaved).toEqual([])

    const olderId = await insertPost(t, followedId, 'older', { createdAt: 100 })
    await insertPost(t, followedId, 'newer', { createdAt: 200 })
    const following = await t.withIdentity({ subject: 'viewer' }).query(api.social.feed, { filter: 'following' }) as any[]
    expect(following.map((item) => item.post.body)).toEqual(['newer', 'older'])
    expect(following.every((item) => item.kind === 'post')).toBe(true)

    await t.run(async (ctx) => ctx.db.insert('savedPosts', { userId: viewerId, postId: olderId, createdAt: 300 }))
    const saved = await t.withIdentity({ subject: 'viewer' }).query(api.social.feed, { filter: 'saved' }) as any[]
    expect(saved.map((item) => item.post.body)).toEqual(['older'])
    expect(saved.every((item) => item.kind === 'post')).toBe(true)
  })

  it('returns a safe requested post outside the ranked page and rejects unavailable targets', async () => {
    const t = createTest()
    const viewerId = await insertUser(t, 'viewer')
    const safeAuthor = await insertUser(t, 'safe-author')
    const suspendedAuthor = await insertUser(t, 'suspended-author', { suspended: true })
    const safePostId = await insertPost(t, safeAuthor, 'requested safe post', { createdAt: 1 })
    const hiddenPostId = await insertPost(t, safeAuthor, 'hidden', { hidden: true })
    const suspendedPostId = await insertPost(t, suspendedAuthor, 'suspended')
    for (let index = 0; index < 25; index += 1) await insertPost(t, safeAuthor, `newer ${index}`, { createdAt: 100 + index })

    const viewer = t.withIdentity({ subject: 'viewer' })
    expect(await viewer.query(api.social.requestedPost, { postId: String(safePostId) })).toMatchObject({ _id: safePostId, body: 'requested safe post', ownPost: false })
    expect(await viewer.query(api.social.requestedPost, { postId: String(hiddenPostId) })).toBeNull()
    expect(await viewer.query(api.social.requestedPost, { postId: String(suspendedPostId) })).toBeNull()
    expect(await viewer.query(api.social.requestedPost, { postId: 'not-an-id' })).toBeNull()
    expect(viewerId).toBeTruthy()
  })

  it('uses guidance only as sparse-feed reserve content', async () => {
    const t = createTest()
    for (let index = 0; index < 8; index += 1) {
      const authorId = await insertUser(t, `healthy-author-${index}`)
      await insertPost(t, authorId, `healthy post ${index}`, { createdAt: 1_000 + index })
    }

    const items = await t.query(api.social.feed, { filter: 'for_you' }) as any[]
    expect(items.filter((item) => item.kind === 'post')).toHaveLength(8)
    expect(items.some((item) => item.kind === 'guidance')).toBe(false)
    expect(items.some((item) => item.kind === 'companion')).toBe(false)
  })
})

describe('feed instrumentation', () => {
  it('deduplicates impressions and validates bounded input', async () => {
    const t = createTest()
    await insertUser(t, 'viewer')
    const viewer = t.withIdentity({ subject: 'viewer' })
    const args = {
      sessionId: 'session-1234',
      surface: 'for_you' as const,
      items: [{
        itemKey: 'guidance:feed-basics',
        itemType: 'guidance' as const,
        source: 'first_party_guidance' as const,
        position: 4,
      }],
    }

    await expect(viewer.mutation(api.social.recordFeedImpressions, args)).resolves.toEqual({ inserted: 1 })
    await expect(viewer.mutation(api.social.recordFeedImpressions, args)).resolves.toEqual({ inserted: 0 })
    const events = await t.run(async (ctx) => ctx.db.query('feedEvents').collect())
    expect(events).toHaveLength(1)
    expect(events[0].position).toBe(4)
    expect(events[0]).toMatchObject({ surface: 'for_you', algorithmVersion: 'feed_v1' })
    expect(events[0]).not.toHaveProperty('location')

    await expect(viewer.mutation(api.social.recordFeedImpressions, { ...args, sessionId: 'short' }))
      .rejects.toThrow('Feed session ID')
    await expect(viewer.mutation(api.social.recordFeedImpressions, {
      sessionId: 'session-1234',
      surface: 'for_you',
      items: Array.from({ length: 21 }, (_, index) => ({
        itemKey: `post:${index}`,
        itemType: 'post' as const,
        source: 'recent' as const,
        position: index,
      })),
    })).rejects.toThrow('1 to 20 items')
    await expect(viewer.mutation(api.social.recordFeedImpressions, {
      ...args,
      items: [{ ...args.items[0], position: 100 }],
    })).rejects.toThrow('position must be an integer from 0 to 99')
  })
})
