import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')

async function insertUser(t: ReturnType<typeof convexTest>, input: { clerkUserId: string; role?: 'member' | 'reviewer' | 'owner'; verificationStatus?: 'not_started' | 'pending' | 'approved' | 'rejected' }) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId: input.clerkUserId,
      displayName: input.clerkUserId,
      role: input.role ?? 'member',
      verificationStatus: input.verificationStatus ?? 'pending',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function insertAttempt(
  t: ReturnType<typeof convexTest>,
  userId: any,
  input: { inquiryId: string; decision: 'passed' | 'needs_review' | 'declined'; adminStatus?: 'not_ready' | 'pending' | 'approved' | 'rejected'; isCurrent?: boolean },
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('verificationRequests', {
      userId,
      reason: 'member',
      personaInquiryId: input.inquiryId,
      personaTemplateId: 'itmpl_test',
      personaEnvironmentId: 'env_test',
      personaStatus: 'completed',
      personaDecision: input.decision,
      verificationSource: 'persona',
      adminStatus: input.adminStatus ?? 'pending',
      isCurrent: input.isCurrent ?? true,
      attempt: 1,
      providerCompletedAt: now,
      adminQueuedAt: now,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe('Persona webhook state transitions', () => {
  it('queues a provider pass without approving the member and handles duplicate delivery idempotently', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, { clerkUserId: 'member-webhook' })
    const requestId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('verificationRequests', {
        userId,
        reason: 'member',
        personaInquiryId: 'inq_webhook',
        personaTemplateId: 'itmpl_test',
        personaEnvironmentId: 'env_test',
        personaStatus: 'in_progress',
        personaDecision: 'unknown',
        verificationSource: 'persona',
        adminStatus: 'not_ready',
        isCurrent: true,
        attempt: 1,
        createdAt: now,
        updatedAt: now,
      })
    })

    await t.mutation(internal.persona.applyWebhookEvent, {
      eventId: 'evt_pass',
      eventName: 'inquiry.approved',
      inquiryId: 'inq_webhook',
      referenceId: `user:${userId}`,
      templateId: 'itmpl_test',
      environmentId: 'env_test',
      providerCreatedAt: Date.now(),
    })
    const afterPass = await t.run(async (ctx) => ({
      request: await ctx.db.get(requestId),
      user: await ctx.db.get(userId),
    }))
    expect(afterPass.request).toMatchObject({
      personaStatus: 'completed',
      personaDecision: 'passed',
      adminStatus: 'pending',
    })
    expect(afterPass.user?.verificationStatus).toBe('pending')

    const duplicate = await t.mutation(internal.persona.applyWebhookEvent, {
      eventId: 'evt_pass',
      eventName: 'inquiry.declined',
      inquiryId: 'inq_webhook',
      referenceId: `user:${userId}`,
      templateId: 'itmpl_test',
      environmentId: 'env_test',
      providerCreatedAt: Date.now() + 1,
    })
    expect(duplicate).toEqual({ outcome: 'duplicate' })
    expect((await t.run(async (ctx) => ctx.db.get(requestId)))?.personaDecision).toBe('passed')
  })

  it('ignores a terminal event with the wrong account reference', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, { clerkUserId: 'member-reference' })
    const requestId = await insertAttempt(t, userId, { inquiryId: 'inq_reference', decision: 'passed', adminStatus: 'not_ready' })

    const outcome = await t.mutation(internal.persona.applyWebhookEvent, {
      eventId: 'evt_wrong_reference',
      eventName: 'inquiry.approved',
      inquiryId: 'inq_reference',
      referenceId: 'user:someone-else',
      templateId: 'itmpl_test',
      environmentId: 'env_test',
      providerCreatedAt: Date.now(),
    })
    expect(outcome).toEqual({ outcome: 'ignored' })
    expect((await t.run(async (ctx) => ctx.db.get(requestId)))?.adminStatus).toBe('not_ready')
  })

  it('revokes an approved entitlement and reopens admin review after a newer provider decline', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, { clerkUserId: 'admin-reversal', role: 'reviewer', verificationStatus: 'not_started' })
    const userId = await insertUser(t, { clerkUserId: 'member-reversal' })
    const requestId = await insertAttempt(t, userId, { inquiryId: 'inq_reversal', decision: 'passed' })
    await t.withIdentity({ subject: 'admin-reversal' }).mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: requestId,
      decision: 'approved',
      note: 'Initial Persona pass reviewed.',
    })

    const repeatedPassTime = Date.now() + 1_000
    expect(await t.mutation(internal.persona.applyWebhookEvent, {
      eventId: 'evt_repeated_pass',
      eventName: 'inquiry.approved',
      inquiryId: 'inq_reversal',
      referenceId: `user:${userId}`,
      templateId: 'itmpl_test',
      environmentId: 'env_test',
      providerCreatedAt: repeatedPassTime,
    })).toEqual({ outcome: 'processed' })
    expect((await t.run(async (ctx) => ctx.db.get(userId)))?.verificationStatus).toBe('approved')

    const outcome = await t.mutation(internal.persona.applyWebhookEvent, {
      eventId: 'evt_reversal_decline',
      eventName: 'inquiry.declined',
      inquiryId: 'inq_reversal',
      referenceId: `user:${userId}`,
      templateId: 'itmpl_test',
      environmentId: 'env_test',
      providerCreatedAt: repeatedPassTime + 1,
    })
    expect(outcome).toEqual({ outcome: 'processed' })

    const result = await t.run(async (ctx) => ({
      request: await ctx.db.get(requestId),
      user: await ctx.db.get(userId),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    expect(result.request).toMatchObject({ personaDecision: 'declined', adminStatus: 'pending' })
    expect(result.request).not.toHaveProperty('reviewerUserId')
    expect(result.request).not.toHaveProperty('reviewedAt')
    expect(result.user).toMatchObject({ verificationStatus: 'pending' })
    expect(result.user).not.toHaveProperty('identityVerifiedAt')
    expect(result.user).not.toHaveProperty('identityExpiresAt')
    expect(result.audits.map((audit) => audit.action)).toContain('member_verification.reopened_by_provider')
    expect(result.audits.map((audit) => audit.action)).toContain('member_verification.approved')
  })

  it('ignores equal-time and newer lifecycle regressions', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, { clerkUserId: 'member-ordering' })
    const requestId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('verificationRequests', {
        userId,
        reason: 'member',
        personaInquiryId: 'inq_ordering',
        personaTemplateId: 'itmpl_test',
        personaEnvironmentId: 'env_test',
        personaStatus: 'processing',
        personaDecision: 'unknown',
        verificationSource: 'persona',
        adminStatus: 'not_ready',
        isCurrent: true,
        providerLastEventAt: 200,
        createdAt: now,
        updatedAt: now,
      })
    })

    expect(await t.mutation(internal.persona.applyWebhookEvent, {
      eventId: 'evt_missing_timestamp',
      eventName: 'inquiry.approved',
      inquiryId: 'inq_ordering',
      referenceId: `user:${userId}`,
      templateId: 'itmpl_test',
      environmentId: 'env_test',
    })).toEqual({ outcome: 'ignored' })

    for (const [eventId, eventName, providerCreatedAt] of [
      ['evt_equal_started', 'inquiry.started', 200],
      ['evt_newer_created', 'inquiry.created', 201],
    ] as const) {
      expect(await t.mutation(internal.persona.applyWebhookEvent, {
        eventId,
        eventName,
        inquiryId: 'inq_ordering',
        referenceId: `user:${userId}`,
        templateId: 'itmpl_test',
        environmentId: 'env_test',
        providerCreatedAt,
      })).toEqual({ outcome: 'ignored' })
    }
    expect((await t.run(async (ctx) => ctx.db.get(requestId)))?.personaStatus).toBe('processing')
  })
})

describe('inquiry preparation and legacy enforcement', () => {
  it('reuses one active inquiry attempt and rejects suspended accounts', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, { clerkUserId: 'member-start', verificationStatus: 'not_started' })

    const first = await t.mutation(internal.persona.prepareInquiry, { clerkUserId: 'member-start', intent: 'member' })
    const second = await t.mutation(internal.persona.prepareInquiry, { clerkUserId: 'member-start', intent: 'member' })
    expect(first.mode).toBe('launch')
    expect(second.mode).toBe('launch')
    if (first.mode !== 'launch' || second.mode !== 'launch') throw new Error('Expected a launch result')
    expect(second.requestId).toBe(first.requestId)
    expect(await t.run(async (ctx) => (
      await ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).collect()
    ))).toHaveLength(1)

    await t.run(async (ctx) => ctx.db.patch(userId, { suspended: true, updatedAt: Date.now() }))
    await expect(t.mutation(internal.persona.prepareInquiry, { clerkUserId: 'member-start', intent: 'member' }))
      .rejects.toThrow(/Account is suspended/)
  })

  it('labels an expired prior approval as reverification', async () => {
    const t = convexTest(schema, modules)
    const userId = await insertUser(t, { clerkUserId: 'expired-member', verificationStatus: 'approved' })
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.patch(userId, {
        verificationSource: 'persona',
        identityVerifiedAt: now - 10_000,
        identityExpiresAt: now - 1,
        updatedAt: now,
      })
      await ctx.db.insert('verificationRequests', {
        userId,
        reason: 'member',
        personaInquiryId: 'inq_expired',
        personaStatus: 'completed',
        personaDecision: 'passed',
        verificationSource: 'persona',
        adminStatus: 'approved',
        isCurrent: true,
        createdAt: now - 10_000,
        updatedAt: now - 10_000,
      })
    })

    const result = await t.mutation(internal.persona.prepareInquiry, { clerkUserId: 'expired-member', intent: 'member' })
    if (result.mode !== 'launch') throw new Error('Expected a launch result')
    expect((await t.run(async (ctx) => ctx.db.get(result.requestId)))?.reason).toBe('reverification')
  })

  it('blocks a legacy manual approval from creating a new booking', async () => {
    const t = convexTest(schema, modules)
    const hostUserId = await insertUser(t, { clerkUserId: 'verified-host', verificationStatus: 'approved' })
    const legacyMemberId = await insertUser(t, { clerkUserId: 'legacy-member', verificationStatus: 'approved' })
    await t.run(async (ctx) => ctx.db.patch(hostUserId, {
      verificationSource: 'persona',
      identityVerifiedAt: Date.now(),
      identityExpiresAt: Date.now() + 86_400_000,
      updatedAt: Date.now(),
    }))
    const hostProfileId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('hostProfiles', {
        userId: hostUserId,
        displayName: 'Verified host',
        intro: 'A sufficiently detailed Friend Host introduction for testing.',
        city: 'Online',
        strengths: ['Good listener'],
        categories: ['Online conversation'],
        boundaries: ['Public spaces only'],
        mode: 'online',
        status: 'approved',
        rating: 0,
        reviewCount: 0,
        createdAt: now,
        updatedAt: now,
      })
    })

    await expect(t.withIdentity({ subject: 'legacy-member' }).mutation(api.bookings.createDraft, {
      hostProfileId,
      category: 'Online conversation',
      mode: 'online',
      requestedAt: Date.now() + 3_600_000,
      durationMinutes: 60,
    })).rejects.toThrow(/current Persona identity check/)
    expect((await t.run(async (ctx) => ctx.db.get(legacyMemberId)))?.verificationStatus).toBe('approved')
  })
})

describe('booking identity eligibility', () => {
  it('blocks acceptance and pre-acceptance chat after the member loses eligibility', async () => {
    const t = convexTest(schema, modules)
    const hostUserId = await insertUser(t, { clerkUserId: 'booking-host', role: 'member', verificationStatus: 'approved' })
    const memberId = await insertUser(t, { clerkUserId: 'booking-member', verificationStatus: 'approved' })
    await t.run(async (ctx) => {
      const now = Date.now()
      for (const userId of [hostUserId, memberId]) {
        await ctx.db.patch(userId, {
          verificationSource: 'persona',
          identityVerifiedAt: now,
          identityExpiresAt: now + 86_400_000,
          updatedAt: now,
        })
      }
    })
    const { hostProfileId, bookingId } = await t.run(async (ctx) => {
      const now = Date.now()
      const hostProfileId = await ctx.db.insert('hostProfiles', {
        userId: hostUserId,
        displayName: 'Booking host',
        intro: 'A sufficiently detailed Friend Host introduction for testing.',
        city: 'Online',
        strengths: ['Good listener'],
        categories: ['Online conversation'],
        boundaries: ['Public places only'],
        mode: 'online',
        status: 'approved',
        rating: 0,
        reviewCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      const bookingId = await ctx.db.insert('bookings', {
        memberId,
        hostProfileId,
        category: 'Online conversation',
        mode: 'online',
        requestedAt: now + 3_600_000,
        durationMinutes: 60,
        status: 'request_sent',
        createdAt: now,
        updatedAt: now,
      })
      return { hostProfileId, bookingId }
    })
    await t.run(async (ctx) => ctx.db.patch(memberId, {
      identityExpiresAt: Date.now() - 1,
      updatedAt: Date.now(),
    }))

    await expect(t.withIdentity({ subject: 'booking-host' }).mutation(api.bookings.hostDecision, {
      bookingId,
      decision: 'accepted',
    })).rejects.toThrow(/member must renew identity approval/)
    await expect(t.withIdentity({ subject: 'booking-member' }).mutation(api.bookings.sendMessage, {
      bookingId,
      body: 'Can we still coordinate?',
    })).rejects.toThrow(/Both participants need current identity approval/)
    await t.withIdentity({ subject: 'booking-host' }).mutation(api.bookings.hostDecision, {
      bookingId,
      decision: 'declined',
      note: 'Identity renewal required.',
    })
    expect((await t.run(async (ctx) => ctx.db.get(bookingId)))?.status).toBe('declined')
    expect((await t.run(async (ctx) => ctx.db.get(hostProfileId)))?.status).toBe('approved')
  })
})

describe('mandatory admin identity review', () => {
  it('approves only the exact current Persona-passed attempt', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, { clerkUserId: 'admin-reviewer', role: 'reviewer', verificationStatus: 'not_started' })
    const userId = await insertUser(t, { clerkUserId: 'member-approved' })
    const requestId = await insertAttempt(t, userId, { inquiryId: 'inq_approved', decision: 'passed' })
    const historicalId = await insertAttempt(t, userId, { inquiryId: 'inq_historical', decision: 'passed', isCurrent: false })

    await t.withIdentity({ subject: 'admin-reviewer' }).mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: requestId,
      decision: 'approved',
      note: 'Reviewed in Persona.',
    })

    const result = await t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      request: await ctx.db.get(requestId),
      historical: await ctx.db.get(historicalId),
    }))
    expect(result.request?.adminStatus).toBe('approved')
    expect(result.historical?.adminStatus).toBe('pending')
    expect(result.user).toMatchObject({ verificationStatus: 'approved', verificationSource: 'persona' })
    expect(result.user?.identityVerifiedAt).toEqual(expect.any(Number))
    expect(result.user?.identityExpiresAt).toBeGreaterThan(result.user?.identityVerifiedAt ?? 0)
  })

  it('keeps Friend Host profile approval separate from identity approval', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, { clerkUserId: 'admin-host', role: 'reviewer', verificationStatus: 'not_started' })
    const applicantId = await insertUser(t, { clerkUserId: 'host-applicant', verificationStatus: 'pending' })
    const hostProfileId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert('hostProfiles', {
        userId: applicantId,
        displayName: 'Host applicant',
        intro: 'A sufficiently detailed Friend Host introduction for testing.',
        city: 'Cebu',
        strengths: ['Good listener'],
        categories: ['Coffee or meal companion'],
        boundaries: ['Public places only'],
        mode: 'both',
        status: 'pending_review',
        rating: 0,
        reviewCount: 0,
        createdAt: now,
        updatedAt: now,
      })
    })
    const admin = t.withIdentity({ subject: 'admin-host' })

    await expect(admin.mutation(api.admin.reviewHostApplication, {
      hostProfileId,
      decision: 'approved',
      note: 'Profile review complete.',
    })).rejects.toThrow(/Identity verification must be approved/)

    await t.run(async (ctx) => ctx.db.patch(applicantId, {
      verificationStatus: 'approved',
      verificationSource: 'persona',
      identityVerifiedAt: Date.now(),
      identityExpiresAt: Date.now() + 86_400_000,
      suspended: true,
      updatedAt: Date.now(),
    }))
    await expect(admin.mutation(api.admin.reviewHostApplication, {
      hostProfileId,
      decision: 'approved',
      note: 'Profile review complete.',
    })).rejects.toThrow(/suspended member/)

    await t.run(async (ctx) => ctx.db.patch(applicantId, { suspended: false, updatedAt: Date.now() }))
    await admin.mutation(api.admin.reviewHostApplication, {
      hostProfileId,
      decision: 'approved',
      note: 'Profile review complete.',
    })
    expect((await t.run(async (ctx) => ctx.db.get(hostProfileId)))?.status).toBe('approved')
  })

  it('keeps legacy manual requests out of the actionable identity queue', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, { clerkUserId: 'admin-legacy-queue', role: 'reviewer', verificationStatus: 'not_started' })
    const userId = await insertUser(t, { clerkUserId: 'legacy-queue-member', verificationStatus: 'approved' })
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert('verificationRequests', {
        userId,
        reason: 'member',
        personaInquiryId: 'inq_legacy_manual',
        personaStatus: 'approved',
        personaDecision: 'passed',
        verificationSource: 'legacy_manual',
        adminStatus: 'pending',
        isCurrent: true,
        createdAt: now,
        updatedAt: now,
      })
    })

    const rows = await t.withIdentity({ subject: 'admin-legacy-queue' }).query(api.admin.memberVerifications, { status: 'pending' })
    expect(rows).toEqual([])
  })

  it('blocks an approval override for a Persona decline but permits a noted rejection', async () => {
    const t = convexTest(schema, modules)
    await insertUser(t, { clerkUserId: 'admin-decline', role: 'owner', verificationStatus: 'not_started' })
    const userId = await insertUser(t, { clerkUserId: 'member-declined' })
    const requestId = await insertAttempt(t, userId, { inquiryId: 'inq_declined', decision: 'declined' })
    const admin = t.withIdentity({ subject: 'admin-decline' })

    await expect(admin.mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: requestId,
      decision: 'approved',
      note: 'Override attempt.',
    })).rejects.toThrow(/Persona declined or did not complete/)

    await admin.mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: requestId,
      decision: 'rejected',
      note: 'Persona declined the identity result.',
    })
    const result = await t.run(async (ctx) => ({ request: await ctx.db.get(requestId), user: await ctx.db.get(userId) }))
    expect(result.request?.adminStatus).toBe('rejected')
    expect(result.user?.verificationStatus).toBe('rejected')
  })
})
