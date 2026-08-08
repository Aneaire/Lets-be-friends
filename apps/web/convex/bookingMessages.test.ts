import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
const SUBTOTAL = 50_000
const TOTAL = 57_500
let previousFlag: string | undefined

function createTest() {
  const t = convexTest(schema, modules)
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
    const memberId = await ctx.db.insert('users', {
      clerkUserId: 'req-member', displayName: 'Request Member', role: 'member', ...identity,
    })
    const hostUserId = await ctx.db.insert('users', {
      clerkUserId: 'req-host', displayName: 'Request Host', role: 'friend_host', ...identity,
    })
    const outsiderId = await ctx.db.insert('users', {
      clerkUserId: 'req-outsider', displayName: 'Request Outsider', role: 'member', ...identity,
    })
    const hostProfileId = await ctx.db.insert('hostProfiles', {
      userId: hostUserId,
      displayName: 'Request Host',
      intro: 'A verified host for booking-message tests.',
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
      deterministicKey: `member:${memberId}:booking`,
      accountType: 'member_booking',
      ownerUserId: memberId,
      currency: 'PHP',
      availableCentavos: TOTAL,
      reservedCentavos: 0,
      pendingCentavos: 0,
      createdAt: now,
      updatedAt: now,
    })
    return { now, memberId, hostUserId, outsiderId, hostProfileId }
  })
}

async function createRequest(t: ReturnType<typeof convexTest>, hostProfileId: any) {
  return await t.withIdentity({ subject: 'req-member' }).mutation(api.bookings.createDraft, {
    hostProfileId,
    category: 'Coffee or meal companion',
    mode: 'in_person',
    requestedAt: Date.now() + 86_400_000,
    durationMinutes: 60,
    notes: 'Catch-up over coffee.',
  })
}

async function requestThread(t: ReturnType<typeof convexTest>) {
  const inbox = await t.withIdentity({ subject: 'req-host' }).query(api.conversations.list, {})
  expect(inbox).toHaveLength(1)
  return await t.withIdentity({ subject: 'req-host' }).query(api.conversations.messages, { conversationId: inbox[0]._id })
}

describe('booking requests framed in direct messages', () => {
  it('auto-sends one booking message that the Friend Host sees as a pending request card', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createRequest(t, ids.hostProfileId)

    const thread = await requestThread(t)
    const requestMessages = thread.messages.filter((message) => message.booking)
    expect(requestMessages).toHaveLength(1)
    const message = requestMessages[0]
    expect(message.booking).toMatchObject({
      bookingId: created.bookingId,
      status: 'request_sent',
      category: 'Coffee or meal companion',
      mode: 'in_person',
      memberId: ids.memberId,
      memberDisplayName: 'Request Member',
      hostDisplayName: 'Request Host',
      memberTotalCentavos: TOTAL,
    })
    expect(message.body).toContain('sent you a booking request')
    expect(message.attachments).toHaveLength(0)

    const freshThread = await t.withIdentity({ subject: 'req-member' }).query(api.conversations.messages, { conversationId: thread.conversation._id })
    const memberRequestMessages = freshThread.messages.filter((message) => message.booking)
    expect(memberRequestMessages).toHaveLength(1)
  })

  it('lets the requester edit a pending request and appends one update message, then locks editing after decision', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createRequest(t, ids.hostProfileId)

    const updated = await t.withIdentity({ subject: 'req-member' }).mutation(api.bookings.editRequest, {
      bookingId: created.bookingId,
      category: 'Coffee or meal companion',
      mode: 'online',
      requestedAt: Date.now() + 2 * 86_400_000,
      durationMinutes: 60,
      notes: 'Moving the catch-up online.',
    })
    expect(updated).toMatchObject({ bookingId: created.bookingId, memberTotalCentavos: TOTAL })

    const state = await t.run(async (ctx) => ctx.db.get(created.bookingId))
    expect(state).toMatchObject({
      category: 'Coffee or meal companion',
      mode: 'online',
      durationMinutes: 60,
      notes: 'Moving the catch-up online.',
    })

    const thread = await requestThread(t)
    const bookedMessages = thread.messages.filter((message) => message.booking)
    expect(bookedMessages).toHaveLength(2)
    expect(bookedMessages[1].body).toContain('updated this request')

    await expect(t.withIdentity({ subject: 'req-outsider' }).mutation(api.bookings.editRequest, {
      bookingId: created.bookingId,
      category: 'Coffee or meal companion',
      mode: 'online',
      requestedAt: Date.now() + 86_400_000,
      durationMinutes: 60,
    })).rejects.toThrow('Only the member who requested the booking can edit it')

    await t.withIdentity({ subject: 'req-host' }).mutation(api.bookings.hostDecision, {
      bookingId: created.bookingId,
      decision: 'accepted',
      note: 'Happy to move it online.',
    })

    await expect(
      t.withIdentity({ subject: 'req-member' }).mutation(api.bookings.editRequest, {
        bookingId: created.bookingId,
        category: 'Coffee or meal companion',
        mode: 'online',
        requestedAt: Date.now() + 3 * 86_400_000,
        durationMinutes: 60,
      }),
    ).rejects.toThrow('awaiting the Friend Host decision')
  })

  it('streams accept and decline decisions into the thread and blocks editing for the host', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createRequest(t, ids.hostProfileId)

    await expect(
      t.withIdentity({ subject: 'req-member' }).mutation(api.bookings.hostDecision, {
        bookingId: created.bookingId,
        decision: 'accepted',
      }),
    ).rejects.toThrow('Only the booked Friend Host can decide')

    await t.withIdentity({ subject: 'req-host' }).mutation(api.bookings.hostDecision, {
      bookingId: created.bookingId,
      decision: 'declined',
      note: 'No overlapping availability today.',
    })

    const thread = await requestThread(t)
    const bookingMessages = thread.messages.filter((message) => message.booking)
    expect(bookingMessages).toHaveLength(2)
    expect(bookingMessages[1].body).toContain('declined this booking request')
    expect(bookingMessages[1].booking?.status).toBe('declined')

    await expect(
      t.withIdentity({ subject: 'req-host' }).mutation(api.bookings.editRequest, {
        bookingId: created.bookingId,
        category: 'Coffee or meal companion',
        mode: 'in_person',
        requestedAt: Date.now() + 86_400_000,
        durationMinutes: 60,
      }),
    ).rejects.toThrow('Only the member who requested the booking can edit it')
  })

  it('logs a cancel into the thread and keeps the conversation available to both sides', async () => {
    const t = createTest()
    const ids = await seed(t)
    const created = await createRequest(t, ids.hostProfileId)

    await t.withIdentity({ subject: 'req-member' }).mutation(api.bookings.cancel, {
      bookingId: created.bookingId,
      reason: 'Plans changed.',
    })

    const thread = await requestThread(t)
    const bookingMessages = thread.messages.filter((message) => message.booking)
    expect(bookingMessages).toHaveLength(2)
    expect(bookingMessages[1].booking?.status).toBe('cancelled')
  })
})