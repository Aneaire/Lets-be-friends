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

const now = Date.now()

async function seedMember(t: ReturnType<typeof convexTest>, options: {
  clerkUserId?: string
  role?: 'member' | 'companion' | 'admin'
  username?: string
  deletedAt?: number
} = {}) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('users', {
      clerkUserId: options.clerkUserId ?? 'deletion-member',
      displayName: 'Angelo Santiago',
      username: options.username ?? 'angelo',
      firstName: 'Angelo',
      lastName: 'Santiago',
      bio: 'Private bio text',
      role: options.role ?? 'member',
      verificationStatus: 'approved',
      identityVerifiedAt: now - 1_000,
      suspended: false,
      deletedAt: options.deletedAt,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function seedWallet(t: ReturnType<typeof convexTest>, userId: any, amountCentavos: number) {
  await t.run(async (ctx) => {
    await ctx.db.insert('walletAccounts', {
      deterministicKey: `member-booking:${userId}`,
      accountType: 'member_booking',
      ownerUserId: userId,
      currency: 'PHP',
      availableCentavos: amountCentavos,
      reservedCentavos: 0,
      pendingCentavos: 0,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function seedCompanionProfile(t: ReturnType<typeof convexTest>, userId: any) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('companionProfiles', {
      userId,
      displayName: 'Angelo Santiago',
      intro: 'A private introduction',
      city: 'Angeles City',
      strengths: ['Good listener'],
      categories: ['Good company'],
      boundaries: ['Public places only'],
      mode: 'online',
      hourlyRateCentavos: 50_000,
      status: 'approved',
      rating: 4.8,
      reviewCount: 3,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function seedBooking(t: ReturnType<typeof convexTest>, input: {
  memberId: any
  companionProfileId: any
  status?: 'request_sent' | 'closed' | 'cancelled'
  settlementState?: 'unreserved' | 'settled'
}) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('bookings', {
      memberId: input.memberId,
      companionProfileId: input.companionProfileId,
      category: 'Good company',
      mode: 'online',
      requestedAt: now + 86_400_000,
      durationMinutes: 60,
      status: input.status ?? 'request_sent',
      settlementState: input.settlementState ?? 'unreserved',
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('account deletion', () => {
  it('rejects an unauthenticated request without writing', async () => {
    const t = createTest()
    await seedMember(t)
    await expect(t.mutation(api.accountDeletion.deleteAccount, { confirmation: 'DELETE' }))
      .rejects.toThrow(/Profile sync required|Authentication/i)
  })

  it('rejects a confirmation that is not exactly DELETE and leaves the account intact', async () => {
    const t = createTest()
    const userId = await seedMember(t)
    await expect(t.withIdentity({ subject: 'deletion-member' })
      .mutation(api.accountDeletion.deleteAccount, { confirmation: 'delete my account' }))
      .rejects.toThrow(/Type DELETE/)
    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      expect(user?.deletedAt).toBeUndefined()
      expect(user?.displayName).toBe('Angelo Santiago')
    })
  })

  it('blocks deletion while the wallet still holds money', async () => {
    const t = createTest()
    const userId = await seedMember(t)
    await seedWallet(t, userId, 25_000)

    const summary = await t.withIdentity({ subject: 'deletion-member' })
      .query(api.accountDeletion.deletionSummary, {})
    expect(summary.canDelete).toBe(false)
    expect(summary.blockers.map((blocker) => blocker.code)).toContain('wallet_balance')
    expect(summary.blockers[0].description).toContain('₱250.00')

    await expect(t.withIdentity({ subject: 'deletion-member' })
      .mutation(api.accountDeletion.deleteAccount, { confirmation: 'DELETE' }))
      .rejects.toThrow(/Withdraw or spend it/)
  })

  it('blocks deletion while an experience is still open', async () => {
    const t = createTest()
    const memberId = await seedMember(t)
    const otherUserId = await seedMember(t, { clerkUserId: 'deletion-companion', role: 'companion' })
    const companionProfileId = await seedCompanionProfile(t, otherUserId)
    await seedBooking(t, { memberId, companionProfileId, status: 'request_sent' })

    const summary = await t.withIdentity({ subject: 'deletion-member' })
      .query(api.accountDeletion.deletionSummary, {})
    expect(summary.canDelete).toBe(false)
    expect(summary.blockers.map((blocker) => blocker.code)).toContain('open_booking')
  })

  it('blocks deletion while a withdrawal is in flight', async () => {
    const t = createTest()
    const userId = await seedMember(t)
    await t.run(async (ctx) => {
      const payoutMethodId = await ctx.db.insert('payoutMethods', {
        companionUserId: userId,
        provider: 'instapay',
        institutionBic: 'GXCHPHM2XXX',
        institutionName: 'G-Xchange, Inc.',
        accountName: 'Angelo Santiago',
        accountNumberCiphertext: 'ciphertext',
        accountNumberIv: 'iv',
        accountNumberLast4: '0033',
        status: 'active',
        mode: 'test',
        availableAt: now,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('withdrawals', {
        companionUserId: userId,
        payoutMethodId,
        amountCentavos: 10_000,
        providerFeeCentavos: 0,
        currency: 'PHP',
        status: 'pending',
        mode: 'test',
        destinationInstitutionName: 'G-Xchange, Inc.',
        destinationAccountName: 'Angelo Santiago',
        destinationAccountLast4: '0033',
        referenceNumber: 'wd-1',
        idempotencyKey: 'wd-1',
        attemptCount: 1,
        createdAt: now,
        updatedAt: now,
      })
    })

    const summary = await t.withIdentity({ subject: 'deletion-member' })
      .query(api.accountDeletion.deletionSummary, {})
    expect(summary.blockers.map((blocker) => blocker.code)).toContain('withdrawal_in_flight')
  })

  it('blocks deletion while the member hosts a Circle', async () => {
    const t = createTest()
    const userId = await seedMember(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('circles', {
        slug: 'hosted-circle',
        name: 'Hosted Circle',
        purpose: 'Test hosting',
        category: 'Hobbies',
        rules: [],
        mode: 'online',
        state: 'active',
        hostUserId: userId,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      })
    })

    const summary = await t.withIdentity({ subject: 'deletion-member' })
      .query(api.accountDeletion.deletionSummary, {})
    expect(summary.blockers.map((blocker) => blocker.code)).toContain('circle_host')
  })

  it('blocks deleting the only admin account', async () => {
    const t = createTest()
    await seedMember(t, { clerkUserId: 'sole-admin', role: 'admin' })
    const summary = await t.withIdentity({ subject: 'sole-admin' })
      .query(api.accountDeletion.deletionSummary, {})
    expect(summary.blockers.map((blocker) => blocker.code)).toContain('sole_admin')
  })

  it('erases personal data and stored images while keeping financial rows', async () => {
    const t = createTest()
    const { userId, profileStorageId, postStorageId, identityStorageId, bookingId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        clerkUserId: 'deletion-member',
        displayName: 'Angelo Santiago',
        username: 'angelo',
        firstName: 'Angelo',
        lastName: 'Santiago',
        bio: 'Private bio text',
        role: 'member',
        verificationStatus: 'approved',
        identityVerifiedAt: now - 1_000,
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      const profileStorageId = await ctx.storage.store(new Blob(['profile'], { type: 'image/jpeg' }))
      const identityStorageId = await ctx.storage.store(new Blob(['selfie'], { type: 'image/jpeg' }))
      const postStorageId = await ctx.storage.store(new Blob(['post'], { type: 'image/jpeg' }))

      await ctx.db.patch(userId, { profileImageStorageId: profileStorageId })

      const recordId = await ctx.db.insert('identityRecords', {
        userId,
        reason: 'member',
        source: 'in_app',
        stage: 'approved',
        selectedIdType: 'passport',
        fullLegalName: 'Angelo Santiago',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('identityRecordImages', {
        identityRecordId: recordId,
        userId,
        kind: 'selfie',
        storageId: identityStorageId,
        contentType: 'image/jpeg',
        size: 6,
        purgeAfter: now,
        createdAt: now,
      })
      await ctx.db.insert('verificationRequests', {
        userId,
        reason: 'member',
        personaStatus: 'completed',
        adminStatus: 'approved',
        personaInquiryId: 'inq_1',
        createdAt: now,
        updatedAt: now,
      })

      const postId = await ctx.db.insert('posts', {
        authorId: userId,
        body: 'Personal post body',
        media: [{ storageId: postStorageId, kind: 'image', contentType: 'image/jpeg', size: 4 }],
        reportable: true,
        hidden: false,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('postMediaUploads', {
        userId,
        storageId: postStorageId,
        postId,
        kind: 'image',
        contentType: 'image/jpeg',
        size: 4,
        createdAt: now,
        registeredAt: now,
      })
      await ctx.db.insert('follows', { followerId: userId, followingId: userId, createdAt: now })
      await ctx.db.insert('savedPosts', { userId, postId, createdAt: now })
      await ctx.db.insert('notificationPreferences', { userId, createdAt: now, updatedAt: now })
      await ctx.db.insert('userDevices', {
        userId,
        installationId: 'install-1',
        firstSeenAt: now,
        lastSeenAt: now,
      })
      await ctx.db.insert('pushDevices', {
        installationId: 'install-1',
        userId,
        expoPushToken: 'ExponentPushToken[abc]',
        platform: 'android',
        projectId: 'project-1',
        enabled: true,
        tokenRevision: 1,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('payoutMethods', {
        companionUserId: userId,
        provider: 'instapay',
        institutionBic: 'GXCHPHM2XXX',
        institutionName: 'G-Xchange, Inc.',
        accountName: 'Angelo Santiago',
        accountNumberCiphertext: 'ciphertext',
        accountNumberIv: 'iv',
        accountNumberLast4: '0033',
        status: 'active',
        mode: 'test',
        availableAt: now,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('referralCodes', {
        ownerUserId: userId,
        code: 'ANGELO5',
        createdAt: now,
      })

      const companionProfileId = await ctx.db.insert('companionProfiles', {
        userId,
        displayName: 'Angelo Santiago',
        intro: 'A private introduction',
        city: 'Angeles City',
        strengths: ['Good listener'],
        categories: ['Good company'],
        boundaries: ['Public places only'],
        mode: 'online',
        hourlyRateCentavos: 50_000,
        status: 'approved',
        rating: 4.8,
        reviewCount: 3,
        createdAt: now,
        updatedAt: now,
      })
      // A settled booking is not a blocker and its ledger row survives.
      const bookingId = await ctx.db.insert('bookings', {
        memberId: userId,
        companionProfileId,
        category: 'Good company',
        mode: 'online',
        requestedAt: now - 86_400_000,
        durationMinutes: 60,
        status: 'closed',
        settlementState: 'settled',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('walletTransactions', {
        kind: 'booking_complete',
        idempotencyKey: 'tx-1',
        bookingId,
        actorUserId: userId,
        amountCentavos: 50_000,
        currency: 'PHP',
        createdAt: now,
      })
      await ctx.db.insert('messages', {
        bookingId,
        senderId: userId,
        body: 'Private chat line',
        reportable: true,
        createdAt: now,
      })
      await ctx.db.insert('reviews', {
        bookingId,
        reviewerId: userId,
        revieweeId: userId,
        rating: 5,
        body: 'Private review text',
        createdAt: now,
      })

      return { userId, profileStorageId, postStorageId, identityStorageId, bookingId }
    })

    const summary = await t.withIdentity({ subject: 'deletion-member' })
      .query(api.accountDeletion.deletionSummary, {})
    expect(summary.canDelete).toBe(true)
    expect(summary.counts?.publicPosts).toBe(1)

    const result = await t.withIdentity({ subject: 'deletion-member' })
      .mutation(api.accountDeletion.deleteAccount, { confirmation: 'DELETE' })
    expect(result).toEqual({ deleted: true, alreadyDeleted: false })

    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      expect(user?.deletedAt).toBeTypeOf('number')
      expect(user?.displayName).toBe('Deleted member')
      expect(user?.username).toBeUndefined()
      expect(user?.firstName).toBeUndefined()
      expect(user?.bio).toBeUndefined()
      expect(user?.profileImageStorageId).toBeUndefined()
      expect(user?.identityVerifiedAt).toBeUndefined()
      expect(user?.suspended).toBe(true)

      expect(await ctx.db.query('identityRecords').collect()).toHaveLength(0)
      expect(await ctx.db.query('identityRecordImages').collect()).toHaveLength(0)
      expect(await ctx.db.query('verificationRequests').collect()).toHaveLength(0)
      expect(await ctx.db.query('userDevices').collect()).toHaveLength(0)
      expect(await ctx.db.query('pushDevices').collect()).toHaveLength(0)
      expect(await ctx.db.query('payoutMethods').collect()).toHaveLength(0)
      expect(await ctx.db.query('referralCodes').collect()).toHaveLength(0)
      expect(await ctx.db.query('follows').collect()).toHaveLength(0)
      expect(await ctx.db.query('savedPosts').collect()).toHaveLength(0)

      for (const storageId of [profileStorageId, postStorageId, identityStorageId]) {
        expect(await ctx.storage.get(storageId)).toBeNull()
      }

      const post = await ctx.db.query('posts').first()
      expect(post?.hidden).toBe(true)
      expect(post?.body).toBe('')
      expect(post?.media).toBeUndefined()

      const message = await ctx.db.query('messages').first()
      expect(message).toBeNull()

      const review = await ctx.db.query('reviews').first()
      expect(review?.rating).toBe(5)
      expect(review?.body).toBeUndefined()

      const booking = await ctx.db.get(bookingId)
      expect(booking?._id).toBe(bookingId)
      expect(await ctx.db.query('walletTransactions').collect()).toHaveLength(1)

      const audit = await ctx.db.query('auditLogs').collect()
      expect(audit.some((entry) => entry.action === 'account.deleted')).toBe(true)
    })
  })

  it('lets a suspended member delete their own data', async () => {
    const t = createTest()
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert('users', {
        clerkUserId: 'deletion-member',
        displayName: 'Suspended Member',
        role: 'member',
        verificationStatus: 'not_started',
        suspended: true,
        createdAt: now,
        updatedAt: now,
      })
    })

    const result = await t.withIdentity({ subject: 'deletion-member' })
      .mutation(api.accountDeletion.deleteAccount, { confirmation: 'DELETE' })
    expect(result).toEqual({ deleted: true, alreadyDeleted: false })

    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId)
      expect(user?.deletedAt).toBeTypeOf('number')
      expect(user?.displayName).toBe('Deleted member')
    })
  })

  it('is idempotent after the account was deleted', async () => {
    const t = createTest()
    await seedMember(t, { deletedAt: now })
    await t.run(async (ctx) => {
      const user = await ctx.db.query('users').first()
      if (!user) throw new Error('seed missing')
      await ctx.db.patch(user._id, { suspended: true })
    })
    const result = await t.withIdentity({ subject: 'deletion-member' })
      .mutation(api.accountDeletion.deleteAccount, { confirmation: 'DELETE' })
    expect(result).toEqual({ deleted: true, alreadyDeleted: true })
  })

  it('reports a deleted account in the summary instead of blockers', async () => {
    const t = createTest()
    await seedMember(t, { deletedAt: now })
    await t.run(async (ctx) => {
      const user = await ctx.db.query('users').first()
      if (!user) throw new Error('seed missing')
      await ctx.db.patch(user._id, { suspended: true })
    })
    const summary = await t.withIdentity({ subject: 'deletion-member' })
      .query(api.accountDeletion.deletionSummary, {})
    expect(summary).toEqual({ deleted: true, canDelete: false, blockers: [], counts: null })
  })
})
