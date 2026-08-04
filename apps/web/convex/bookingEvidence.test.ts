import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
const imageBytes = new TextEncoder().encode('private-image').buffer

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const base = { verificationStatus: 'approved' as const, suspended: false, createdAt: now, updatedAt: now }
    const memberId = await ctx.db.insert('users', { clerkUserId: 'evidence-member', displayName: 'Evidence Member', role: 'member', ...base })
    const hostUserId = await ctx.db.insert('users', { clerkUserId: 'evidence-host', displayName: 'Evidence Host', role: 'friend_host', ...base })
    const outsiderId = await ctx.db.insert('users', { clerkUserId: 'evidence-outsider', displayName: 'Evidence Outsider', role: 'member', ...base })
    const reviewerId = await ctx.db.insert('users', { clerkUserId: 'evidence-reviewer', displayName: 'Evidence Reviewer', role: 'reviewer', ...base })
    const hostProfileId = await ctx.db.insert('hostProfiles', {
      userId: hostUserId,
      displayName: 'Evidence Host',
      intro: 'A host for evidence tests.',
      city: 'Test City',
      strengths: ['Good listener'],
      categories: ['Coffee or meal companion'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: 50_000,
      status: 'approved',
      rating: 5,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    const bookingId = await ctx.db.insert('bookings', {
      memberId,
      hostProfileId,
      category: 'Coffee or meal companion',
      mode: 'in_person',
      requestedAt: now + 3_600_000,
      durationMinutes: 60,
      status: 'accepted',
      pricingModel: 'member_wallet_v2',
      serviceSubtotalCentavos: 50_000,
      memberBookingFeeBps: 1_500,
      memberBookingFeeCentavos: 7_500,
      memberTotalCentavos: 57_500,
      hostEntitlementCentavos: 50_000,
      currency: 'PHP',
      settlementState: 'reserved',
      createdAt: now,
      updatedAt: now,
    })
    return { now, memberId, hostUserId, outsiderId, reviewerId, hostProfileId, bookingId }
  })
}

async function uploadImage(t: ReturnType<typeof convexTest>, subject: string, bookingId: any) {
  return await t.withIdentity({ subject }).action(api.bookingEvidence.uploadImage, {
    bookingId,
    bytes: imageBytes,
    contentType: 'image/webp',
  })
}

describe('private booking evidence', () => {
  it('enforces role ownership, explicit skip warning, and completion decisions', async () => {
    const t = createTest()
    const ids = await seed(t)
    await expect(t.withIdentity({ subject: 'evidence-outsider' }).query(api.bookingEvidence.status, { bookingId: ids.bookingId }))
      .rejects.toThrow('Not your booking')
    await expect(t.withIdentity({ subject: 'evidence-host' }).mutation(api.bookingEvidence.skip, {
      bookingId: ids.bookingId, warningAcknowledged: false,
    })).rejects.toThrow('acknowledge')

    await t.withIdentity({ subject: 'evidence-host' }).mutation(api.bookingEvidence.skip, {
      bookingId: ids.bookingId, warningAcknowledged: true,
    })
    await t.withIdentity({ subject: 'evidence-host' }).mutation(api.bookingEvidence.skip, {
      bookingId: ids.bookingId, warningAcknowledged: true,
    })
    await expect(t.withIdentity({ subject: 'evidence-host' }).mutation(api.bookings.markCompleted, { bookingId: ids.bookingId }))
      .resolves.toMatchObject({ awaitingOtherConfirmation: true })
    await expect(t.withIdentity({ subject: 'evidence-member' }).mutation(api.bookings.markCompleted, { bookingId: ids.bookingId }))
      .rejects.toThrow('Choose end evidence')
    await t.withIdentity({ subject: 'evidence-member' }).mutation(api.bookingEvidence.skip, {
      bookingId: ids.bookingId, warningAcknowledged: true,
    })

    const decisions = await t.run(async (ctx) => ctx.db.query('bookingEvidenceDecisions').collect())
    expect(decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'host_start', userId: ids.hostUserId, decision: 'skipped' }),
      expect.objectContaining({ role: 'member_end', userId: ids.memberId, decision: 'skipped' }),
    ]))
  })

  it('stores and claims only action-provided bytes without accepting or deleting another resource storage ID', async () => {
    const t = createTest()
    const ids = await seed(t)
    const unrelatedStorageId = await t.run(async (ctx) => ctx.storage.store(new Blob(['social-media'], { type: 'image/webp' })))

    await expect(t.withIdentity({ subject: 'evidence-host' }).action(api.bookingEvidence.uploadImage, {
      bookingId: ids.bookingId,
      bytes: imageBytes,
      contentType: 'image/webp',
      storageId: unrelatedStorageId,
    } as any)).rejects.toThrow()
    expect(await t.run(async (ctx) => ctx.db.system.get('_storage', unrelatedStorageId))).not.toBeNull()

    await uploadImage(t, 'evidence-host', ids.bookingId)
    const state = await t.run(async (ctx) => ({
      decisions: await ctx.db.query('bookingEvidenceDecisions').collect(),
      uploads: await ctx.db.query('bookingEvidenceUploads').collect(),
    }))
    expect(state.decisions).toEqual([
      expect.objectContaining({ role: 'host_start', userId: ids.hostUserId, decision: 'uploaded' }),
    ])
    expect(state.uploads).toHaveLength(1)
    expect(state.uploads[0].storageId).not.toBe(unrelatedStorageId)
    expect(state.uploads[0]).toMatchObject({ contentType: 'image/webp', size: imageBytes.byteLength })
  })

  it('deletes a newly stored object if atomic claim fails', async () => {
    const t = createTest()
    const ids = await seed(t)
    await uploadImage(t, 'evidence-host', ids.bookingId)
    const storageCountBefore = await t.run(async (ctx) => (await ctx.db.system.query('_storage').collect()).length)

    await expect(uploadImage(t, 'evidence-host', ids.bookingId)).rejects.toThrow('already been made')
    const storageCountAfter = await t.run(async (ctx) => (await ctx.db.system.query('_storage').collect()).length)
    expect(storageCountAfter).toBe(storageCountBefore)
    expect(await t.run(async (ctx) => ctx.db.query('bookingEvidenceUploads').collect())).toHaveLength(1)
  })

  it('returns audited bytes only through an active linked report and exposes no storage ID or raw URL in lists', async () => {
    const t = createTest()
    const ids = await seed(t)
    await uploadImage(t, 'evidence-host', ids.bookingId)

    const reportId = await t.withIdentity({ subject: 'evidence-member' }).mutation(api.reports.create, {
      targetType: 'booking', targetId: String(ids.bookingId), reason: 'Review the start evidence',
    })
    const reports = await t.withIdentity({ subject: 'evidence-reviewer' }).query(api.admin.reports, { status: 'open', targetType: 'booking' })
    expect(reports[0].evidence).toEqual([{ role: 'host_start', decision: 'uploaded' }])
    expect(JSON.stringify(reports)).not.toContain('storageId')
    expect(JSON.stringify(reports)).not.toContain('url')

    await expect(t.withIdentity({ subject: 'evidence-member' }).action(api.bookingEvidence.readAdminEvidence, {
      reportId, role: 'host_start',
    })).rejects.toThrow('Reviewer or admin role required')
    const access = await t.withIdentity({ subject: 'evidence-reviewer' }).action(api.bookingEvidence.readAdminEvidence, {
      reportId, role: 'host_start',
    })
    expect(new Uint8Array(access.bytes)).toEqual(new Uint8Array(imageBytes))
    expect(access).toMatchObject({ contentType: 'image/webp' })
    expect(JSON.stringify(access)).not.toContain('storageId')
    expect(JSON.stringify(access)).not.toContain('url')
    const logs = await t.run(async (ctx) => ctx.db.query('auditLogs').collect())
    expect(logs).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'booking_evidence.accessed', actorUserId: ids.reviewerId }),
    ]))

    await t.withIdentity({ subject: 'evidence-reviewer' }).mutation(api.admin.updateReportStatus, {
      reportId, status: 'resolved', note: 'Reviewed.',
    })
    await expect(t.withIdentity({ subject: 'evidence-reviewer' }).action(api.bookingEvidence.readAdminEvidence, {
      reportId, role: 'host_start',
    })).rejects.toThrow('active booking report')
  })

  it('retires expired legacy grants without storage so they cannot block later purge batches', async () => {
    const t = createTest()
    const ids = await seed(t)
    const uploadId = await t.run(async (ctx) => ctx.db.insert('bookingEvidenceUploads', {
      bookingId: ids.bookingId,
      userId: ids.hostUserId,
      role: 'host_start',
      createdAt: ids.now - 2,
      expiresAt: ids.now - 1,
      purgeAfter: ids.now - 1,
    }))

    expect(await t.mutation(internal.bookingEvidence.purgeExpired, { now: ids.now })).toMatchObject({ checked: 1 })
    expect(await t.run(async (ctx) => ctx.db.get(uploadId))).toMatchObject({ purgedAt: ids.now })
    expect(await t.mutation(internal.bookingEvidence.purgeExpired, { now: ids.now })).toMatchObject({ checked: 0 })
  })

  it('retains due evidence while reports are active and purges it afterward in bounded runs', async () => {
    const t = createTest()
    const ids = await seed(t)
    await uploadImage(t, 'evidence-host', ids.bookingId)
    const upload = await t.run(async (ctx) => ctx.db.query('bookingEvidenceUploads').unique())
    const reportId = await t.withIdentity({ subject: 'evidence-host' }).mutation(api.reports.create, {
      targetType: 'booking', targetId: String(ids.bookingId), reason: 'Retain evidence while active',
    })
    await t.run(async (ctx) => ctx.db.patch(upload!._id, { purgeAfter: ids.now - 1 }))
    const retained = await t.mutation(internal.bookingEvidence.purgeExpired, { now: ids.now })
    expect(retained).toMatchObject({ retained: 1, purged: 0 })
    expect((await t.run(async (ctx) => ctx.db.get(upload!._id)))?.purgedAt).toBeUndefined()

    await t.withIdentity({ subject: 'evidence-reviewer' }).mutation(api.admin.updateReportStatus, {
      reportId, status: 'resolved', note: 'Review complete.',
    })
    const later = ids.now + 8 * 24 * 60 * 60 * 1_000
    const purged = await t.mutation(internal.bookingEvidence.purgeExpired, { now: later })
    expect(purged.purged).toBe(1)
    expect((await t.run(async (ctx) => ctx.db.get(upload!._id)))?.purgedAt).toBe(later)
  })
})
