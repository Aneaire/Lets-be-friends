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

async function insertUser(t: ReturnType<typeof convexTest>, subject: string) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      role: 'member',
      verificationStatus: 'not_started',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function insertPost(t: ReturnType<typeof convexTest>, authorId: any) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('posts', {
      authorId,
      body: 'A post that can receive many reactions.',
      reportable: true,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('social notification aggregation', () => {
  it('collapses many post likes into one notification with an actor count', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'author')
    await insertUser(t, 'member')
    await insertUser(t, 'outsider')
    const postId = await insertPost(t, authorId)

    await t.withIdentity({ subject: 'member' }).mutation(api.social.toggleLike, { postId })
    await t.withIdentity({ subject: 'outsider' }).mutation(api.social.toggleLike, { postId })

    const rows = await t.run(async (ctx) => (
      (await ctx.db.query('notifications').collect()).filter((row) => row.kind === 'post_liked')
    ))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ aggregateCount: 2, recipientUserId: authorId })

    const page = await t.withIdentity({ subject: 'author' }).query(api.notifications.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    })
    expect(page.page.find((row) => row.kind === 'post_liked')).toMatchObject({
      kind: 'post_liked',
      title: 'New likes',
      body: 'outsider and 1 other liked your post.',
      destination: { type: 'post', postId: String(postId) },
    })
  })

  it('collapses many followers into one notification', async () => {
    const t = createTest()
    const authorId = await insertUser(t, 'author')
    await insertUser(t, 'member')
    await insertUser(t, 'outsider')

    await t.withIdentity({ subject: 'member' }).mutation(api.social.toggleFollow, { userId: authorId })
    await t.withIdentity({ subject: 'outsider' }).mutation(api.social.toggleFollow, { userId: authorId })

    const rows = await t.run(async (ctx) => (
      (await ctx.db.query('notifications').collect()).filter((row) => row.kind === 'new_follower')
    ))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ aggregateCount: 2, recipientUserId: authorId })

    const page = await t.withIdentity({ subject: 'author' }).query(api.notifications.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    })
    expect(page.page.find((row) => row.kind === 'new_follower')).toMatchObject({
      kind: 'new_follower',
      title: 'New followers',
      body: 'outsider and 1 other followed you.',
      destination: { type: 'profile' },
    })
  })
})
