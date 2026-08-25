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
