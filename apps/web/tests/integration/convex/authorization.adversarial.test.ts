import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
const SUBTOTAL = 50_000
let previousWalletFlag: string | undefined
let previousWithdrawalsFlag: string | undefined
let previousMode: string | undefined

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

beforeEach(() => {
  previousWalletFlag = process.env.MEMBER_WALLET_V2_ENABLED
  previousWithdrawalsFlag = process.env.COMPANION_WITHDRAWALS_ENABLED
  previousMode = process.env.PAYMONGO_MODE
  process.env.MEMBER_WALLET_V2_ENABLED = 'true'
  process.env.COMPANION_WITHDRAWALS_ENABLED = 'true'
  process.env.PAYMONGO_MODE = 'test'
})

afterEach(() => {
  if (previousWalletFlag === undefined) delete process.env.MEMBER_WALLET_V2_ENABLED
  else process.env.MEMBER_WALLET_V2_ENABLED = previousWalletFlag
  if (previousWithdrawalsFlag === undefined) delete process.env.COMPANION_WITHDRAWALS_ENABLED
  else process.env.COMPANION_WITHDRAWALS_ENABLED = previousWithdrawalsFlag
  if (previousMode === undefined) delete process.env.PAYMONGO_MODE
  else process.env.PAYMONGO_MODE = previousMode
})

async function insertUser(
  t: ReturnType<typeof convexTest>,
  clerkUserId: string,
  role: 'member' | 'companion' | 'reviewer' | 'admin' = 'member',
  options: { suspended?: boolean } = {},
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId,
      displayName: clerkUserId,
      role,
      verificationStatus: 'not_started',
      suspended: options.suspended ?? false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function seedConversation(t: ReturnType<typeof convexTest>) {
  const alexId = await insertUser(t, 'adv-alex')
  const samId = await insertUser(t, 'adv-sam')
  const outsiderId = await insertUser(t, 'adv-outsider')
  const conversationId = await t.withIdentity({ subject: 'adv-alex' }).mutation(api.conversations.start, { otherUserId: samId })
  return { alexId, samId, outsiderId, conversationId }
}

describe('cross-user authorization boundaries', () => {
  it('rejects a message to a conversation the sender is not part of', async () => {
    const t = createTest()
    const { conversationId } = await seedConversation(t)

    await expect(
      t.withIdentity({ subject: 'adv-outsider' }).mutation(api.conversations.sendMessage, {
        conversationId,
        body: 'I should not be able to send this',
      }),
    ).rejects.toThrow('Not your conversation')

    const stored = await t.run(async (ctx) => ctx.db.query('directMessages').collect())
    expect(stored).toEqual([])
  })

  it('rejects an outsider reading another pair of members direct messages', async () => {
    const t = createTest()
    const { conversationId } = await seedConversation(t)
    await t.withIdentity({ subject: 'adv-alex' }).mutation(api.conversations.sendMessage, { conversationId, body: 'Private plan' })

    const outsider = t.withIdentity({ subject: 'adv-outsider' })
    await expect(outsider.query(api.conversations.messages, { conversationId })).rejects.toThrow('Not your conversation')
    await expect(outsider.query(api.conversations.conversation, { conversationId })).rejects.toThrow('Not your conversation')
    await expect(outsider.query(api.conversations.messagePage, {
      conversationId,
      paginationOpts: { cursor: null, numItems: 10 },
    })).rejects.toThrow('Not your conversation')
  })

  it('rejects an outsider sending on or reading another member booking thread', async () => {
    const t = createTest()
    const now = Date.now()
    const ids = await t.run(async (ctx) => {
      const memberId = await ctx.db.insert('users', {
        clerkUserId: 'adv-bm-member', displayName: 'Booking Member', role: 'member',
        verificationStatus: 'approved', verificationSource: 'persona', identityVerifiedAt: now, identityExpiresAt: now + 86_400_000,
        suspended: false, createdAt: now, updatedAt: now,
      })
      const companionUserId = await ctx.db.insert('users', {
        clerkUserId: 'adv-bm-companion', displayName: 'Booking Companion', role: 'companion',
        verificationStatus: 'approved', verificationSource: 'persona', identityVerifiedAt: now, identityExpiresAt: now + 86_400_000,
        suspended: false, createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('users', {
        clerkUserId: 'adv-bm-outsider', displayName: 'Booking Outsider', role: 'member',
        verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now,
      })
      const companionProfileId = await ctx.db.insert('companionProfiles', {
        userId: companionUserId, displayName: 'Booking Companion', intro: 'A verified companion for booking authorization tests.',
        city: 'Test City', strengths: ['Good listener'], categories: ['Coffee or meal companion'], boundaries: ['Public places only'],
        mode: 'both', hourlyRateCentavos: SUBTOTAL, status: 'approved', rating: 5, reviewCount: 0, createdAt: now, updatedAt: now,
      })
      const bookingId = await ctx.db.insert('bookings', {
        memberId, companionProfileId, category: 'Coffee or meal companion', mode: 'in_person',
        requestedAt: now + 86_400_000, durationMinutes: 60, status: 'accepted', createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('messages', { bookingId, senderId: memberId, body: 'Private booking note', reportable: true, createdAt: now })
      return { memberId, companionUserId, companionProfileId, bookingId }
    })

    const outsider = t.withIdentity({ subject: 'adv-bm-outsider' })
    await expect(outsider.query(api.bookings.messages, { bookingId: ids.bookingId })).rejects.toThrow('Not your booking')
    await expect(outsider.mutation(api.bookings.sendMessage, { bookingId: ids.bookingId, body: 'Intruder message' }))
      .rejects.toThrow('Not your booking')

    const stored = await t.run(async (ctx) => ctx.db.query('messages').withIndex('by_booking', (q) => q.eq('bookingId', ids.bookingId)).collect())
    expect(stored.map((message) => message.body)).toEqual(['Private booking note'])
  })

  it('rejects non-admin callers on every admin query and mutation', async () => {
    const t = createTest()
    await insertUser(t, 'adv-member')
    await insertUser(t, 'adv-reviewer', 'reviewer')
    const targetUserId = await insertUser(t, 'adv-target')
    const now = Date.now()
    const { verificationRequestId, postId, reviewId } = await t.run(async (ctx) => {
      const verificationRequestId = await ctx.db.insert('verificationRequests', {
        userId: targetUserId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown',
        verificationSource: 'persona', adminStatus: 'pending', isCurrent: true, attempt: 1, createdAt: now, updatedAt: now,
      })
      const companionProfileId = await ctx.db.insert('companionProfiles', {
        userId: targetUserId, displayName: 'Adversarial Target', intro: 'A profile used to seed an adversarial target booking.',
        city: 'Test City', strengths: ['Good listener'], categories: ['Coffee or meal companion'], boundaries: ['Public places only'],
        mode: 'both', status: 'approved', rating: 5, reviewCount: 0, createdAt: now, updatedAt: now,
      })
      const bookingId = await ctx.db.insert('bookings', {
        memberId: targetUserId, companionProfileId, category: 'Coffee or meal companion', mode: 'in_person',
        requestedAt: now, durationMinutes: 60, status: 'completed', createdAt: now, updatedAt: now,
      })
      const postId = await ctx.db.insert('posts', {
        authorId: targetUserId, body: 'Adversarial probe post', media: [], reportable: true, hidden: false, createdAt: now, updatedAt: now,
      })
      const reviewId = await ctx.db.insert('reviews', {
        bookingId, reviewerId: targetUserId, revieweeId: targetUserId, rating: 5, body: 'Adversarial probe review', hidden: false, createdAt: now, updatedAt: now,
      })
      return { verificationRequestId, postId, reviewId }
    })
    const verifier = t.withIdentity({ subject: 'adv-member' })

    await expect(verifier.query(api.admin.overview, {})).rejects.toThrow('Admin role required')
    await expect(verifier.query(api.admin.queues, {})).rejects.toThrow('Admin role required')
    await expect(verifier.query(api.admin.companionApplications, {})).rejects.toThrow('Admin role required')
    await expect(verifier.query(api.admin.memberVerifications, {})).rejects.toThrow('Admin role required')
    await expect(verifier.query(api.admin.reports, {})).rejects.toThrow('Admin role required')
    await expect(verifier.query(api.admin.posts, {})).rejects.toThrow('Admin role required')
    await expect(verifier.query(api.admin.reviews, {})).rejects.toThrow('Admin role required')

    await expect(verifier.mutation(api.admin.setUserSuspended, { userId: targetUserId, suspended: true, note: 'Adversarial probe' }))
      .rejects.toThrow('Admin role required')
    await expect(verifier.mutation(api.admin.reviewMemberVerification, { verificationRequestId, decision: 'rejected', note: 'Adversarial probe' }))
      .rejects.toThrow('Admin role required')
    await expect(verifier.mutation(api.admin.setReviewerStatus, { userId: targetUserId, reviewer: true }))
      .rejects.toThrow('Admin role required')
    await expect(verifier.mutation(api.admin.setAdminStatus, { userId: targetUserId, admin: true }))
      .rejects.toThrow('Admin role required')
    await expect(verifier.mutation(api.admin.setPostHidden, { postId, hidden: true, note: 'Adversarial probe' }))
      .rejects.toThrow('Admin role required')
    await expect(verifier.mutation(api.admin.setReviewHidden, { reviewId, hidden: true, note: 'Adversarial probe' }))
      .rejects.toThrow('Admin role required')

    const reviewer = t.withIdentity({ subject: 'adv-reviewer' })
    await expect(reviewer.query(api.admin.users, {})).rejects.toThrow('Full admin role required')
    await expect(reviewer.query(api.admin.auditLogs, {})).rejects.toThrow('Full admin role required')

    const stillActive = await t.run(async (ctx) => ctx.db.get(targetUserId))
    expect(stillActive?.suspended).toBe(false)
    expect(stillActive?.role).toBe('member')
  })

  it('rejects a member self-suspending through the admin surface', async () => {
    const t = createTest()
    const targetUserId = await insertUser(t, 'adv-escalation-target')

    await expect(
      t.withIdentity({ subject: 'adv-escalation-target' }).mutation(api.admin.setUserSuspended, {
        userId: targetUserId,
        suspended: true,
        note: 'Self probe',
      }),
    ).rejects.toThrow('Admin role required')

    const target = await t.run(async (ctx) => ctx.db.get(targetUserId))
    expect(target?.suspended).toBe(false)
  })

  it('rejects refreshing a member top-up the caller does not own before any provider call', async () => {
    const t = createTest()
    const now = Date.now()
    const ownerId = await insertUser(t, 'adv-topup-owner')
    await insertUser(t, 'adv-topup-outsider')
    const topUpId = await t.run(async (ctx) => ctx.db.insert('paymongoTopUps', {
      beneficiaryUserId: ownerId,
      purpose: 'member_booking_balance',
      amountCentavos: 20_000,
      currency: 'PHP',
      mode: 'test',
      status: 'processing',
      providerIntentId: 'pi_adv_owned_by_other',
      createdAt: now,
      updatedAt: now,
    }))

    await expect(
      t.withIdentity({ subject: 'adv-topup-outsider' }).action(api.paymongo.refreshMemberTopUp, { topUpId }),
    ).rejects.toThrow('not found')
  })

  it('rejects withdrawing funds that belong to another Companion', async () => {
    const t = createTest()
    const now = Date.now()
    const { companionUserId, accountId } = await t.run(async (ctx) => {
      const companionUserId = await ctx.db.insert('users', {
        clerkUserId: 'adv-wd-companion', displayName: 'Withdrawal Companion', firstName: 'Withdrawal', lastName: 'Companion',
        role: 'companion', verificationStatus: 'approved', verificationSource: 'in_app',
        identityVerifiedAt: now, identityExpiresAt: now + 86_400_000, suspended: false, createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('users', {
        clerkUserId: 'adv-wd-outsider', displayName: 'Withdrawal Outsider', role: 'member',
        verificationStatus: 'approved', verificationSource: 'in_app',
        identityVerifiedAt: now, identityExpiresAt: now + 86_400_000, suspended: false, createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('companionProfiles', {
        userId: companionUserId, displayName: 'Withdrawal Companion', intro: 'A verified Companion for withdrawal authorization tests.',
        city: 'Makati', strengths: ['Good listener'], categories: ['Coffee and meals'], boundaries: ['Public places only'],
        mode: 'both', hourlyRateCentavos: 50_000, status: 'approved', rating: 5, reviewCount: 1, createdAt: now, updatedAt: now,
      })
      const accountId = await ctx.db.insert('walletAccounts', {
        deterministicKey: `member:${companionUserId}:booking`, accountType: 'member_booking', ownerUserId: companionUserId,
        currency: 'PHP', availableCentavos: 120_000, reservedCentavos: 0, pendingCentavos: 0, createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('payoutMethods', {
        companionUserId, provider: 'instapay', institutionBic: 'BNORPHMM', institutionName: 'BDO Unibank',
        accountName: 'Withdrawal Companion', accountNumberCiphertext: 'encrypted-account-number', accountNumberIv: 'encrypted-iv',
        accountNumberLast4: '4321', status: 'active', mode: 'test', availableAt: now, createdAt: now, updatedAt: now,
      })
      return { companionUserId, accountId }
    })

    await expect(
      t.withIdentity({ subject: 'adv-wd-outsider' }).mutation(api.withdrawals.request, { amountCentavos: 50_000 }),
    ).rejects.toThrow('approved Companion profile')

    const state = await t.run(async (ctx) => ({
      account: await ctx.db.get(accountId),
      withdrawals: await ctx.db.query('withdrawals').collect(),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.account).toMatchObject({ availableCentavos: 120_000, reservedCentavos: 0 })
    expect(state.withdrawals).toEqual([])
    expect(state.transactions).toEqual([])
  })

  it('rejects a non-reviewer reading an identity review image', async () => {
    const t = createTest()
    const now = Date.now()
    const ids = await t.run(async (ctx) => {
      const memberId = await ctx.db.insert('users', {
        clerkUserId: 'adv-id-member', displayName: 'Identity Member', role: 'member',
        verificationStatus: 'pending', suspended: false, createdAt: now, updatedAt: now,
      })
      await ctx.db.insert('users', {
        clerkUserId: 'adv-id-outsider', displayName: 'Identity Outsider', role: 'member',
        verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now,
      })
      const recordId = await ctx.db.insert('identityRecords', {
        userId: memberId, reason: 'member', source: 'in_app', stage: 'ready_for_review', selectedIdType: 'passport',
        fullLegalName: 'Identity Member', dateOfBirth: '1990-01-01', idType: 'passport', expirationDate: '2035-01-01',
        fieldsConfirmedAt: now, thirdPartyProcessingConsentedAt: now, reviewConsentedAt: now, submittedAt: now,
        createdAt: now, updatedAt: now,
      })
      const requestId = await ctx.db.insert('verificationRequests', {
        userId: memberId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown',
        verificationSource: 'in_app', identityRecordId: recordId, identityStage: 'ready_for_review',
        adminStatus: 'pending', isCurrent: true, attempt: 1, createdAt: now, updatedAt: now,
      })
      await ctx.db.patch(recordId, { verificationRequestId: requestId })
      const storageId = await ctx.storage.store(new Blob(['image'], { type: 'image/jpeg' }))
      await ctx.db.insert('identityRecordImages', {
        identityRecordId: recordId, userId: memberId, kind: 'id_front', storageId, contentType: 'image/jpeg',
        size: 5, createdAt: now, retentionDueAt: now + 86_400_000, purgeAfter: now + 86_400_000,
      })
      return { requestId }
    })

    await expect(
      t.withIdentity({ subject: 'adv-id-outsider' }).action(api.identityRecords.readReviewImage, {
        verificationRequestId: ids.requestId,
        kind: 'id_front',
      }),
    ).rejects.toThrow('Reviewer or admin role required')

    await expect(
      t.withIdentity({ subject: 'adv-id-member' }).action(api.identityRecords.readReviewImage, {
        verificationRequestId: ids.requestId,
        kind: 'id_front',
      }),
    ).rejects.toThrow('Reviewer or admin role required')

    const grants = await t.run(async (ctx) => ctx.db.query('identityRecordAccessGrants').collect())
    expect(grants).toEqual([])
  })

  it('rejects suspended accounts before any authorization decision', async () => {
    const t = createTest()
    const now = Date.now()
    const { requestId } = await t.run(async (ctx) => {
      const memberId = await ctx.db.insert('users', {
        clerkUserId: 'adv-suspended-target', displayName: 'Suspended Target', role: 'member',
        verificationStatus: 'pending', suspended: false, createdAt: now, updatedAt: now,
      })
      const recordId = await ctx.db.insert('identityRecords', {
        userId: memberId, reason: 'member', source: 'in_app', stage: 'ready_for_review', selectedIdType: 'passport',
        fullLegalName: 'Suspended Target', dateOfBirth: '1990-01-01', idType: 'passport', expirationDate: '2035-01-01',
        fieldsConfirmedAt: now, thirdPartyProcessingConsentedAt: now, reviewConsentedAt: now, submittedAt: now,
        createdAt: now, updatedAt: now,
      })
      const requestId = await ctx.db.insert('verificationRequests', {
        userId: memberId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown',
        verificationSource: 'in_app', identityRecordId: recordId, identityStage: 'ready_for_review',
        adminStatus: 'pending', isCurrent: true, attempt: 1, createdAt: now, updatedAt: now,
      })
      await ctx.db.patch(recordId, { verificationRequestId: requestId })
      return { requestId }
    })
    await insertUser(t, 'adv-suspended', 'member', { suspended: true })
    const suspended = t.withIdentity({ subject: 'adv-suspended' })

    await expect(suspended.query(api.conversations.list, {})).rejects.toThrow('Account is suspended')
    await expect(suspended.query(api.admin.overview, {})).rejects.toThrow('Account is suspended')

    await expect(
      suspended.action(api.identityRecords.readReviewImage, {
        verificationRequestId: requestId,
        kind: 'id_front',
      }),
    ).rejects.toThrow('Account is suspended')
  })
})
