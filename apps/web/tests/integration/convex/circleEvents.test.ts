import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

type UserOptions = {
  role?: 'member' | 'companion' | 'admin' | 'owner' | 'reviewer'
  suspended?: boolean
  verified?: boolean
}

async function insertUser(t: ReturnType<typeof convexTest>, subject: string, options: UserOptions = {}) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      role: options.role ?? 'member',
      verificationStatus: options.verified ? 'approved' : 'not_started',
      verificationSource: options.verified ? 'in_app' : undefined,
      identityVerifiedAt: options.verified ? now : undefined,
      identityExpiresAt: options.verified ? now + 86_400_000 : undefined,
      suspended: options.suspended ?? false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function createCircle(t: ReturnType<typeof convexTest>, hostUserId: Id<'users'>, slug = 'coffee-friends') {
  const host = await t.run(async (ctx) => ctx.db.get(hostUserId))
  if (!host) throw new Error('Test host not found')
  return await t.withIdentity({ subject: host.clerkUserId }).mutation(api.circles.create, {
    slug,
    name: 'Coffee Friends',
    purpose: 'Talk about coffee.',
    category: 'Coffee',
    rules: ['Be kind.'],
    mode: 'both',
    approximateArea: 'Cebu',
  })
}

async function insertMembership(
  t: ReturnType<typeof convexTest>,
  circleId: Id<'circles'>,
  userId: Id<'users'>,
  state: 'requested' | 'active' | 'rejected' | 'left' | 'removed' | 'banned',
  role: 'member' | 'moderator' | 'host' = 'member',
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('circleMemberships', {
      circleId,
      userId,
      state,
      role,
      rulesAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    })
  })
}

function eventInput(startsAt = Date.now() + 86_400_000) {
  return {
    title: 'Coffee crawl',
    details: 'Meet at the plaza and walk to three cafes.',
    startsAt,
    location: 'Cebu City',
    mode: 'in_person' as const,
  }
}

describe('Circle events', () => {
  it('lets a leader plan an event that members can read', async () => {
    const t = convexTest(schema, convexModules)
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    const circleId = await createCircle(t, hostId)
    await insertMembership(t, circleId, memberId, 'active')

    const eventId = await t.withIdentity({ subject: 'host' }).mutation(api.circleEvents.create, {
      circleId,
      ...eventInput(),
    })
    expect(eventId).toBeTruthy()

    const events = await t.withIdentity({ subject: 'member' }).query(api.circleEvents.list, { circleId })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ title: 'Coffee crawl', state: 'scheduled', organizerDisplayName: 'host' })
  })

  it('denies event writes to members and reads to outsiders', async () => {
    const t = convexTest(schema, convexModules)
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    const outsiderId = await insertUser(t, 'outsider')
    void outsiderId
    const circleId = await createCircle(t, hostId)
    await insertMembership(t, circleId, memberId, 'active')

    await expect(t.withIdentity({ subject: 'member' }).mutation(api.circleEvents.create, {
      circleId,
      ...eventInput(),
    })).rejects.toThrow('Verified Circle moderator role required')
    await expect(t.withIdentity({ subject: 'outsider' }).query(api.circleEvents.list, { circleId }))
      .rejects.toThrow('Active Circle membership required')
  })

  it('rejects past dates and blank or oversized fields', async () => {
    const t = convexTest(schema, convexModules)
    const hostId = await insertUser(t, 'host', { verified: true })
    const circleId = await createCircle(t, hostId)
    const host = t.withIdentity({ subject: 'host' })

    await expect(host.mutation(api.circleEvents.create, { circleId, ...eventInput(Date.now() - 1_000) }))
      .rejects.toThrow('Event date and time must be in the future')
    await expect(host.mutation(api.circleEvents.create, { circleId, ...eventInput(), title: '  ' }))
      .rejects.toThrow('Event title and details are required')
    await expect(host.mutation(api.circleEvents.create, { circleId, ...eventInput(), title: 'a'.repeat(121) }))
      .rejects.toThrow('Event details are too long')
  })

  it('lets a moderator edit, cancel, and restore while members cannot', async () => {
    const t = convexTest(schema, convexModules)
    const hostId = await insertUser(t, 'host', { verified: true })
    const moderatorId = await insertUser(t, 'moderator', { verified: true })
    const memberId = await insertUser(t, 'member')
    const circleId = await createCircle(t, hostId)
    await insertMembership(t, circleId, moderatorId, 'active', 'moderator')
    await insertMembership(t, circleId, memberId, 'active')
    const moderator = t.withIdentity({ subject: 'moderator' })
    const member = t.withIdentity({ subject: 'member' })

    const eventId = await t.withIdentity({ subject: 'host' }).mutation(api.circleEvents.create, {
      circleId,
      ...eventInput(),
    })
    await moderator.mutation(api.circleEvents.update, { eventId, ...eventInput(Date.now() + 2 * 86_400_000), title: 'Updated crawl' })
    await expect(member.mutation(api.circleEvents.setState, { eventId, state: 'cancelled' }))
      .rejects.toThrow('Verified Circle moderator role required')

    await moderator.mutation(api.circleEvents.setState, { eventId, state: 'cancelled' })
    const listed = await member.query(api.circleEvents.list, { circleId })
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({ title: 'Updated crawl', state: 'cancelled' })

    await moderator.mutation(api.circleEvents.setState, { eventId, state: 'scheduled' })
    expect(await member.query(api.circleEvents.list, { circleId })).toMatchObject([{ state: 'scheduled' }])
  })

  it('shows upcoming events to outsiders only on public Circles', async () => {
    const t = convexTest(schema, convexModules)
    const hostId = await insertUser(t, 'host', { verified: true })
    await insertUser(t, 'outsider')
    const circleId = await createCircle(t, hostId)
    const host = t.withIdentity({ subject: 'host' })
    const outsider = t.withIdentity({ subject: 'outsider' })

    await host.mutation(api.circleEvents.create, { circleId, ...eventInput() })
    await expect(outsider.query(api.circleEvents.list, { circleId }))
      .rejects.toThrow('Active Circle membership required')

    await host.mutation(api.circles.updateSettings, {
      circleId,
      discoverability: 'listed',
      discussionVisibility: 'signed_in',
      memberListVisibility: 'signed_in',
      joinPolicy: 'approval_required',
    })
    const events = await outsider.query(api.circleEvents.list, { circleId })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ title: 'Coffee crawl' })
  })

  it('hides past events from the upcoming list', async () => {
    const t = convexTest(schema, convexModules)
    const hostId = await insertUser(t, 'host', { verified: true })
    const circleId = await createCircle(t, hostId)
    const host = t.withIdentity({ subject: 'host' })

    const eventId = await host.mutation(api.circleEvents.create, { circleId, ...eventInput() })
    await t.run(async (ctx) => ctx.db.patch(eventId, { startsAt: Date.now() - 86_400_000 }))
    expect(await host.query(api.circleEvents.list, { circleId })).toHaveLength(0)
  })

  it('rejects non-image event thumbnails', async () => {
    const t = convexTest(schema, convexModules)
    const hostId = await insertUser(t, 'host', { verified: true })
    const circleId = await createCircle(t, hostId)
    const host = t.withIdentity({ subject: 'host' })

    const badType = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(['bytes'], { type: 'video/mp4' }))
      await (ctx.db as any).patch(storageId, { contentType: 'video/mp4' })
      return storageId
    })
    await expect(host.mutation(api.circleEvents.create, { circleId, ...eventInput(), thumbnailStorageId: badType }))
      .rejects.toThrow('Event thumbnails must be JPEG, PNG, or WebP still images')

    const thumbnail = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(['bytes'], { type: 'image/png' }))
      await (ctx.db as any).patch(storageId, { contentType: 'image/png' })
      return storageId
    })
    const eventId = await host.mutation(api.circleEvents.create, { circleId, ...eventInput(), thumbnailStorageId: thumbnail })
    const events = await host.query(api.circleEvents.list, { circleId })
    expect(events.find((event) => String(event._id) === String(eventId))?.thumbnailUrl).toBeTruthy()
  })
})

describe('Circle pinned posts sidebar', () => {
  it('shows pinned posts to members and skips removed posts', async () => {
    const t = convexTest(schema, convexModules)
    const hostId = await insertUser(t, 'host', { verified: true })
    const memberId = await insertUser(t, 'member')
    const circleId = await createCircle(t, hostId)
    await insertMembership(t, circleId, memberId, 'active')

    const postId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('posts', {
        authorId: memberId,
        circleId,
        circleKind: 'discussion',
        body: 'A pinned welcome.',
        reportable: true,
        hidden: false,
        createdAt: now,
        updatedAt: now,
      })
    })
    await t.withIdentity({ subject: 'host' }).mutation(api.circles.pinPost, { circleId, postId })

    const pins = await t.withIdentity({ subject: 'member' }).query(api.circles.pinnedPosts, { circleId })
    expect(pins).toHaveLength(1)
    expect(pins[0]).toMatchObject({ body: 'A pinned welcome.', authorDisplayName: 'member' })

    await t.withIdentity({ subject: 'host' }).mutation(api.circles.setPostRemoved, { postId, removed: true })
    expect(await t.withIdentity({ subject: 'member' }).query(api.circles.pinnedPosts, { circleId })).toHaveLength(0)
  })

  it('keeps pinned posts out of reach for outsiders', async () => {
    const t = convexTest(schema, convexModules)
    const hostId = await insertUser(t, 'host', { verified: true })
    await insertUser(t, 'outsider')
    const circleId = await createCircle(t, hostId)

    await expect(t.withIdentity({ subject: 'outsider' }).query(api.circles.pinnedPosts, { circleId }))
      .rejects.toThrow('Active Circle membership required')
  })
})
