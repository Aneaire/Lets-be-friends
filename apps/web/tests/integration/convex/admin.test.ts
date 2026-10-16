import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules

type TestRole = 'member' | 'companion' | 'reviewer' | 'admin' | 'owner'

async function insertUser(t: ReturnType<typeof convexTest>, clerkUserId: string, role: TestRole) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId,
      displayName: clerkUserId,
      role,
      verificationStatus: 'not_started',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('admin role management', () => {
  it('allows an admin to grant full admin access to several users', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'admin-primary', 'admin')
    const firstUserId = await insertUser(t, 'member-first', 'member')
    const secondUserId = await insertUser(t, 'member-second', 'member')
    const admin = t.withIdentity({ subject: 'admin-primary' })

    await admin.mutation(api.admin.setAdminStatus, { userId: firstUserId, admin: true })
    await admin.mutation(api.admin.setAdminStatus, { userId: secondUserId, admin: true })

    const promoted = await t.run(async (ctx) => Promise.all([
      ctx.db.get(firstUserId),
      ctx.db.get(secondUserId),
    ]))
    expect(promoted.map((user) => user?.role)).toEqual(['admin', 'admin'])

    const logs = await t.run(async (ctx) => ctx.db.query('auditLogs').collect())
    expect(logs.filter((log) => log.action === 'admin.granted')).toHaveLength(2)
  })

  it('does not let reviewers grant admin access or admins demote themselves', async () => {
    const t = convexTest(schema, modules)
    const adminId = await insertUser(t, 'admin-primary', 'admin')
    const memberId = await insertUser(t, 'member-target', 'member')
    await insertUser(t, 'reviewer-user', 'reviewer')

    await expect(t.withIdentity({ subject: 'reviewer-user' }).mutation(api.admin.setAdminStatus, {
      userId: memberId,
      admin: true,
    })).rejects.toThrow('Full admin role required')

    await expect(t.withIdentity({ subject: 'reviewer-user' }).query(api.admin.users, {}))
      .rejects.toThrow('Full admin role required')

    await expect(t.withIdentity({ subject: 'admin-primary' }).mutation(api.admin.setAdminStatus, {
      userId: adminId,
      admin: false,
    })).rejects.toThrow('Admins cannot change their own admin role')
  })

  it('normalizes and migrates legacy owner records to admin', async () => {
    const t = convexTest(schema, modules)
    const legacyOwnerId = await insertUser(t, 'legacy-owner', 'owner')

    const viewer = await t.withIdentity({ subject: 'legacy-owner' }).query(api.users.viewer, {})
    expect(viewer?.role).toBe('admin')

    const visibleAdmins = await t.withIdentity({ subject: 'legacy-owner' }).query(api.admin.users, { role: 'admin' })
    expect(visibleAdmins).toMatchObject([{ _id: legacyOwnerId, role: 'admin' }])

    await expect(t.mutation(internal.migrations.migrateOwnerRoles, {})).resolves.toEqual({ migrated: 1 })
    await expect(t.mutation(internal.migrations.migrateOwnerRoles, {})).resolves.toEqual({ migrated: 0 })
    expect((await t.run(async (ctx) => ctx.db.get(legacyOwnerId)))?.role).toBe('admin')

    const logs = await t.run(async (ctx) => ctx.db.query('auditLogs').collect())
    expect(logs).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'role.owner_migrated_to_admin', targetId: String(legacyOwnerId) }),
    ]))
  })
})

describe('in-app member verification admin review', () => {
  it('rejects approval when the current in-app attempt has no linked record or missing images', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'admin-identity', 'admin')
    const userId = await insertUser(t, 'identity-member', 'member')
    const now = Date.now()

    const noLinkRequestId = await t.run(async (ctx) => ctx.db.insert('verificationRequests', {
      userId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app',
      identityStage: 'ready_for_review', adminStatus: 'pending', isCurrent: true, attempt: 1, createdAt: now, updatedAt: now,
    }))
    await expect(t.withIdentity({ subject: 'admin-identity' }).mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: noLinkRequestId,
      decision: 'approved',
    })).rejects.toThrow(/linked identity record/)

    const recordId = await t.run(async (ctx) => {
      const recordId = await ctx.db.insert('identityRecords', {
        userId, reason: 'member', source: 'in_app', stage: 'ready_for_review', selectedIdType: 'national_id',
        fullLegalName: 'Identity Member', dateOfBirth: '1990-01-01', idType: 'national_id',
        fieldsConfirmedAt: now, thirdPartyProcessingConsentedAt: now, reviewConsentedAt: now, submittedAt: now,
        createdAt: now, updatedAt: now,
      })
      const requestId = await ctx.db.insert('verificationRequests', {
        userId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app',
        identityRecordId: recordId, identityStage: 'ready_for_review', adminStatus: 'pending', isCurrent: true, attempt: 2, createdAt: now, updatedAt: now,
      })
      await ctx.db.patch(recordId, { verificationRequestId: requestId })
      return { recordId, requestId }
    })

    await expect(t.withIdentity({ subject: 'admin-identity' }).mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: recordId.requestId,
      decision: 'approved',
    })).rejects.toThrow(/ID front image is required/)

    await t.run(async (ctx) => {
      const record = await ctx.db.get(recordId.recordId)
      await ctx.db.insert('identityRecordImages', { identityRecordId: recordId.recordId, userId, kind: 'id_front', storageId: undefined, contentType: 'image/jpeg', size: 10, createdAt: now, retentionDueAt: now + 86_400_000, purgeAfter: now + 86_400_000 })
      await ctx.db.insert('identityRecordImages', { identityRecordId: recordId.recordId, userId, kind: 'selfie', storageId: undefined, contentType: 'image/jpeg', size: 10, createdAt: now, retentionDueAt: now + 86_400_000, purgeAfter: now + 86_400_000 })
      void record
    })
    await expect(t.withIdentity({ subject: 'admin-identity' }).mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: recordId.requestId,
      decision: 'approved',
    })).rejects.toThrow(/ID front image is required/)
  })

  it('approves only with a linked record that has retained front and selfie images and passes policy', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'admin-approve', 'admin')
    const userId = await insertUser(t, 'identity-approve', 'member')
    const now = Date.now()
    const { requestId } = await t.run(async (ctx) => {
      const recordId = await ctx.db.insert('identityRecords', {
        userId, reason: 'member', source: 'in_app', stage: 'ready_for_review', selectedIdType: 'passport',
        fullLegalName: 'Identity Approve', dateOfBirth: '1990-01-01', idType: 'passport', expirationDate: '2035-01-01',
        fieldsConfirmedAt: now, thirdPartyProcessingConsentedAt: now, reviewConsentedAt: now, submittedAt: now,
        createdAt: now, updatedAt: now,
      })
      const requestId = await ctx.db.insert('verificationRequests', {
        userId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app',
        identityRecordId: recordId, identityStage: 'ready_for_review', adminStatus: 'pending', isCurrent: true, attempt: 1, createdAt: now, updatedAt: now,
      })
      await ctx.db.patch(recordId, { verificationRequestId: requestId })
      const storageId = await ctx.storage.store(new Blob(['image'], { type: 'image/jpeg' }))
      await ctx.db.insert('identityRecordImages', { identityRecordId: recordId, userId, kind: 'id_front', storageId, contentType: 'image/jpeg', size: 5, createdAt: now, retentionDueAt: now + 86_400_000, purgeAfter: now + 86_400_000 })
      await ctx.db.insert('identityRecordImages', { identityRecordId: recordId, userId, kind: 'selfie', storageId, contentType: 'image/jpeg', size: 5, createdAt: now, retentionDueAt: now + 86_400_000, purgeAfter: now + 86_400_000 })
      return { requestId }
    })

    await t.withIdentity({ subject: 'admin-approve' }).mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: requestId,
      decision: 'approved',
      note: 'Documents and selfie match.',
    })
    const approved = await t.run(async (ctx) => ctx.db.get(userId))
    expect(approved?.verificationStatus).toBe('approved')
    expect(approved?.verificationSource).toBe('in_app')
    expect(approved?.identityExpiresAt).toBeLessThanOrEqual(Date.parse('2035-01-01T15:59:59.999Z'))
  })

  it('keeps a still-valid prior approval when an in-app renewal is rejected', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'admin-renewal-reject', 'admin')
    const userId = await insertUser(t, 'renewal-reject-member', 'member')
    const now = Date.now()
    const priorVerifiedAt = now - 30 * 86_400_000
    const priorExpiresAt = now + 30 * 86_400_000
    const requestId = await t.run(async (ctx) => {
      await ctx.db.patch(userId, {
        verificationStatus: 'approved',
        verificationSource: 'in_app',
        identityVerifiedAt: priorVerifiedAt,
        identityExpiresAt: priorExpiresAt,
        updatedAt: now,
      })
      const recordId = await ctx.db.insert('identityRecords', {
        userId, reason: 'reverification', source: 'in_app', stage: 'ready_for_review', selectedIdType: 'national_id',
        fullLegalName: 'Renewal Member', dateOfBirth: '1990-01-01', idType: 'national_id',
        fieldsConfirmedAt: now, thirdPartyProcessingConsentedAt: now, reviewConsentedAt: now, submittedAt: now,
        createdAt: now, updatedAt: now,
      })
      const requestId = await ctx.db.insert('verificationRequests', {
        userId, reason: 'reverification', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app',
        identityRecordId: recordId, identityStage: 'ready_for_review', adminStatus: 'pending', isCurrent: true, attempt: 2, createdAt: now, updatedAt: now,
      })
      await ctx.db.patch(recordId, { verificationRequestId: requestId })
      return requestId
    })

    await t.withIdentity({ subject: 'admin-renewal-reject' }).mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: requestId,
      decision: 'rejected',
      note: 'The renewal images do not match closely enough.',
      memberReason: 'unclear_image',
    })

    const member = await t.run(async (ctx) => ctx.db.get(userId))
    expect(member).toMatchObject({
      verificationStatus: 'approved',
      verificationSource: 'in_app',
      identityVerifiedAt: priorVerifiedAt,
      identityExpiresAt: priorExpiresAt,
    })
  })
})

describe('identity rejection reasons', () => {
  async function insertPendingAttempt(t: ReturnType<typeof convexTest>, clerkUserId: string) {
    const userId = await insertUser(t, clerkUserId, 'member')
    const requestId = await t.run(async (ctx) => {
      const now = Date.now()
      const recordId = await ctx.db.insert('identityRecords', {
        userId, reason: 'member', source: 'in_app', stage: 'ready_for_review', selectedIdType: 'national_id',
        fullLegalName: 'Rejectable Member', dateOfBirth: '1990-01-01', idType: 'national_id',
        fieldsConfirmedAt: now, thirdPartyProcessingConsentedAt: now, reviewConsentedAt: now, submittedAt: now,
        createdAt: now, updatedAt: now,
      })
      const requestId = await ctx.db.insert('verificationRequests', {
        userId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app',
        identityRecordId: recordId, identityStage: 'ready_for_review', adminStatus: 'pending', isCurrent: true, attempt: 1,
        createdAt: now, updatedAt: now,
      })
      await ctx.db.patch(recordId, { verificationRequestId: requestId })
      return requestId
    })
    return { userId, requestId }
  }

  it('refuses a rejection that gives the member no reason', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'admin-no-reason', 'admin')
    const { requestId } = await insertPendingAttempt(t, 'member-no-reason')

    await expect(t.withIdentity({ subject: 'admin-no-reason' }).mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: requestId,
      decision: 'rejected',
      note: 'Internal shorthand only.',
    })).rejects.toThrow(/requires a reason the member will see/)

    // The rejection was refused outright, so nothing was decided.
    const request = await t.run(async (ctx) => ctx.db.get(requestId))
    expect(request?.adminStatus).toBe('pending')
  })

  it('stores the reason for the member while keeping the internal note private', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'admin-with-reason', 'admin')
    const { userId, requestId } = await insertPendingAttempt(t, 'member-with-reason')

    await t.withIdentity({ subject: 'admin-with-reason' }).mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: requestId,
      decision: 'rejected',
      note: 'Looks like an expired licence, second attempt this week.',
      memberReason: 'expired_id',
    })

    const state = await t.run(async (ctx) => ({
      request: await ctx.db.get(requestId),
      notifications: await ctx.db.query('notifications').collect(),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    expect(state.request).toMatchObject({ adminStatus: 'rejected', memberReason: 'expired_id', reviewerNote: 'Looks like an expired licence, second attempt this week.' })

    // The member is notified, and the notification carries no reason or note: the
    // detail lives in their authenticated account view instead.
    const notified = state.notifications.filter((row) => row.recipientUserId === userId)
    expect(notified).toHaveLength(1)
    expect(notified[0]).toMatchObject({ kind: 'identity_verification_rejected', priority: 'attention', verificationRequestId: requestId })
    expect(JSON.stringify(notified[0])).not.toContain('expired_id')
    expect(JSON.stringify(notified[0])).not.toContain('expired licence')

    // The audit trail keeps the internal note for safety review.
    expect(state.audits.some((audit) => audit.action === 'member_verification.rejected')).toBe(true)

    // The member's own query exposes the member-safe reason and not the note.
    const own = await t.withIdentity({ subject: 'member-with-reason' }).query(api.users.latestMemberVerification, {})
    expect(own?.memberReason).toBe('expired_id')
    expect(JSON.stringify(own)).not.toContain('expired licence')
  })

  it('still allows an approval without a reason', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, 'admin-approve-no-reason', 'admin')
    const { userId, requestId } = await insertPendingAttempt(t, 'member-approve-no-reason')

    // Approval requires retained images, so give this attempt the two it needs.
    await t.run(async (ctx) => {
      const request = await ctx.db.get(requestId)
      const now = Date.now()
      for (const kind of ['id_front', 'selfie'] as const) {
        const storageId = await ctx.storage.store(new Blob([`${kind}-bytes`], { type: 'image/jpeg' }))
        await ctx.db.insert('identityRecordImages', {
          identityRecordId: request!.identityRecordId!, userId, kind, storageId, contentType: 'image/jpeg',
          size: 12, createdAt: now, retentionDueAt: now + 86_400_000, purgeAfter: now + 86_400_000,
        })
      }
    })

    await t.withIdentity({ subject: 'admin-approve-no-reason' }).mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: requestId,
      decision: 'approved',
      note: 'Documents match.',
    })
    expect((await t.run(async (ctx) => ctx.db.get(userId)))?.verificationStatus).toBe('approved')
  })
})
