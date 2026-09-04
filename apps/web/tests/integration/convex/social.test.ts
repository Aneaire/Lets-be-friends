import geospatialTest from '@convex-dev/geospatial/test'
import { convexTest } from 'convex-test'
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

async function insertUser(t: ReturnType<typeof convexTest>, subject: string, options: { suspended?: boolean; approvedIdentity?: boolean; username?: string } = {}) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      username: options.username,
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

describe('social feed behavior', () => {
  it('terminates cursor pagination after returning more than 150 unique For You posts', async () => {
    const t = createTest()
    await t.run(async (ctx) => {
      const now = Date.now()
      for (let index = 0; index < 151; index += 1) {
        const authorId = await ctx.db.insert('users', { clerkUserId: `author-${index}`, displayName: `Author ${index}`, role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now - index, updatedAt: now - index })
        await ctx.db.insert('posts', { authorId, body: `post ${index}`, reportable: true, hidden: false, createdAt: now - index, updatedAt: now - index })
      }
    })

    const itemKeys = new Set<string>()
    let cursor: string | null = null
    let done = false
    for (let pageNumber = 0; pageNumber < 12 && !done; pageNumber += 1) {
      const result: any = await t.query(api.social.feedPage, { filter: 'for_you', paginationOpts: { cursor, numItems: 20 } })
      result.page.filter((item: any) => item.kind === 'post').forEach((item: any) => {
        expect(itemKeys.has(item.itemKey)).toBe(false)
        itemKeys.add(item.itemKey)
      })
      cursor = result.continueCursor
      done = result.isDone
    }
    expect(done).toBe(true)
    expect(itemKeys.size).toBe(151)
  }, 20_000)

  it('paginates beyond 50 Following and Saved posts without duplicates', async () => {
    const t = createTest()
    const viewerId = await insertUser(t, 'viewer')
    const authorId = await insertUser(t, 'followed-author')
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('follows', { followerId: viewerId, followingId: authorId, createdAt: now })
      for (let index = 0; index < 61; index += 1) {
        const postId = await ctx.db.insert('posts', { authorId, body: `post ${index}`, reportable: true, hidden: false, createdAt: now - index, updatedAt: now - index })
        await ctx.db.insert('savedPosts', { userId: viewerId, postId, createdAt: now - index })
      }
    })
    const viewer = t.withIdentity({ subject: 'viewer' })

    for (const filter of ['following', 'saved'] as const) {
      const itemKeys = new Set<string>()
      let cursor: string | null = null
      let done = false
      for (let pageNumber = 0; pageNumber < 6 && !done; pageNumber += 1) {
        const result: any = await viewer.query(api.social.feedPage, { filter, paginationOpts: { cursor, numItems: 20 } })
        result.page.forEach((item: any) => {
          expect(itemKeys.has(item.itemKey)).toBe(false)
          itemKeys.add(item.itemKey)
        })
        cursor = result.continueCursor
        done = result.isDone
      }
      expect(done).toBe(true)
      expect(itemKeys.size).toBe(61)
    }
  }, 10_000)

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

  it("keeps the viewer's newest own post at the top of For You", async () => {
    const t = createTest()
    const viewerId = await insertUser(t, 'viewer')
    const followedId = await insertUser(t, 'followed')
    await t.run(async (ctx) => ctx.db.insert('follows', {
      followerId: viewerId,
      followingId: followedId,
      createdAt: 300,
    }))
    await insertPost(t, viewerId, 'older own post', { createdAt: 100 })
    const newestOwnPostId = await insertPost(t, viewerId, 'newest own post', { createdAt: 200 })
    await insertPost(t, followedId, 'high relationship post', { createdAt: 250 })

    const items = await t.withIdentity({ subject: 'viewer' }).query(api.social.feed, { filter: 'for_you' }) as any[]
    const posts = items.filter((item) => item.kind === 'post')

    expect(posts[0]).toMatchObject({ itemKey: `post:${newestOwnPostId}`, post: { body: 'newest own post' } })
    expect(posts.filter((item) => item.itemKey === `post:${newestOwnPostId}`)).toHaveLength(1)
  })

  it('pins the newest own post without dropping a ranked item across cursors', async () => {
    const t = createTest()
    const viewerId = await insertUser(t, 'pin-viewer')
    const now = Date.now()
    const newestOwnPostId = await insertPost(t, viewerId, 'newest own post', { createdAt: now })
    const otherIds: string[] = []
    for (let index = 0; index < 24; index += 1) {
      const authorId = await insertUser(t, `pin-author-${index}`)
      otherIds.push(String(await insertPost(t, authorId, `post ${index}`, { createdAt: now - index - 1 })))
    }
    const viewer = t.withIdentity({ subject: 'pin-viewer' })

    const first = await viewer.query(api.social.feedPage, { filter: 'for_you', paginationOpts: { cursor: null, numItems: 20 } }) as any
    const firstKeys = first.page.filter((item: any) => item.kind === 'post').map((item: any) => item.itemKey)
    expect(firstKeys[0]).toBe(`post:${newestOwnPostId}`)
    expect(new Set(firstKeys).size).toBe(firstKeys.length)

    const second = await viewer.query(api.social.feedPage, { filter: 'for_you', paginationOpts: { cursor: first.continueCursor, numItems: 20 } }) as any
    const secondKeys = second.page.filter((item: any) => item.kind === 'post').map((item: any) => item.itemKey)
    const seen = new Set([...firstKeys, ...secondKeys])
    // Every visible post row appears exactly once: pinning moves the own post
    // instead of consuming a cursor row and omitting a ranked item.
    expect(seen.size).toBe(firstKeys.length + secondKeys.length)
    expect(seen).toContain(`post:${newestOwnPostId}`)
    for (const postId of otherIds) expect(seen).toContain(`post:${postId}`)
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
    const safeAuthor = await insertUser(t, 'safe-author', { username: 'safe_author' })
    const suspendedAuthor = await insertUser(t, 'suspended-author', { suspended: true })
    const safePostId = await insertPost(t, safeAuthor, 'requested safe post', { createdAt: 1 })
    const hiddenPostId = await insertPost(t, safeAuthor, 'hidden', { hidden: true })
    const suspendedPostId = await insertPost(t, suspendedAuthor, 'suspended')
    for (let index = 0; index < 25; index += 1) await insertPost(t, safeAuthor, `newer ${index}`, { createdAt: 100 + index })

    const viewer = t.withIdentity({ subject: 'viewer' })
    expect(await viewer.query(api.social.requestedPost, { postId: String(safePostId) })).toMatchObject({
      _id: safePostId,
      body: 'requested safe post',
      authorUsername: 'safe_author',
      createdAt: 1,
      ownPost: false,
    })
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

describe('post media cleanup', () => {
  it('retires only bounded unclaimed grants older than one day', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'media-owner')
    const now = Date.now()
    const { oldId, recentId, claimedId, claimedStorageId } = await t.run(async (ctx) => {
      const claimedStorageId = await ctx.storage.store(new Blob(['claimed media'], { type: 'image/png' }))
      const postId = await ctx.db.insert('posts', { authorId: userId, body: 'claimed', reportable: true, hidden: false, createdAt: now - 2 * 86_400_000, updatedAt: now - 2 * 86_400_000 })
      const [oldId, recentId, claimedId] = await Promise.all([
        ctx.db.insert('postMediaUploads', { userId, createdAt: now - 2 * 86_400_000 }),
        ctx.db.insert('postMediaUploads', { userId, createdAt: now - 60_000 }),
        ctx.db.insert('postMediaUploads', { userId, postId, storageId: claimedStorageId, kind: 'image', contentType: 'image/png', size: 13, createdAt: now - 2 * 86_400_000, registeredAt: now - 2 * 86_400_000 }),
      ])
      return { oldId, recentId, claimedId, claimedStorageId }
    })
    expect(await t.mutation(internal.social.purgeOrphanedMedia, { now })).toMatchObject({ checked: 2, purged: 1 })
    expect((await t.run(async (ctx) => ctx.db.get(oldId)))?.discardedAt).toBe(now)
    expect((await t.run(async (ctx) => ctx.db.get(recentId)))?.discardedAt).toBeUndefined()
    const claimed = await t.run(async (ctx) => ctx.db.get(claimedId))
    expect(claimed).toMatchObject({ postId: expect.any(String), storageId: claimedStorageId })
    expect(claimed?.discardedAt).toBeUndefined()
    expect(await t.run(async (ctx) => ctx.storage.getUrl(claimedStorageId))).toBeTruthy()
  })
})

describe('post and comment mentions', () => {
  async function mentionWorld(t: ReturnType<typeof convexTest>) {
    const now = Date.now()
    return await t.run(async (ctx) => {
      const insertUser = async (clerkUserId: string, username: string, options: { suspended?: boolean } = {}) => {
        const id = await ctx.db.insert('users', { clerkUserId, displayName: clerkUserId, username, role: 'member', verificationStatus: 'not_started', suspended: options.suspended ?? false, createdAt: now, updatedAt: now })
        return id
      }
      const authorId = await insertUser('author', 'author_name')
      const mayaId = await insertUser('maya', 'maya_friend')
      const jayId = await insertUser('jay', 'jay')
      const ghostId = await insertUser('ghost', 'ghost_user', { suspended: true })
      const blockedId = await insertUser('blocked', 'blocked_user')
      await ctx.db.insert('memberSafetyPreferences', { ownerUserId: authorId, targetUserId: blockedId, pairKey: `${authorId}:${blockedId}`, blockedAt: now, createdAt: now, updatedAt: now })
      return { authorId, mayaId, jayId, ghostId, blockedId }
    })
  }

  it('stores canonical usernames and excludes self, suspended, blocked, and duplicates', async () => {
    const t = createTest()
    const world = await mentionWorld(t)
    const author = t.withIdentity({ subject: 'author' })
    const postId = await author.mutation(api.social.createPost, {
      body: `Hello @maya_friend @jay @ghost_user @blocked_user @author_name @maya_friend again`,
    })
    const post = await t.run(async (ctx) => ctx.db.get(postId))
    expect(post?.mentions).toEqual([
      { userId: String(world.mayaId), username: 'maya_friend' },
      { userId: String(world.jayId), username: 'jay' },
    ])
  })

  it('stores mentions on comments and routes a mention notification to the post', async () => {
    const t = createTest()
    const world = await mentionWorld(t)
    const author = t.withIdentity({ subject: 'author' })
    const postId = await author.mutation(api.social.createPost, { body: 'Base post' })
    const commentId = await author.mutation(api.social.createComment, { postId, body: 'Tag @maya_friend and @jay' })
    const comment = await t.run(async (ctx) => ctx.db.get(commentId))
    expect(comment?.mentions).toEqual([
      { userId: String(world.mayaId), username: 'maya_friend' },
      { userId: String(world.jayId), username: 'jay' },
    ])
    const maya = t.withIdentity({ subject: 'maya' })
    const mayaNotifications = await maya.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })
    const mention = mayaNotifications.page.find((row) => row.kind === 'mention')
    expect(mention).toBeTruthy()
    expect(mention?.actor).toMatchObject({ userId: String(world.authorId), displayName: 'author' })
    expect(mention?.destination).toEqual({ type: 'post', postId: String(postId) })
    expect(mention?.title).toBe('You were mentioned')
    expect(mention?.body).toBe('author mentioned you in a comment.')
  })

  it('creates one deduplicated notification per mentioned member for a post', async () => {
    const t = createTest()
    const world = await mentionWorld(t)
    const author = t.withIdentity({ subject: 'author' })
    await author.mutation(api.social.createPost, { body: 'Tag @maya_friend and @maya_friend and @jay' })
    const maya = t.withIdentity({ subject: 'maya' })
    const jay = t.withIdentity({ subject: 'jay' })
    const mayaMentions = (await maya.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })).page.filter((row) => row.kind === 'mention')
    const jayMentions = (await jay.query(api.notifications.list, { paginationOpts: { cursor: null, numItems: 10 } })).page.filter((row) => row.kind === 'mention')
    expect(mayaMentions).toHaveLength(1)
    expect(jayMentions).toHaveLength(1)
    expect(mayaMentions[0].body).toBe('author mentioned you in a post.')
  })

  it('rejects posts that tag more than the allowed number of eligible members', async () => {
    const t = createTest()
    const now = Date.now()
    const ids = await t.run(async (ctx) => {
      const authorId = await ctx.db.insert('users', { clerkUserId: 'author', displayName: 'author', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const tagged: Array<{ clerkUserId: string; username: string }> = []
      for (let index = 0; index < 11; index += 1) {
        const id = await ctx.db.insert('users', { clerkUserId: `user-${index}`, displayName: `User ${index}`, username: `user_${index}`, role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
        tagged.push({ clerkUserId: `user-${index}`, username: `user_${index}` })
      }
      return { authorId, tagged }
    })
    void ids
    const author = t.withIdentity({ subject: 'author' })
    const body = Array.from({ length: 11 }, (_, index) => `@user_${index}`).join(' ')
    await expect(author.mutation(api.social.createPost, { body })).rejects.toThrow('up to 10 people')
  })

  it('keeps nonexistent tokens as plain text and excludes them from stored mentions', async () => {
    const t = createTest()
    await mentionWorld(t)
    const author = t.withIdentity({ subject: 'author' })
    const postId = await author.mutation(api.social.createPost, { body: 'Hi @nobody and @maya_friend' })
    const post = await t.run(async (ctx) => ctx.db.get(postId))
    expect(post?.mentions).toEqual([{ userId: expect.any(String), username: 'maya_friend' }])
  })

  it('lookup matches by username or display name and excludes self, suspended, and hidden users', async () => {
    const t = createTest()
    const world = await mentionWorld(t)
    const author = t.withIdentity({ subject: 'author' })
    const byUsername = await author.query(api.social.mentionLookup, { query: 'maya' })
    expect(byUsername.map((row) => row.username)).toContain('maya_friend')
    expect(byUsername.map((row) => row.userId)).not.toContain(String(world.authorId))
    expect(byUsername.map((row) => row.userId)).not.toContain(String(world.ghostId))
    expect(byUsername.map((row) => row.userId)).not.toContain(String(world.blockedId))
    const byDisplay = await author.query(api.social.mentionLookup, { query: 'jay' })
    expect(byDisplay.map((row) => row.username)).toContain('jay')
  })
})

describe('comment editing', () => {
  it('lets the owner edit, recalculates mentions, and advances updatedAt', async () => {
    const t = createTest()
    const now = Date.now()
    const { authorId, mayaId, postId, commentId } = await t.run(async (ctx) => {
      const authorId = await ctx.db.insert('users', { clerkUserId: 'comment-author', displayName: 'Comment author', username: 'comment_author', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const mayaId = await ctx.db.insert('users', { clerkUserId: 'comment-maya', displayName: 'Maya', username: 'maya_friend', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      const postId = await ctx.db.insert('posts', { authorId, body: 'Base post', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      const commentId = await ctx.db.insert('postComments', { postId, authorId, body: 'Before edit', reportable: true, hidden: false, createdAt: now - 1_000, updatedAt: now - 1_000 })
      return { authorId, mayaId, postId, commentId }
    })

    const author = t.withIdentity({ subject: 'comment-author' })
    await author.mutation(api.social.editComment, {
      commentId,
      body: '  Updated for @maya_friend  ',
    })

    const comment = await t.run(async (ctx) => ctx.db.get(commentId))
    expect(comment).toMatchObject({
      postId,
      authorId,
      body: 'Updated for @maya_friend',
      mentions: [{ userId: String(mayaId), username: 'maya_friend' }],
    })
    expect(comment!.updatedAt).toBeGreaterThan(comment!.createdAt)
  })

  it('rejects edits from anyone except the comment owner', async () => {
    const t = createTest()
    const ownerId = await insertUser(t, 'comment-owner')
    await insertUser(t, 'other-member')
    const postId = await insertPost(t, ownerId, 'Base post')
    const commentId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('postComments', { postId, authorId: ownerId, body: 'Owner comment', reportable: true, hidden: false, createdAt: now, updatedAt: now })
    })

    const other = t.withIdentity({ subject: 'other-member' })
    await expect(
      other.mutation(api.social.editComment, { commentId, body: 'Changed' }),
    ).rejects.toThrow('Only the author can edit this comment')
    expect((await t.run(async (ctx) => ctx.db.get(commentId)))?.body).toBe('Owner comment')
  })

  it('rejects empty, over-limit, and hidden comment edits', async () => {
    const t = createTest()
    const ownerId = await insertUser(t, 'comment-validator')
    const postId = await insertPost(t, ownerId, 'Base post')
    const commentId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('postComments', { postId, authorId: ownerId, body: 'Valid comment', reportable: true, hidden: false, createdAt: now, updatedAt: now })
    })
    const owner = t.withIdentity({ subject: 'comment-validator' })

    await expect(
      owner.mutation(api.social.editComment, { commentId, body: '   ' }),
    ).rejects.toThrow('Comment cannot be empty')
    await expect(
      owner.mutation(api.social.editComment, { commentId, body: 'a'.repeat(501) }),
    ).rejects.toThrow('Comment is too long')

    await t.run(async (ctx) => ctx.db.patch(commentId, { hidden: true }))
    await expect(
      owner.mutation(api.social.editComment, { commentId, body: 'Still hidden' }),
    ).rejects.toThrow('Only the author can edit this comment')
  })
})

describe('comment replies and likes', () => {
  it('stores the reply target and returns per-viewer like state', async () => {
    const t = createTest()
    const postAuthorId = await insertUser(t, 'reply-parent', { username: 'reply_parent' })
    await insertUser(t, 'reply-author', { username: 'reply_author' })
    await insertUser(t, 'comment-liker', { username: 'comment_liker' })
    const postId = await insertPost(t, postAuthorId, 'A post with a thread')
    const parentCommentId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('postComments', {
        postId,
        authorId: postAuthorId,
        body: 'Original comment',
        reportable: true,
        hidden: false,
        createdAt: now,
        updatedAt: now,
      })
    })

    const replyAuthor = t.withIdentity({ subject: 'reply-author' })
    const replyId = await replyAuthor.mutation(api.social.createComment, {
      postId,
      parentCommentId,
      body: '@reply_parent Thanks for this',
    })

    const liker = t.withIdentity({ subject: 'comment-liker' })
    expect(await liker.mutation(api.social.toggleCommentLike, { commentId: replyId })).toBe(true)
    const comments = await liker.query(api.social.commentsForPost, { postId })
    expect(comments.find((comment) => comment._id === replyId)).toMatchObject({
      parentCommentId,
      replyToAuthorDisplayName: 'reply-parent',
      replyToAuthorId: postAuthorId,
      replyToAuthorUsername: 'reply_parent',
      authorUsername: 'reply_author',
      likeCount: 1,
      liked: true,
    })
    const page = await liker.query(api.social.commentPage, { postId, paginationOpts: { cursor: null, numItems: 10 } })
    expect(page.page.find((comment) => comment._id === replyId)).toMatchObject({ parentCommentId, likeCount: 1, liked: true })

    expect(await liker.mutation(api.social.toggleCommentLike, { commentId: replyId })).toBe(false)
    const updated = await liker.query(api.social.commentsForPost, { postId })
    expect(updated.find((comment) => comment._id === replyId)).toMatchObject({ likeCount: 0, liked: false })
    expect(await t.run(async (ctx) => ctx.db.query('commentReactions').collect())).toHaveLength(0)
  })

  it('rejects reply targets from another post and likes on hidden comments without partial writes', async () => {
    const t = createTest()
    const ownerId = await insertUser(t, 'thread-owner')
    await insertUser(t, 'thread-member')
    const postId = await insertPost(t, ownerId, 'Visible post')
    const otherPostId = await insertPost(t, ownerId, 'Other post')
    const { otherCommentId, hiddenCommentId } = await t.run(async (ctx) => {
      const now = Date.now()
      const otherCommentId = await ctx.db.insert('postComments', { postId: otherPostId, authorId: ownerId, body: 'Other thread', reportable: true, hidden: false, createdAt: now, updatedAt: now })
      const hiddenCommentId = await ctx.db.insert('postComments', { postId, authorId: ownerId, body: 'Hidden', reportable: true, hidden: true, createdAt: now + 1, updatedAt: now + 1 })
      return { otherCommentId, hiddenCommentId }
    })
    const member = t.withIdentity({ subject: 'thread-member' })

    await expect(member.mutation(api.social.createComment, {
      postId,
      parentCommentId: otherCommentId,
      body: 'Wrong thread',
    })).rejects.toThrow('Reply target not found')
    await expect(member.mutation(api.social.toggleCommentLike, { commentId: hiddenCommentId })).rejects.toThrow('Comment not found')
    expect(await t.run(async (ctx) => ctx.db.query('commentReactions').collect())).toHaveLength(0)
  })
})

describe('following feed bounded behavior', () => {
  it('keeps followed posts visible despite unrelated newer posts', async () => {
    const t = createTest()
    const viewerId = await insertUser(t, 'following-viewer')
    const followedId = await insertUser(t, 'followed-author')
    const unrelatedId = await insertUser(t, 'unrelated-author')
    await t.run(async (ctx) => ctx.db.insert('follows', { followerId: viewerId, followingId: followedId, createdAt: Date.now() }))

    await insertPost(t, followedId, 'followed old', { createdAt: 100 })
    await insertPost(t, followedId, 'followed new', { createdAt: 200 })
    for (let index = 0; index < 40; index += 1) {
      await insertPost(t, unrelatedId, `unrelated ${index}`, { createdAt: 300 + index })
    }

    const items = await t.withIdentity({ subject: 'following-viewer' }).query(api.social.feed, { filter: 'following' }) as any[]
    expect(items.map((item) => item.post.body)).toEqual(['followed new', 'followed old'])
    expect(items.every((item) => item.kind === 'post')).toBe(true)
  })
})

describe('engagement counters and rate limits', () => {
  it('maintains exact post and comment counters through reactions, likes, saves, and comments', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'counter-author')
    await insertUser(t, 'counter-viewer')
    const postId = await insertPost(t, authorId, 'Counted post')
    const other = t.withIdentity({ subject: 'counter-viewer' })

    const commentId = await other.mutation(api.social.createComment, { postId, body: 'First comment' })
    await other.mutation(api.social.toggleLike, { postId })
    await other.mutation(api.social.toggleSavePost, { postId })
    await other.mutation(api.social.toggleCommentLike, { commentId })

    let post = await t.run(async (ctx) => ctx.db.get(postId))
    expect(post).toMatchObject({ likeCount: 1, commentCount: 1, savedCount: 1 })
    let comment = await t.run(async (ctx) => ctx.db.get(commentId))
    expect(comment?.likeCount).toBe(1)

    await other.mutation(api.social.toggleLike, { postId })
    await other.mutation(api.social.toggleSavePost, { postId })
    await other.mutation(api.social.toggleCommentLike, { commentId })
    post = await t.run(async (ctx) => ctx.db.get(postId))
    expect(post).toMatchObject({ likeCount: 0, commentCount: 1, savedCount: 0 })
    comment = await t.run(async (ctx) => ctx.db.get(commentId))
    expect(comment?.likeCount).toBe(0)
    expect(await t.run(async (ctx) => ctx.db.query('postReactions').collect())).toHaveLength(0)
  })

  it('surfaces counters through the enriched post read shape', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'enrich-counter-author')
    await insertUser(t, 'enrich-counter-viewer')
    const postId = await insertPost(t, authorId, 'Enriched post')
    const other = t.withIdentity({ subject: 'enrich-counter-viewer' })
    await other.mutation(api.social.toggleLike, { postId })
    await other.mutation(api.social.toggleSavePost, { postId })
    await other.mutation(api.social.createComment, { postId, body: 'One comment' })

    const enriched = await other.query(api.social.requestedPost, { postId: String(postId) })
    expect(enriched).toMatchObject({ likeCount: 1, savedCount: 1, commentCount: 1, liked: true, saved: true })
  })

  it('rejects an 11th post in the hour without a post, audit, or notification', async () => {
    const t = createTest()
    await insertUser(t, 'post-ratelimit')
    const author = t.withIdentity({ subject: 'post-ratelimit' })
    for (let index = 0; index < 10; index += 1) {
      await author.mutation(api.social.createPost, { body: `Post ${index}` })
    }
    const before = await t.run(async (ctx) => ({
      posts: (await ctx.db.query('posts').collect()).length,
      audits: (await ctx.db.query('auditLogs').collect()).length,
      notifications: (await ctx.db.query('notifications').collect()).length,
    }))
    await expect(author.mutation(api.social.createPost, { body: 'Over limit' })).rejects.toThrow('hourly limit')
    const after = await t.run(async (ctx) => ({
      posts: (await ctx.db.query('posts').collect()).length,
      audits: (await ctx.db.query('auditLogs').collect()).length,
      notifications: (await ctx.db.query('notifications').collect()).length,
    }))
    expect(before).toMatchObject({ posts: 10, notifications: 0 })
    expect(after).toEqual(before)
  })

  it('rejects the 31st comment in the window without partial writes', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'comment-ratelimit-author')
    await insertUser(t, 'comment-ratelimit-commenter')
    const postId = await insertPost(t, authorId, 'Comment target')
    const commenter = t.withIdentity({ subject: 'comment-ratelimit-commenter' })
    for (let index = 0; index < 30; index += 1) {
      await commenter.mutation(api.social.createComment, { postId, body: `Comment ${index}` })
    }
    const before = await t.run(async (ctx) => ({
      comments: (await ctx.db.query('postComments').collect()).length,
      audits: (await ctx.db.query('auditLogs').collect()).length,
      count: (await ctx.db.get(postId))?.commentCount,
    }))
    await expect(commenter.mutation(api.social.createComment, { postId, body: 'Over limit' })).rejects.toThrow('commenting too quickly')
    const after = await t.run(async (ctx) => ({
      comments: (await ctx.db.query('postComments').collect()).length,
      audits: (await ctx.db.query('auditLogs').collect()).length,
      count: (await ctx.db.get(postId))?.commentCount,
    }))
    expect(before).toMatchObject({ comments: 30, count: 30 })
    expect(after).toEqual(before)
  })

  it('rejects the reaction toggle past 120 per minute while preserving prior state', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'toggle-ratelimit-author')
    await insertUser(t, 'toggle-ratelimit-viewer')
    const postId = await insertPost(t, authorId, 'Like target')
    const viewer = t.withIdentity({ subject: 'toggle-ratelimit-viewer' })
    for (let index = 0; index < 120; index += 1) {
      await viewer.mutation(api.social.toggleLike, { postId })
    }
    const before = await t.run(async (ctx) => ({
      likeCount: (await ctx.db.get(postId))?.likeCount,
      reactions: (await ctx.db.query('postReactions').collect()).length,
    }))
    await expect(viewer.mutation(api.social.toggleLike, { postId })).rejects.toThrow('Slow down')
    const after = await t.run(async (ctx) => ({
      likeCount: (await ctx.db.get(postId))?.likeCount,
      reactions: (await ctx.db.query('postReactions').collect()).length,
    }))
    expect(before).toEqual({ likeCount: 0, reactions: 0 })
    expect(after).toEqual(before)
  })

  it('permits the same member separate counts for comment and reaction families', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'family-separation-author')
    await insertUser(t, 'family-separation-viewer')
    const postId = await insertPost(t, authorId, 'Family target')
    const viewer = t.withIdentity({ subject: 'family-separation-viewer' })
    // 120 toggles exhaust the reaction family but must not touch the comment family.
    for (let index = 0; index < 120; index += 1) {
      await viewer.mutation(api.social.toggleLike, { postId })
    }
    await viewer.mutation(api.social.createComment, { postId, body: 'Comments still allowed' })
    expect((await t.run(async (ctx) => ctx.db.query('postComments').collect())).length).toBe(1)
  })
})

describe('feed event purge', () => {
  it('removes expired feed events in bounded batches and keeps retained events', async () => {
    const t = createTest()
    const now = Date.now()
    const old = now - 100 * 24 * 60 * 60 * 1_000
    await t.run(async (ctx) => {
      for (let index = 0; index < 2; index += 1) {
        const userId = await ctx.db.insert('users', { clerkUserId: `feed-purge-${index}`, displayName: `Feed ${index}`, role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
        await ctx.db.insert('feedEvents', { userId, sessionId: `session-${index}`, itemKey: `post:${index}`, itemType: 'post', source: 'recent', surface: 'for_you', algorithmVersion: 'feed_v1', eventType: 'impression', dedupeKey: `dedupe-${index}`, createdAt: old })
      }
      const recentUserId = await ctx.db.insert('users', { clerkUserId: 'feed-purge-recent', displayName: 'Recent', role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
      await ctx.db.insert('feedEvents', { userId: recentUserId, sessionId: 'session-recent', itemKey: 'post:recent', itemType: 'post', source: 'recent', surface: 'for_you', algorithmVersion: 'feed_v1', eventType: 'impression', dedupeKey: 'dedupe-recent', createdAt: now })
    })
    const first = await t.mutation(internal.social.purgeOldFeedEvents, { limit: 1 })
    expect(first).toMatchObject({ deleted: 1, fullBatch: true })
    const second = await t.mutation(internal.social.purgeOldFeedEvents, { limit: 10 })
    expect(second).toMatchObject({ deleted: 1, fullBatch: false })
    const remaining = await t.run(async (ctx) => ctx.db.query('feedEvents').collect())
    expect(remaining).toHaveLength(1)
    expect(remaining[0].dedupeKey).toBe('dedupe-recent')
  }, 20_000)
})

describe('following feed cursor continuation', () => {
  it('continues the Following filter across pages without duplicating posts', async () => {
    const t = createTest()
    const viewerId = await insertUser(t, 'scan-viewer')
    const followedId = await insertUser(t, 'scan-followed')
    const unrelatedId = await insertUser(t, 'scan-unrelated')
    await t.run(async (ctx) => ctx.db.insert('follows', { followerId: viewerId, followingId: followedId, createdAt: Date.now() }))
    for (let index = 0; index < 60; index += 1) await insertPost(t, unrelatedId, `unrelated ${index}`, { createdAt: 10_000 + index })
    for (let index = 0; index < 45; index += 1) await insertPost(t, followedId, `followed ${index}`, { createdAt: 100 + index })

    const viewer = t.withIdentity({ subject: 'scan-viewer' })
    const itemKeys = new Set<string>()
    let cursor: string | null = null
    let done = false
    let pages = 0
    for (let pageNumber = 0; pageNumber < 40 && !done; pageNumber += 1) {
      const result: any = await viewer.query(api.social.feedPage, { filter: 'following', paginationOpts: { cursor, numItems: 20 } })
      result.page.forEach((item: any) => {
        expect(itemKeys.has(item.itemKey)).toBe(false)
        itemKeys.add(item.itemKey)
      })
      cursor = result.continueCursor
      done = result.isDone
      pages += 1
    }
    expect(done).toBe(true)
    expect(itemKeys.size).toBe(45)
    expect(pages).toBeGreaterThan(1)
  }, 20_000)
})

describe('post comment pagination', () => {
  it('paginates more than 20 comments across cursors with unique rows and completion', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'comment-page-author')
    const postId = await insertPost(t, authorId, 'Post for comment pagination')
    await t.run(async (ctx) => {
      const now = Date.now()
      for (let index = 0; index < 25; index += 1) {
        await ctx.db.insert('postComments', { postId, authorId, body: `comment ${index}`, reportable: true, hidden: false, createdAt: now + index, updatedAt: now + index })
      }
    })
    const ids = new Set<string>()
    let cursor: string | null = null
    let done = false
    for (let pageNumber = 0; pageNumber < 10 && !done; pageNumber += 1) {
      const result: any = await t.query(api.social.commentPage, { postId, paginationOpts: { cursor, numItems: 10 } })
      result.page.forEach((comment: any) => {
        expect(ids.has(String(comment._id))).toBe(false)
        ids.add(String(comment._id))
      })
      cursor = result.continueCursor
      done = result.isDone
    }
    expect(done).toBe(true)
    expect(ids.size).toBe(25)
  }, 20_000)
})

describe('post media attachment guard', () => {
  it('prevents a storage object already attached to a post from being claimed again', async () => {
    const t = createTest()
    await insertUser(t, 'media-owner')
    const owner = t.withIdentity({ subject: 'media-owner' })
    const grant1 = await owner.mutation(api.social.generatePostMediaUploadUrl, {})
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(['media'], { type: 'image/png' }))
      await (ctx.db as any).patch(id, { contentType: 'image/png' })
      return id
    })
    await owner.mutation(api.social.registerPostMediaUpload, { uploadId: grant1.uploadId, storageId })
    const postId = await owner.mutation(api.social.createPost, { body: 'Attached post', mediaUploadIds: [grant1.uploadId] })
    const grant2 = await owner.mutation(api.social.generatePostMediaUploadUrl, {})
    await expect(owner.mutation(api.social.registerPostMediaUpload, { uploadId: grant2.uploadId, storageId })).rejects.toThrow()
    expect((await t.run(async (ctx) => ctx.db.get(grant2.uploadId)))?.storageId).toBeUndefined()
    expect((await t.run(async (ctx) => ctx.db.get(grant2.uploadId)))?.registeredAt).toBeUndefined()
    void postId
  })
})

describe('fresh counter initialization', () => {
  it('initializes fresh counters to zero on created posts and comments', async () => {
    const t = createTest()
    await insertUser(t, 'init-author')
    await insertUser(t, 'init-viewer')
    const postId = await t.withIdentity({ subject: 'init-author' }).mutation(api.social.createPost, { body: 'Fresh post' })
    const commentId = await t.withIdentity({ subject: 'init-viewer' }).mutation(api.social.createComment, { postId, body: 'Fresh comment' })
    const post = await t.run(async (ctx) => ctx.db.get(postId))
    expect(post).toMatchObject({ likeCount: 0, commentCount: 1, savedCount: 0 })
    const comment = await t.run(async (ctx) => ctx.db.get(commentId))
    expect(comment?.likeCount).toBe(0)
  })
})

describe('rate-limit cleanup', () => {
  it('reschedules itself when it clears a full batch of expired rate-limit rows', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'purge-rate-limit-user')
    const now = Date.now()
    await t.run(async (ctx) => {
      for (let index = 0; index < 3; index += 1) {
        await ctx.db.insert('rateLimits', {
          userId,
          actionFamily: 'create_post',
          bucketStart: now - 3 * 60 * 60 * 1_000,
          count: 1,
          expiresAt: now - 1_000,
          createdAt: now - 3 * 60 * 60 * 1_000,
          updatedAt: now - 3 * 60 * 60 * 1_000,
        })
      }
    })
    const first = await t.mutation(internal.rateLimit.purgeExpiredRateLimits, { limit: 2 })
    expect(first).toMatchObject({ deleted: 2, fullBatch: true })
    const second = await t.mutation(internal.rateLimit.purgeExpiredRateLimits, { limit: 10 })
    expect(second).toMatchObject({ deleted: 1, fullBatch: false })
    expect(await t.run(async (ctx) => ctx.db.query('rateLimits').collect())).toHaveLength(0)
  }, 20_000)
})

describe('bounded compatibility comment read', () => {
  it('returns the newest bounded set of comments in chronological order', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'comments-newest-author')
    const postId = await insertPost(t, authorId, 'Post for newest comments')
    const now = Date.now()
    await t.run(async (ctx) => {
      for (let index = 0; index < 105; index += 1) {
        await ctx.db.insert('postComments', {
          postId,
          authorId,
          body: `comment ${index}`,
          reportable: true,
          hidden: false,
          createdAt: now + index,
          updatedAt: now + index,
        })
      }
    })
    const comments = await t.query(api.social.commentsForPost, { postId }) as any[]
    expect(comments).toHaveLength(100)
    const bodies = comments.map((comment) => comment.body)
    // Oldest five are dropped; newest 100 are shown chronologically.
    expect(bodies[0]).toBe('comment 5')
    expect(bodies.at(-1)).toBe('comment 104')
    const indices = bodies.map((body: string) => Number(body.replace('comment ', '')))
    expect(indices).toEqual(Array.from({ length: 100 }, (_, index) => index + 5))
  }, 20_000)
})

describe('comment deletion', () => {
  it('lets the author soft delete a comment, decrement the post count, and audit the removal', async () => {
    const t = createTest()
    const ownerId = await insertUser(t, 'delete-owner')
    await insertUser(t, 'delete-replier')
    const postId = await insertPost(t, ownerId, 'Base post')
    const owner = t.withIdentity({ subject: 'delete-owner' })
    const commentId = await owner.mutation(api.social.createComment, { postId, body: 'Removable comment' })
    const replyId = await t.withIdentity({ subject: 'delete-replier' }).mutation(api.social.createComment, {
      postId,
      body: 'A reply to the removable comment',
      parentCommentId: commentId,
    })
    expect((await t.run(async (ctx) => ctx.db.get(postId)))?.commentCount).toBe(2)

    await owner.mutation(api.social.deleteComment, { commentId })

    const state = await t.run(async (ctx) => ({
      comment: await ctx.db.get(commentId),
      post: await ctx.db.get(postId),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    expect(state.comment?.hidden).toBe(true)
    expect(state.post?.commentCount).toBe(1)
    expect(state.audits.filter((audit) => audit.action === 'post.comment.deleted')).toHaveLength(1)

    const page = await owner.query(api.social.commentPage, { postId, paginationOpts: { cursor: null, numItems: 10 } })
    expect(page.page.map((comment) => comment._id)).not.toContain(commentId)
    expect(page.page.map((comment) => comment._id)).toContain(replyId)
  })

  it('rejects deletion from anyone except the comment owner without writes', async () => {
    const t = createTest()
    const ownerId = await insertUser(t, 'delete-guard-owner')
    await insertUser(t, 'delete-guard-other')
    const postId = await insertPost(t, ownerId, 'Base post')
    const commentId = await t.withIdentity({ subject: 'delete-guard-owner' }).mutation(api.social.createComment, {
      postId,
      body: 'Owner comment',
    })

    const before = await t.run(async (ctx) => ({
      comment: await ctx.db.get(commentId),
      post: await ctx.db.get(postId),
      audits: (await ctx.db.query('auditLogs').collect()).length,
    }))
    await expect(
      t.withIdentity({ subject: 'delete-guard-other' }).mutation(api.social.deleteComment, { commentId }),
    ).rejects.toThrow('Only the author can delete this comment')
    const after = await t.run(async (ctx) => ({
      comment: await ctx.db.get(commentId),
      post: await ctx.db.get(postId),
      audits: (await ctx.db.query('auditLogs').collect()).length,
    }))
    expect(after).toEqual(before)
    expect(after.comment?.hidden).toBe(false)
  })

  it('rejects deletion when the parent post is unavailable or the viewer is suspended', async () => {
    const t = createTest()
    const ownerId = await insertUser(t, 'delete-post-owner')
    await insertUser(t, 'delete-post-suspended', { suspended: true })
    const postId = await insertPost(t, ownerId, 'Base post')
    const commentId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('postComments', { postId, authorId: ownerId, body: 'Owner comment', reportable: true, hidden: false, createdAt: now, updatedAt: now })
    })

    await t.run(async (ctx) => ctx.db.patch(postId, { hidden: true }))
    await expect(
      t.withIdentity({ subject: 'delete-post-owner' }).mutation(api.social.deleteComment, { commentId }),
    ).rejects.toThrow('Post not found')
    expect((await t.run(async (ctx) => ctx.db.get(commentId)))?.hidden).toBe(false)

    await t.run(async (ctx) => ctx.db.patch(postId, { hidden: false }))
    await expect(
      t.withIdentity({ subject: 'delete-post-suspended' }).mutation(api.social.deleteComment, { commentId }),
    ).rejects.toThrow()
    expect((await t.run(async (ctx) => ctx.db.get(commentId)))?.hidden).toBe(false)
  })
})

describe('following feed recents', () => {
  it('prefers the most recently followed authors when capping the feed', async () => {
    const t = createTest()
    const viewerId = await insertUser(t, 'recent-follow-viewer')
    const authorIds: any[] = []
    for (let index = 0; index < 52; index += 1) authorIds.push(await insertUser(t, `recent-follow-${index}`))
    await t.run(async (ctx) => {
      const now = Date.now()
      for (let index = 0; index < 52; index += 1) {
        await ctx.db.insert('follows', { followerId: viewerId, followingId: authorIds[index], createdAt: now + index })
        await ctx.db.insert('posts', { authorId: authorIds[index], body: `post ${index}`, reportable: true, hidden: false, createdAt: now + index, updatedAt: now + index })
      }
    })
    const items = await t.withIdentity({ subject: 'recent-follow-viewer' }).query(api.social.feed, { filter: 'following' }) as any[]
    const bodies = items.map((item) => item.post.body)
    expect(bodies).toContain('post 51')
    expect(bodies).not.toContain('post 0')
    expect(bodies).not.toContain('post 1')
  })
})
