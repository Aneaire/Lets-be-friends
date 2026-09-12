import geospatialTest from '@convex-dev/geospatial/test'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const SUBTOTAL = 50_000
const TOTAL = 57_500
let previousFlag: string | undefined

function createTest() {
  const t = convexTest(schema, convexModules)
  geospatialTest.register(t)
  return t
}

beforeEach(() => {
  previousFlag = process.env.MEMBER_WALLET_V2_ENABLED
  process.env.MEMBER_WALLET_V2_ENABLED = 'true'
})

afterEach(() => {
  if (previousFlag === undefined) delete process.env.MEMBER_WALLET_V2_ENABLED
  else process.env.MEMBER_WALLET_V2_ENABLED = previousFlag
})

type SeedOptions = { verified?: boolean; availableCentavos?: number }

async function seedUser(t: ReturnType<typeof convexTest>, subject: string, role: 'member' | 'companion' | 'reviewer' = 'member', options: SeedOptions = {}) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const verified = options.verified ?? true
    return await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      role,
      verificationStatus: verified ? 'approved' : 'not_started',
      verificationSource: verified ? 'persona' : undefined,
      identityVerifiedAt: verified ? now : undefined,
      identityExpiresAt: verified ? now + 86_400_000 : undefined,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const identity = {
      verificationStatus: 'approved' as const,
      verificationSource: 'persona' as const,
      identityVerifiedAt: now,
      identityExpiresAt: now + 86_400_000,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    }
    const hostId = await ctx.db.insert('users', { clerkUserId: 'host', displayName: 'Host', role: 'member', ...identity })
    const companionUserId = await ctx.db.insert('users', { clerkUserId: 'companion', displayName: 'Companion', role: 'companion', ...identity })
    const guestId = await ctx.db.insert('users', { clerkUserId: 'guest', displayName: 'Guest', role: 'member', ...identity })
    const secondGuestId = await ctx.db.insert('users', { clerkUserId: 'guest-two', displayName: 'Guest Two', role: 'member', ...identity })
    const unverifiedGuestId = await ctx.db.insert('users', {
      clerkUserId: 'guest-unverified', displayName: 'Unverified Guest', role: 'member',
      verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now,
    })
    const outsiderId = await ctx.db.insert('users', { clerkUserId: 'outsider', displayName: 'Outsider', role: 'member', ...identity })
    const reviewerId = await ctx.db.insert('users', { clerkUserId: 'reviewer', displayName: 'Reviewer', role: 'reviewer', ...identity })
    const companionProfileId = await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Companion',
      intro: 'A verified Companion for Gathering tests.',
      city: 'Test City',
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: SUBTOTAL,
      status: 'approved',
      rating: 5,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('walletAccounts', {
      deterministicKey: `member:${hostId}:booking`,
      accountType: 'member_booking',
      ownerUserId: hostId,
      currency: 'PHP',
      availableCentavos: 200_000,
      reservedCentavos: 0,
      pendingCentavos: 0,
      createdAt: now,
      updatedAt: now,
    })
    return { hostId, companionUserId, guestId, secondGuestId, unverifiedGuestId, outsiderId, reviewerId, companionProfileId }
  })
}

async function createGathering(t: ReturnType<typeof convexTest>, companionProfileId: Id<'companionProfiles'>, capacity = 4) {
  return await t.withIdentity({ subject: 'host' }).mutation(api.gatherings.create, {
    companionProfileId,
    category: 'Coffee or meal companion',
    mode: 'in_person',
    startsAt: Date.now() + 86_400_000,
    durationMinutes: 60,
    capacity,
  })
}

async function createWithInvite(t: ReturnType<typeof convexTest>, companionProfileId: Id<'companionProfiles'>, capacity = 4) {
  const created = await createGathering(t, companionProfileId, capacity)
  await t.withIdentity({ subject: 'host' }).mutation(api.gatherings.postInvite, {
    gatheringId: created.gatheringId,
    body: 'Coffee Gathering, come join.',
  })
  return created
}

describe('Gathering creation and booking link', () => {
  it('creates a host-funded group booking and an open Gathering', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createGathering(t, ids.companionProfileId)

    expect(created.memberTotalCentavos).toBe(TOTAL)
    const state = await t.run(async (ctx) => ({
      gathering: await ctx.db.get(created.gatheringId),
      booking: await ctx.db.get(created.bookingId),
    }))
    expect(state.gathering).toMatchObject({ hostUserId: ids.hostId, state: 'open', capacity: 4, guestListVisibility: 'confirmed_only' })
    expect(state.booking).toMatchObject({ memberId: ids.hostId, kind: 'group', status: 'request_sent', memberTotalCentavos: TOTAL })
  })

  it('rejects an unverified host and a non-participant role', async () => {
    const t = createTest()
    const ids = await seed(t)
    await seedUser(t, 'unverified-host', 'member', { verified: false })
    await expect(t.withIdentity({ subject: 'unverified-host' }).mutation(api.gatherings.create, {
      companionProfileId: ids.companionProfileId,
      category: 'Coffee or meal companion',
      mode: 'in_person',
      startsAt: Date.now() + 86_400_000,
      durationMinutes: 60,
      capacity: 4,
    })).rejects.toThrow('current identity check')
    await expect(t.withIdentity({ subject: 'reviewer' }).mutation(api.gatherings.create, {
      companionProfileId: ids.companionProfileId,
      category: 'Coffee or meal companion',
      mode: 'in_person',
      startsAt: Date.now() + 86_400_000,
      durationMinutes: 60,
      capacity: 4,
    })).rejects.toThrow('eligible account role')
  })
})

describe('Invite posts', () => {
  it('creates a profile Invite post and lets a guest discover the Gathering', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createGathering(t, ids.companionProfileId)
    const postId = await t.withIdentity({ subject: 'host' }).mutation(api.gatherings.postInvite, {
      gatheringId: created.gatheringId,
      body: 'Come to my coffee Gathering.',
    })
    const post = await t.run(async (ctx) => await ctx.db.get(postId))
    expect(post).toMatchObject({ authorId: ids.hostId, gatheringId: created.gatheringId })
    expect(post?.circleId).toBeUndefined()

    await expect(t.withIdentity({ subject: 'guest' }).query(api.gatherings.get, { gatheringId: created.gatheringId }))
      .resolves.toMatchObject({ _id: created.gatheringId, state: 'open' })
  })

  it('hides a Gathering without an Invite from unrelated members', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createGathering(t, ids.companionProfileId)
    await expect(t.withIdentity({ subject: 'outsider' }).query(api.gatherings.get, { gatheringId: created.gatheringId }))
      .rejects.toThrow('Gathering not found')
  })

  it('posts an Invite into a Circle and delivers a working deep link to members', async () => {
    const t = createTest()
    const ids = await seed(t)
    const circleId = await t.withIdentity({ subject: 'host' }).mutation(api.circles.create, {
      slug: 'coffee-friends',
      name: 'Coffee Friends',
      purpose: 'Talk about coffee.',
      category: 'Coffee',
      rules: ['Be kind.'],
      mode: 'both',
      approximateArea: 'Cebu',
    })
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('circleMemberships', {
        circleId, userId: ids.guestId, state: 'active', role: 'member', rulesAcceptedAt: now, createdAt: now, updatedAt: now,
      })
    })
    const created = await createGathering(t, ids.companionProfileId)
    const postId = await t.withIdentity({ subject: 'host' }).mutation(api.gatherings.postInvite, {
      gatheringId: created.gatheringId,
      body: 'Coffee in Cebu, join us.',
      circleId,
    })
    const post = await t.run(async (ctx) => await ctx.db.get(postId))
    expect(post?.circleId).toBe(circleId)

    const notificationId = await t.run(async (ctx) => {
      const rows = await ctx.db.query('notifications').collect()
      return rows.find((row) => row.kind === 'gathering_invite' && row.recipientUserId === ids.guestId)?._id
    })
    expect(notificationId).toBeTruthy()

    const opened = await t.withIdentity({ subject: 'guest' }).mutation(api.notifications.open, { notificationId: String(notificationId) })
    expect(opened).toMatchObject({ status: 'ready', destination: { type: 'gathering', gatheringId: created.gatheringId } })
  })
})

describe('Participant lifecycle', () => {
  it('lets a guest request and the host confirm with capacity and identity enforcement', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createWithInvite(t, ids.companionProfileId, 2)

    await expect(t.withIdentity({ subject: 'guest' }).mutation(api.gatherings.requestJoin, { gatheringId: created.gatheringId }))
      .resolves.toEqual({ status: 'requested' })
    await expect(t.withIdentity({ subject: 'guest-unverified' }).mutation(api.gatherings.requestJoin, { gatheringId: created.gatheringId }))
      .resolves.toEqual({ status: 'requested' })

    await expect(t.withIdentity({ subject: 'host' }).mutation(api.gatherings.decideParticipant, {
      gatheringId: created.gatheringId, userId: ids.guestId, decision: 'confirmed',
    })).resolves.toEqual({ status: 'confirmed', idempotent: false })

    await expect(t.withIdentity({ subject: 'host' }).mutation(api.gatherings.decideParticipant, {
      gatheringId: created.gatheringId, userId: ids.unverifiedGuestId, decision: 'confirmed',
    })).rejects.toThrow('current identity approval')

    await t.withIdentity({ subject: 'guest-two' }).mutation(api.gatherings.requestJoin, { gatheringId: created.gatheringId })
    await t.withIdentity({ subject: 'host' }).mutation(api.gatherings.decideParticipant, {
      gatheringId: created.gatheringId, userId: ids.secondGuestId, decision: 'confirmed',
    })

    const third = await seedUser(t, 'guest-three')
    await t.withIdentity({ subject: 'guest-three' }).mutation(api.gatherings.requestJoin, { gatheringId: created.gatheringId })
    await expect(t.withIdentity({ subject: 'host' }).mutation(api.gatherings.decideParticipant, {
      gatheringId: created.gatheringId, userId: third, decision: 'confirmed',
    })).rejects.toThrow('already full')
  })

  it('blocks a member when either side has blocked the other', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createWithInvite(t, ids.companionProfileId)
    await t.withIdentity({ subject: 'host' }).mutation(api.safety.setBlocked, { userId: ids.guestId, blocked: true })
    await expect(t.withIdentity({ subject: 'guest' }).mutation(api.gatherings.requestJoin, { gatheringId: created.gatheringId }))
      .rejects.toThrow('blocked')
  })

  it('removes a participant and lets a participant leave', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createWithInvite(t, ids.companionProfileId)
    await t.withIdentity({ subject: 'guest' }).mutation(api.gatherings.requestJoin, { gatheringId: created.gatheringId })
    await t.withIdentity({ subject: 'host' }).mutation(api.gatherings.decideParticipant, {
      gatheringId: created.gatheringId, userId: ids.guestId, decision: 'confirmed',
    })
    await t.withIdentity({ subject: 'host' }).mutation(api.gatherings.decideParticipant, {
      gatheringId: created.gatheringId, userId: ids.guestId, decision: 'removed',
    })
    await t.withIdentity({ subject: 'guest' }).mutation(api.gatherings.requestJoin, { gatheringId: created.gatheringId })
    await expect(t.withIdentity({ subject: 'guest' }).mutation(api.gatherings.leave, { gatheringId: created.gatheringId }))
      .resolves.toEqual({ status: 'left' })
  })
})

describe('Guest list visibility', () => {
  it('shows the confirmed guest list to the host and confirmed guests only', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createWithInvite(t, ids.companionProfileId)
    await t.withIdentity({ subject: 'guest' }).mutation(api.gatherings.requestJoin, { gatheringId: created.gatheringId })
    await t.withIdentity({ subject: 'host' }).mutation(api.gatherings.decideParticipant, {
      gatheringId: created.gatheringId, userId: ids.guestId, decision: 'confirmed',
    })
    await seedUser(t, 'reader')

    const hostView = await t.withIdentity({ subject: 'host' }).query(api.gatherings.get, { gatheringId: created.gatheringId })
    expect(hostView.participants.map((row) => row.userId)).toContain(ids.guestId)

    const guestView = await t.withIdentity({ subject: 'guest' }).query(api.gatherings.get, { gatheringId: created.gatheringId })
    expect(guestView.participants.map((row) => row.userId)).toEqual([ids.guestId])

    const readerView = await t.withIdentity({ subject: 'reader' }).query(api.gatherings.get, { gatheringId: created.gatheringId })
    expect(readerView.participants).toEqual([])
  })
})

describe('Cancellation and reporting', () => {
  it('cancels the Gathering and the linked booking, notifying participants', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createWithInvite(t, ids.companionProfileId)
    await t.withIdentity({ subject: 'guest' }).mutation(api.gatherings.requestJoin, { gatheringId: created.gatheringId })

    await expect(t.withIdentity({ subject: 'host' }).mutation(api.gatherings.cancel, {
      gatheringId: created.gatheringId, reason: 'Rain',
    })).resolves.toEqual({ status: 'cancelled', idempotent: false })

    const state = await t.run(async (ctx) => ({
      gathering: await ctx.db.get(created.gatheringId),
      booking: await ctx.db.get(created.bookingId),
      notifications: await ctx.db.query('notifications').collect(),
    }))
    expect(state.gathering).toMatchObject({ state: 'cancelled', cancellationReason: 'Rain' })
    expect(state.booking?.status).toBe('cancelled')
    expect(state.notifications.some((row) => row.kind === 'gathering_cancelled' && row.recipientUserId === ids.guestId)).toBe(true)
  })

  it('allows a participant to report a Gathering', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createWithInvite(t, ids.companionProfileId)
    await t.withIdentity({ subject: 'guest' }).mutation(api.gatherings.requestJoin, { gatheringId: created.gatheringId })

    await expect(t.withIdentity({ subject: 'guest' }).mutation(api.reports.create, {
      targetType: 'gathering',
      targetId: String(created.gatheringId),
      reason: 'Feels unsafe',
    })).resolves.toBeTruthy()
    await expect(t.withIdentity({ subject: 'outsider' }).mutation(api.reports.create, {
      targetType: 'gathering',
      targetId: String(created.gatheringId),
      reason: 'Not involved',
    })).rejects.toThrow('Only a Gathering participant')
  })
})
