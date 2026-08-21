import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { buildOpenAiIdentityRequest, parseOpenAiIdentityResponse } from '../../../convex/identityRecords'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
const imageBytes = new TextEncoder().encode('identity-image').buffer
const DAY_MS = 24 * 60 * 60 * 1_000

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

async function insertUser(t: ReturnType<typeof convexTest>, clerkUserId: string, role: 'member' | 'reviewer' | 'admin' = 'member') {
  return await t.run(async (ctx) => ctx.db.insert('users', {
    clerkUserId,
    displayName: clerkUserId,
    role,
    verificationStatus: 'not_started',
    suspended: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }))
}

const extraction = {
  fullLegalName: 'Example Member',
  dateOfBirth: '1990-01-02',
  idType: 'national_id',
  idNumberLast4: '6789',
  expirationDate: undefined,
  nationality: 'PH',
  signals: {
    fullLegalName: 'high', dateOfBirth: 'high', idType: 'high', idNumberLast4: 'high', expirationDate: 'high', nationality: 'high',
  },
  needsReview: false,
} as const

describe('in-app identity records', () => {
  it('starts a private in-app attempt without approving the member', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'identity-member')
    const result = await t.withIdentity({ subject: 'identity-member' }).mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'national_id' })
    expect(result.mode).toBe('started')
    const state = await t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      request: await ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).unique(),
      record: await ctx.db.query('identityRecords').withIndex('by_user', (q) => q.eq('userId', userId)).unique(),
    }))
    expect(state.user?.verificationStatus).toBe('pending')
    expect(state.request).toMatchObject({ verificationSource: 'in_app', identityStage: 'draft', adminStatus: 'not_ready' })
    expect(state.record).toMatchObject({ source: 'in_app', stage: 'draft', selectedIdType: 'national_id' })
  })

  it('uses stored-disabled image input and never adds a selfie to the AI request', () => {
    const request = buildOpenAiIdentityRequest(new Uint8Array([1, 2, 3]).buffer, 'image/jpeg', 'passport', { bytes: new Uint8Array([4, 5, 6]).buffer, contentType: 'image/png' })
    expect(request.store).toBe(false)
    expect(JSON.stringify(request)).toContain('data:image/jpeg;base64,AQID')
    expect(JSON.stringify(request).toLowerCase()).not.toContain('selfie')
    expect(JSON.stringify(request)).toContain('data:image/png;base64,BAUG')
    expect((request.input[1].content.filter((item) => item.type === 'input_image'))).toHaveLength(2)
    expect(request.text.format.strict).toBe(true)
  })

  it('retains only the last four ID characters from provider output', () => {
    const extraction = parseOpenAiIdentityResponse({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
        fullLegalName: 'Example Member', dateOfBirth: '1990-01-02', idType: 'national_id', idNumberLast4: 'FULL-ID-123456789', expirationDate: null, nationality: 'PH',
        signals: { fullLegalName: 'high', dateOfBirth: 'high', idType: 'high', idNumberLast4: 'medium', expirationDate: 'needs_review', nationality: 'high' }, needsReview: true,
      }) }] }],
    })
    expect(extraction.idNumberLast4).toBe('6789')
    expect(JSON.stringify(extraction)).not.toContain('123456789')
  })

  it('requires a human admin decision before an in-app attempt becomes approved', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'reviewed-member')
    await insertUser(t, 'identity-admin', 'admin')
    const { requestId, recordId } = await t.run(async (ctx) => {
      const now = Date.now()
      const recordId = await ctx.db.insert('identityRecords', {
        userId, reason: 'member', source: 'in_app', stage: 'ready_for_review', selectedIdType: 'passport',
        fullLegalName: 'Reviewed Member', dateOfBirth: '1990-01-01', idType: 'passport', expirationDate: '2035-01-01',
        fieldsConfirmedAt: now, thirdPartyProcessingConsentedAt: now, reviewConsentedAt: now, submittedAt: now,
        createdAt: now, updatedAt: now,
      })
      const requestId = await ctx.db.insert('verificationRequests', { userId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app', identityRecordId: recordId, identityStage: 'ready_for_review', adminStatus: 'pending', isCurrent: true, attempt: 1, createdAt: now, updatedAt: now })
      await ctx.db.patch(recordId, { verificationRequestId: requestId })
      const storageId = await ctx.storage.store(new Blob(['image'], { type: 'image/jpeg' }))
      await ctx.db.insert('identityRecordImages', { identityRecordId: recordId, userId, kind: 'id_front', storageId, contentType: 'image/jpeg', size: 5, createdAt: now, retentionDueAt: now + 86_400_000, purgeAfter: now + 86_400_000 })
      await ctx.db.insert('identityRecordImages', { identityRecordId: recordId, userId, kind: 'selfie', storageId, contentType: 'image/jpeg', size: 5, createdAt: now, retentionDueAt: now + 86_400_000, purgeAfter: now + 86_400_000 })
      return { requestId, recordId }
    })
    expect((await t.run(async (ctx) => ctx.db.get(userId)))?.verificationStatus).not.toBe('approved')
    await t.withIdentity({ subject: 'identity-admin' }).mutation(api.admin.reviewMemberVerification, { verificationRequestId: requestId, decision: 'approved' })
    const approved = await t.run(async (ctx) => ({ user: await ctx.db.get(userId), record: await ctx.db.get(recordId) }))
    expect(approved.user).toMatchObject({ verificationStatus: 'approved', verificationSource: 'in_app' })
    expect(approved.record?.stage).toBe('approved')
  })

  it('runs a complete manual workflow from start through admin approval', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'workflow-member')
    await insertUser(t, 'workflow-admin', 'admin')
    const member = t.withIdentity({ subject: 'workflow-member' })

    const started = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'national_id' })
    expect(started.mode).toBe('started')
    if (started.mode !== 'started') throw new Error('Expected a started attempt')
    const identityRecordId = started.identityRecordId

    await member.action(api.identityRecords.uploadImage, { identityRecordId, kind: 'id_front', bytes: imageBytes, contentType: 'image/jpeg' })
    await t.mutation(internal.identityRecords.prepareExtraction, { clerkUserId: 'workflow-member', identityRecordId })
    await t.mutation(internal.identityRecords.completeExtraction, { clerkUserId: 'workflow-member', identityRecordId, extraction: { ...extraction } as any })

    await expect(member.mutation(api.identityRecords.confirmFields, {
      identityRecordId,
      fullLegalName: 'Example Member',
      dateOfBirth: '2012-01-01',
      idType: 'national_id',
      nationality: 'PH',
    })).rejects.toThrow(/at least 18 years old/)

    await member.mutation(api.identityRecords.confirmFields, {
      identityRecordId,
      fullLegalName: 'Example Member',
      dateOfBirth: extraction.dateOfBirth,
      idType: 'national_id',
      idNumberLast4: '6789',
      nationality: 'PH',
    })
    const { token } = await member.mutation(api.identityRecords.issueSelfieCaptureToken, { identityRecordId })
    await member.action(api.identityRecords.uploadImage, { identityRecordId, kind: 'selfie', bytes: imageBytes, contentType: 'image/jpeg', cameraCaptureToken: token })

    await member.mutation(api.identityRecords.submit, { identityRecordId, reviewConsent: true })
    const submitted = await t.run(async (ctx) => ({ request: await ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).unique(), record: await ctx.db.get(identityRecordId) }))
    expect(submitted.request).toMatchObject({ adminStatus: 'pending', identityStage: 'ready_for_review' })
    expect(submitted.record?.stage).toBe('ready_for_review')

    await t.withIdentity({ subject: 'workflow-admin' }).mutation(api.admin.reviewMemberVerification, { verificationRequestId: submitted.request!._id, decision: 'approved', note: 'Docs verified.' })
    const approved = await t.run(async (ctx) => ({ user: await ctx.db.get(userId), record: await ctx.db.get(identityRecordId) }))
    expect(approved.user).toMatchObject({ verificationStatus: 'approved', verificationSource: 'in_app' })
    expect(approved.user?.identityExpiresAt).toBeGreaterThan(approved.user?.identityVerifiedAt ?? 0)
    expect(approved.record?.stage).toBe('approved')
  })

  it('rejects superseded attempts across the whole manual workflow', async () => {
    const t = createTest()
    await insertUser(t, 'supersede-member')
    const member = t.withIdentity({ subject: 'supersede-member' })
    const started = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'national_id' })
    if (started.mode !== 'started') throw new Error('Expected a started attempt')
    const identityRecordId = started.identityRecordId

    await t.run(async (ctx) => {
      const user = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'supersede-member')).unique()
      const request = await ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', user!._id).eq('isCurrent', true)).unique()
      await ctx.db.patch(request!._id, { isCurrent: false, supersededAt: Date.now(), updatedAt: Date.now() })
    })

    const superseded = new RegExp('superseded')
    await expect(member.action(api.identityRecords.uploadImage, { identityRecordId, kind: 'id_front', bytes: imageBytes, contentType: 'image/jpeg' })).rejects.toThrow(superseded)
    await expect(member.mutation(api.identityRecords.issueSelfieCaptureToken, { identityRecordId })).rejects.toThrow(superseded)
    await expect(member.mutation(api.identityRecords.submit, { identityRecordId, reviewConsent: true })).rejects.toThrow(superseded)
    await expect(member.query(api.identityRecords.current, {})).resolves.toBeNull()
  })

  it('enforces required confirmed fields and policy before submit can proceed', async () => {
    const t = createTest()
    await insertUser(t, 'policy-member')
    const member = t.withIdentity({ subject: 'policy-member' })
    const started = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'passport' })
    if (started.mode !== 'started') throw new Error('Expected a started attempt')
    const identityRecordId = started.identityRecordId
    await member.action(api.identityRecords.uploadImage, { identityRecordId, kind: 'id_front', bytes: imageBytes, contentType: 'image/jpeg' })
    await t.mutation(internal.identityRecords.prepareExtraction, { clerkUserId: 'policy-member', identityRecordId })
    await t.mutation(internal.identityRecords.completeExtraction, { clerkUserId: 'policy-member', identityRecordId, extraction: { ...extraction, idType: 'passport' } as any })

    await expect(member.mutation(api.identityRecords.confirmFields, {
      identityRecordId,
      fullLegalName: 'Policy Member',
      dateOfBirth: extraction.dateOfBirth,
      idType: 'passport',
    })).rejects.toThrow(/requires an expiration date/)

    await expect(member.mutation(api.identityRecords.confirmFields, {
      identityRecordId,
      fullLegalName: 'Policy Member',
      dateOfBirth: extraction.dateOfBirth,
      idType: 'passport',
      expirationDate: '2020-01-01',
    })).rejects.toThrow(/expired/)

    await member.mutation(api.identityRecords.confirmFields, {
      identityRecordId,
      fullLegalName: 'Policy Member',
      dateOfBirth: extraction.dateOfBirth,
      idType: 'passport',
      expirationDate: '2030-01-01',
    })

    await expect(member.mutation(api.identityRecords.submit, { identityRecordId, reviewConsent: true }))
      .rejects.toThrow(/ID image and current camera selfie are required/)
  })

  it('rejects public booking reason and requires a saved Companion application for companion_application', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'guard-member')
    const member = t.withIdentity({ subject: 'guard-member' })
    await expect(member.mutation(api.identityRecords.start, { reason: 'booking', selectedIdType: 'national_id' }))
      .rejects.toThrow(/no longer available/)
    await expect(member.mutation(api.identityRecords.start, { reason: 'companion_application', selectedIdType: 'national_id' }))
      .rejects.toThrow(/Save the Companion application/)
    const now = Date.now()
    await t.run(async (ctx) => ctx.db.insert('companionProfiles', {
      userId, displayName: 'Applicant', intro: 'A sufficiently detailed Companion introduction for testing.', city: 'Cebu',
      strengths: ['Good listener'], categories: ['Coffee or meal companion'], boundaries: ['Public places only'],
      mode: 'both', status: 'pending_review', rating: 0, reviewCount: 0, createdAt: now, updatedAt: now,
    }))
    const started = await member.mutation(api.identityRecords.start, { reason: 'companion_application', selectedIdType: 'national_id' })
    expect(started.mode).toBe('started')
    if (started.mode !== 'started') throw new Error('Expected a started attempt')
    const request = await t.run(async (ctx) => ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).unique())
    expect(request?.reason).toBe('companion_application')
  })

  it('derives reverification after a prior approval and exposes only the newest current record', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'reverify-member')
    const member = t.withIdentity({ subject: 'reverify-member' })
    const now = Date.now()
    await t.run(async (ctx) => ctx.db.patch(userId, { verificationStatus: 'approved', verificationSource: 'in_app', identityVerifiedAt: now - 10_000, identityExpiresAt: now - 1, updatedAt: now }))
    const first = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'national_id' })
    if (first.mode !== 'started') throw new Error('Expected a started attempt')
    const firstRequest = await t.run(async (ctx) => ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).unique())
    expect(firstRequest?.reason).toBe('reverification')

    await t.run(async (ctx) => {
      const request = await ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).unique()
      await ctx.db.patch(request!._id, { isCurrent: false, supersededAt: Date.now(), updatedAt: Date.now() })
    })
    const second = await member.mutation(api.identityRecords.start, { reason: 'reverification', selectedIdType: 'national_id' })
    if (second.mode !== 'started') throw new Error('Expected a started attempt')
    const currentState = await member.query(api.identityRecords.current, {})
    expect(currentState?._id).toBe(second.identityRecordId)
    const currentRequests = await t.run(async (ctx) => ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).collect())
    expect(currentRequests).toHaveLength(1)
    expect(currentRequests[0]?._id).not.toBe(firstRequest?._id)
  })

  it('replaces an abandoned Persona attempt with a fresh in-app attempt', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'persona-abandoned')
    const now = Date.now()
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { verificationStatus: 'pending', updatedAt: now })
      await ctx.db.insert('verificationRequests', {
        userId, reason: 'member', personaInquiryId: 'inq_abandoned', personaStatus: 'in_progress', personaDecision: 'unknown',
        verificationSource: 'persona', adminStatus: 'not_ready', isCurrent: true, attempt: 1, createdAt: now, updatedAt: now,
      })
    })
    const member = t.withIdentity({ subject: 'persona-abandoned' })
    const started = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'national_id' })
    expect(started.mode).toBe('started')
    const currentRequests = await t.run(async (ctx) => ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).collect())
    expect(currentRequests).toHaveLength(1)
    expect(currentRequests[0]?.verificationSource).toBe('in_app')
  })

  it('treats booking identity attempts as historical, never resumes, and supersedes them on a member start', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'booking-historical')
    const now = Date.now()
    const bookingRecordId = await t.run(async (ctx) => {
      const recordId = await ctx.db.insert('identityRecords', { userId, reason: 'booking', source: 'in_app', stage: 'confirmation_required', selectedIdType: 'national_id', createdAt: now, updatedAt: now })
      const requestId = await ctx.db.insert('verificationRequests', { userId, reason: 'booking', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app', identityRecordId: recordId, identityStage: 'confirmation_required', adminStatus: 'not_ready', isCurrent: true, attempt: 1, createdAt: now, updatedAt: now })
      await ctx.db.patch(recordId, { verificationRequestId: requestId })
      return recordId
    })
    const member = t.withIdentity({ subject: 'booking-historical' })
    await expect(member.query(api.identityRecords.current, {})).resolves.toBeNull()
    await expect(member.mutation(api.identityRecords.issueSelfieCaptureToken, { identityRecordId: bookingRecordId })).rejects.toThrow(/no longer active/)
    await expect(member.mutation(api.identityRecords.submit, { identityRecordId: bookingRecordId, reviewConsent: true })).rejects.toThrow(/no longer active/)

    const started = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'national_id' })
    expect(started.mode).toBe('started')
    const requests = await t.run(async (ctx) => ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).collect())
    expect(requests).toHaveLength(1)
    expect(requests[0]?.reason).toBe('member')
    expect(requests[0]?.identityRecordId).not.toBe(bookingRecordId)
  })

  it('starts a pre-expiry renewal while keeping the prior entitlement active', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'renewal-member')
    const now = Date.now()
    await t.run(async (ctx) => ctx.db.patch(userId, { verificationStatus: 'approved', verificationSource: 'in_app', identityVerifiedAt: now - 30 * DAY_MS, identityExpiresAt: now + 30 * DAY_MS, updatedAt: now }))
    const member = t.withIdentity({ subject: 'renewal-member' })
    const started = await member.mutation(api.identityRecords.start, { reason: 'reverification', selectedIdType: 'national_id' })
    expect(started.mode).toBe('started')
    if (started.mode !== 'started') throw new Error('Expected a started attempt')
    const afterStart = await t.run(async (ctx) => ctx.db.get(userId))
    expect(afterStart?.verificationStatus).toBe('approved')
    expect(afterStart?.identityExpiresAt).toBe(now + 30 * DAY_MS)
    const request = await t.run(async (ctx) => ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).unique())
    expect(request?.reason).toBe('reverification')
    await expect(member.query(api.identityRecords.current, {})).resolves.toMatchObject({ _id: started.identityRecordId, stage: 'draft' })
  })

  it('preserves a still-valid prior entitlement when a renewal is rejected at policy or superseded', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'renewal-reject')
    const now = Date.now()
    await t.run(async (ctx) => ctx.db.patch(userId, { verificationStatus: 'approved', verificationSource: 'in_app', identityVerifiedAt: now - 30 * DAY_MS, identityExpiresAt: now + 30 * DAY_MS, updatedAt: now }))
    const member = t.withIdentity({ subject: 'renewal-reject' })
    const started = await member.mutation(api.identityRecords.start, { reason: 'reverification', selectedIdType: 'passport' })
    if (started.mode !== 'started') throw new Error('Expected a started attempt')
    const identityRecordId = started.identityRecordId
    await member.action(api.identityRecords.uploadImage, { identityRecordId, kind: 'id_front', bytes: imageBytes, contentType: 'image/jpeg' })
    await t.mutation(internal.identityRecords.prepareExtraction, { clerkUserId: 'renewal-reject', identityRecordId })
    await t.mutation(internal.identityRecords.completeExtraction, { clerkUserId: 'renewal-reject', identityRecordId, extraction: { ...extraction, idType: 'passport' } as any })

    await expect(member.mutation(api.identityRecords.confirmFields, {
      identityRecordId,
      fullLegalName: 'Renewal Member',
      dateOfBirth: '2012-01-01',
      idType: 'passport',
      expirationDate: '2035-01-01',
    })).rejects.toThrow(/at least 18 years old/)
    expect((await t.run(async (ctx) => ctx.db.get(userId)))?.verificationStatus).toBe('approved')

    await t.run(async (ctx) => {
      const request = await ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).unique()
      await ctx.db.patch(request!._id, { isCurrent: false, supersededAt: Date.now(), updatedAt: Date.now() })
    })
    const afterSupersede = await t.run(async (ctx) => ctx.db.get(userId))
    expect(afterSupersede?.verificationStatus).toBe('approved')
    expect(afterSupersede?.identityExpiresAt).toBe(now + 30 * DAY_MS)
  })

  it('requires ownership and bidirectional backlink invariants before exposing current fields', async () => {
    const t = createTest()
    await insertUser(t, 'current-invariants-member')
    await insertUser(t, 'current-invariants-other', 'member')
    const now = Date.now()
    const { userId, otherId } = await t.run(async (ctx) => {
      const userId = (await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'current-invariants-member')).unique())!._id
      const otherId = (await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', 'current-invariants-other')).unique())!._id
      return { userId, otherId }
    })
    const member = t.withIdentity({ subject: 'current-invariants-member' })

    await t.run(async (ctx) => {
      const otherRecordId = await ctx.db.insert('identityRecords', { userId: otherId, reason: 'member', source: 'in_app', stage: 'draft', selectedIdType: 'national_id', createdAt: now, updatedAt: now })
      const requestId = await ctx.db.insert('verificationRequests', { userId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app', identityRecordId: otherRecordId, identityStage: 'draft', adminStatus: 'not_ready', isCurrent: true, attempt: 1, createdAt: now, updatedAt: now })
      await ctx.db.patch(otherRecordId, { verificationRequestId: requestId })
    })
    await expect(member.query(api.identityRecords.current, {})).resolves.toBeNull()

    await t.run(async (ctx) => {
      const memberRecordId = await ctx.db.insert('identityRecords', { userId, reason: 'member', source: 'in_app', stage: 'draft', selectedIdType: 'national_id', createdAt: now, updatedAt: now })
      await ctx.db.insert('verificationRequests', { userId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app', identityRecordId: memberRecordId, identityStage: 'draft', adminStatus: 'not_ready', isCurrent: true, attempt: 2, createdAt: now, updatedAt: now })
    })
    await expect(member.query(api.identityRecords.current, {})).resolves.toBeNull()
  })

  it('hides an expired approved record and starts a fresh reverification attempt', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'expired-approved-member')
    const now = Date.now()
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, {
        verificationStatus: 'approved',
        verificationSource: 'in_app',
        identityVerifiedAt: now - 2 * DAY_MS,
        identityExpiresAt: now - DAY_MS,
        updatedAt: now,
      })
      const recordId = await ctx.db.insert('identityRecords', {
        userId,
        reason: 'member',
        source: 'in_app',
        stage: 'approved',
        selectedIdType: 'national_id',
        createdAt: now,
        updatedAt: now,
      })
      const requestId = await ctx.db.insert('verificationRequests', {
        userId,
        reason: 'member',
        personaStatus: 'not_started',
        personaDecision: 'unknown',
        verificationSource: 'in_app',
        identityRecordId: recordId,
        identityStage: 'approved',
        adminStatus: 'approved',
        isCurrent: true,
        attempt: 1,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch(recordId, { verificationRequestId: requestId })
    })

    const member = t.withIdentity({ subject: 'expired-approved-member' })
    await expect(member.query(api.identityRecords.current, {})).resolves.toBeNull()
    const started = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'national_id' })
    expect(started.mode).toBe('started')
    const currentRequests = await t.run(async (ctx) => ctx.db.query('verificationRequests')
      .withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true))
      .collect())
    expect(currentRequests).toHaveLength(1)
    expect(currentRequests[0]?.reason).toBe('reverification')
  })
})

describe('identity approval expiry maintenance', () => {
  it('sends deduplicated reminders, expires approvals, and excludes test bypass', async () => {
    const previous = process.env.IDENTITY_TEST_BYPASS_USER_IDS
    process.env.IDENTITY_TEST_BYPASS_USER_IDS = 'bypass-user'
    const t = createTest()
    try {
      const now = Date.now()
      const ids = await t.run(async (ctx) => {
        const base = { verificationStatus: 'approved' as const, verificationSource: 'in_app' as const, suspended: false, createdAt: now, updatedAt: now }
        const thirty = await ctx.db.insert('users', { clerkUserId: 'expiring-30', displayName: 'Expiring 30', role: 'member', identityVerifiedAt: now, identityExpiresAt: now + 20 * DAY_MS, ...base })
        const seven = await ctx.db.insert('users', { clerkUserId: 'expiring-7', displayName: 'Expiring 7', role: 'member', identityVerifiedAt: now, identityExpiresAt: now + 5 * DAY_MS, ...base })
        const expiredId = await ctx.db.insert('users', { clerkUserId: 'expired-user', displayName: 'Expired User', role: 'member', identityVerifiedAt: now - 2 * DAY_MS, identityExpiresAt: now - DAY_MS, ...base })
        const bypassId = await ctx.db.insert('users', { clerkUserId: 'bypass-user', displayName: 'Bypass User', role: 'member', identityTestBypass: true, identityVerifiedAt: now - 2 * DAY_MS, identityExpiresAt: now - DAY_MS, ...base })
        const later = await ctx.db.insert('users', { clerkUserId: 'expiring-later', displayName: 'Expiring Later', role: 'member', identityVerifiedAt: now, identityExpiresAt: now + 100 * DAY_MS, ...base })
        return { thirty, seven, expiredId, bypassId, later }
      })

      const result = await t.mutation(internal.identityRecords.processIdentityExpiry, { now, limit: 100 })
      expect(result).toMatchObject({ expiring: 2, expired: 1, skipped: 1 })

      const rows = await t.run(async (ctx) => ({
        thirtyNotifications: await ctx.db.query('notifications').withIndex('by_recipient_dedupe', (q: any) => q.eq('recipientUserId', ids.thirty).eq('dedupeKey', `identity-verification-expiring:${ids.thirty}:${now + 20 * DAY_MS}:30`)).unique(),
        sevenNotifications: await ctx.db.query('notifications').withIndex('by_recipient_dedupe', (q: any) => q.eq('recipientUserId', ids.seven).eq('dedupeKey', `identity-verification-expiring:${ids.seven}:${now + 5 * DAY_MS}:7`)).unique(),
        expiredNotifications: await ctx.db.query('notifications').withIndex('by_recipient_dedupe', (q: any) => q.eq('recipientUserId', ids.expiredId).eq('dedupeKey', `identity-verification-expired:${ids.expiredId}:${now - DAY_MS}`)).unique(),
        bypassNotifications: await ctx.db.query('notifications').collect(),
        expiredUser: await ctx.db.get(ids.expiredId),
        bypassUser: await ctx.db.get(ids.bypassId),
        laterUser: await ctx.db.get(ids.later),
        audits: await ctx.db.query('auditLogs').collect(),
      }))
      expect(rows.thirtyNotifications?.kind).toBe('identity_verification_expiring')
      expect(rows.sevenNotifications?.kind).toBe('identity_verification_expiring')
      expect(rows.expiredNotifications?.kind).toBe('identity_verification_expired')
      expect(rows.expiredUser?.verificationStatus).toBe('not_started')
      expect(rows.expiredUser?.identityExpiresAt).toBeUndefined()
      expect(rows.bypassUser?.verificationStatus).toBe('approved')
      expect(rows.laterUser?.verificationStatus).toBe('approved')
      expect(rows.bypassNotifications.filter((row) => row.recipientUserId === ids.bypassId)).toHaveLength(0)
      expect(rows.audits.some((audit) => audit.action === 'identity_verification.expired')).toBe(true)

      const again = await t.mutation(internal.identityRecords.processIdentityExpiry, { now, limit: 100 })
      expect(again.expired).toBe(0)
      const deduped = await t.run(async (ctx) => ({
        thirty: await ctx.db.query('notifications').withIndex('by_recipient_dedupe', (q: any) => q.eq('recipientUserId', ids.thirty).eq('dedupeKey', `identity-verification-expiring:${ids.thirty}:${now + 20 * DAY_MS}:30`)).unique(),
        seven: await ctx.db.query('notifications').withIndex('by_recipient_dedupe', (q: any) => q.eq('recipientUserId', ids.seven).eq('dedupeKey', `identity-verification-expiring:${ids.seven}:${now + 5 * DAY_MS}:7`)).unique(),
        expired: await ctx.db.query('notifications').withIndex('by_recipient_dedupe', (q: any) => q.eq('recipientUserId', ids.expiredId).eq('dedupeKey', `identity-verification-expired:${ids.expiredId}:${now - DAY_MS}`)).unique(),
      }))
      expect(deduped.thirty?._id).toBe(rows.thirtyNotifications?._id)
      expect(deduped.seven?._id).toBe(rows.sevenNotifications?._id)
      expect(deduped.expired?._id).toBe(rows.expiredNotifications?._id)
    } finally {
      if (previous === undefined) delete process.env.IDENTITY_TEST_BYPASS_USER_IDS
      else process.env.IDENTITY_TEST_BYPASS_USER_IDS = previous
    }
  })
})
