import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it, vi } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { buildIdentityAssessmentRequest, buildImageQualityRequest, buildOpenAiIdentityRequest, extractionFailureReasonFor, parseOpenAiDecisionResponse, parseOpenAiIdentityResponse } from '../../../convex/identityRecords'
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
  expirationDate: undefined,
  nationality: 'PH',
  signals: {
    fullLegalName: 'high', dateOfBirth: 'high', idType: 'high', expirationDate: 'high', nationality: 'high',
  },
  needsReview: false,
} as const

// Builds a record that already has confirmed details plus both images, so submit
// can succeed without driving the extraction action.
async function insertSubmittableRecord(t: ReturnType<typeof createTest>, clerkUserId: string, idType: 'national_id' | 'passport' = 'national_id') {
  const user = await t.run(async (ctx) => ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId)).unique())
  return await t.run(async (ctx) => {
    const now = Date.now()
    const recordId = await ctx.db.insert('identityRecords', {
      userId: user!._id, reason: 'member', source: 'in_app', stage: 'confirmation_required', selectedIdType: idType,
      fullLegalName: 'Example Member', dateOfBirth: '1990-01-02', idType,
      expirationDate: idType === 'passport' ? '2035-01-01' : undefined,
      fieldsConfirmedAt: now, thirdPartyProcessingConsentedAt: now,
      createdAt: now, updatedAt: now,
    })
    const requestId = await ctx.db.insert('verificationRequests', {
      userId: user!._id, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app',
      identityRecordId: recordId, identityStage: 'confirmation_required', adminStatus: 'not_ready', isCurrent: true, attempt: 1,
      createdAt: now, updatedAt: now,
    })
    await ctx.db.patch(recordId, { verificationRequestId: requestId })
    for (const kind of ['id_front', 'selfie'] as const) {
      const storageId = await ctx.storage.store(new Blob([`${kind}-bytes`], { type: 'image/jpeg' }))
      await ctx.db.insert('identityRecordImages', {
        identityRecordId: recordId, userId: user!._id, kind, storageId, contentType: 'image/jpeg',
        size: 12, createdAt: now, retentionDueAt: now + 86_400_000, purgeAfter: now + 86_400_000,
      })
    }
    return { userId: user!._id, recordId, requestId }
  })
}

function decisionAnswers(probabilities: Record<string, number>) {
  return {
    model: 'gpt-6-luna',
    answers: Object.entries(probabilities).map(([name, probability]) => ({ type: 'predicate', name, probability })),
    usage: { input_tokens: 1200, output_tokens: 0 },
  }
}

// A record ready for extraction: draft stage with the front image already stored.
async function insertDraftRecord(t: ReturnType<typeof createTest>, clerkUserId: string) {
  const user = await t.run(async (ctx) => ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId)).unique())
  return await t.run(async (ctx) => {
    const now = Date.now()
    const recordId = await ctx.db.insert('identityRecords', {
      userId: user!._id, reason: 'member', source: 'in_app', stage: 'draft', selectedIdType: 'national_id',
      createdAt: now, updatedAt: now,
    })
    const requestId = await ctx.db.insert('verificationRequests', {
      userId: user!._id, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app',
      identityRecordId: recordId, identityStage: 'draft', adminStatus: 'not_ready', isCurrent: true, attempt: 1,
      createdAt: now, updatedAt: now,
    })
    await ctx.db.patch(recordId, { verificationRequestId: requestId })
    const storageId = await ctx.storage.store(new Blob(['id-front-bytes'], { type: 'image/jpeg' }))
    await ctx.db.insert('identityRecordImages', {
      identityRecordId: recordId, userId: user!._id, kind: 'id_front', storageId, contentType: 'image/jpeg',
      size: 14, createdAt: now, retentionDueAt: now + 86_400_000, purgeAfter: now + 86_400_000,
    })
    return { userId: user!._id, recordId, requestId }
  })
}

// The submission schedules the reviewer-signal action, which convex-test only
// starts on a timer tick, so scheduled work is driven with fake timers.
async function submitAndRunScheduledWork(t: ReturnType<typeof createTest>, clerkUserId: string, recordId: any) {
  vi.useFakeTimers()
  try {
    await t.withIdentity({ subject: clerkUserId }).mutation(api.identityRecords.submit, { identityRecordId: recordId, reviewConsent: true })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
  } finally {
    vi.useRealTimers()
  }
}

function withProviderEnv<T>(apiKey: string | undefined, run: () => Promise<T>): Promise<T> {
  const previous = process.env.OPENAI_API_KEY
  if (apiKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = apiKey
  return run().finally(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous
  })
}

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

  it('never stores an ID number fragment, even when the provider returns one', () => {
    const extraction = parseOpenAiIdentityResponse({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
        fullLegalName: 'Example Member', dateOfBirth: '1990-01-02', idType: 'national_id', idNumberLast4: 'FULL-ID-123456789', expirationDate: null, nationality: 'PH',
        signals: { fullLegalName: 'high', dateOfBirth: 'high', idType: 'high', idNumberLast4: 'medium', expirationDate: 'needs_review', nationality: 'high' }, needsReview: true,
      }) }] }],
    })
    expect(extraction).not.toHaveProperty('idNumberLast4')
    expect(extraction.signals).not.toHaveProperty('idNumberLast4')
    expect(JSON.stringify(extraction)).not.toContain('123456789')
  })

  it('does not ask the provider for an ID number', () => {
    const request = buildOpenAiIdentityRequest(new Uint8Array([1, 2, 3]).buffer, 'image/jpeg', 'passport')
    const schema = JSON.stringify(request.text.format.schema)
    expect(schema).not.toContain('idNumberLast4')
    expect(schema).not.toContain('final four')
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

    // A published client still sends this legacy field, so it must stay accepted
    // and simply be ignored.
    await member.mutation(api.identityRecords.confirmFields, {
      identityRecordId,
      fullLegalName: 'Example Member',
      dateOfBirth: extraction.dateOfBirth,
      idType: 'national_id',
      idNumberLast4: '6789',
      nationality: 'PH',
    })
    const confirmed = await t.run(async (ctx) => ctx.db.get(identityRecordId))
    expect(confirmed?.fullLegalName).toBe('Example Member')
    expect(confirmed?.idNumberLast4).toBeUndefined()
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

  it('lets a rejected member start a fresh attempt instead of locking them out', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'rejected-retry-member')
    await insertUser(t, 'rejected-retry-admin', 'admin')
    const member = t.withIdentity({ subject: 'rejected-retry-member' })

    const started = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'national_id' })
    if (started.mode !== 'started') throw new Error('Expected a started attempt')
    const identityRecordId = started.identityRecordId
    await member.action(api.identityRecords.uploadImage, { identityRecordId, kind: 'id_front', bytes: imageBytes, contentType: 'image/jpeg' })
    await t.mutation(internal.identityRecords.prepareExtraction, { clerkUserId: 'rejected-retry-member', identityRecordId })
    await t.mutation(internal.identityRecords.completeExtraction, { clerkUserId: 'rejected-retry-member', identityRecordId, extraction: { ...extraction } as any })
    await member.mutation(api.identityRecords.confirmFields, {
      identityRecordId,
      fullLegalName: 'Example Member',
      dateOfBirth: extraction.dateOfBirth,
      idType: 'national_id',
      nationality: 'PH',
    })
    const { token } = await member.mutation(api.identityRecords.issueSelfieCaptureToken, { identityRecordId })
    await member.action(api.identityRecords.uploadImage, { identityRecordId, kind: 'selfie', bytes: imageBytes, contentType: 'image/jpeg', cameraCaptureToken: token })
    await member.mutation(api.identityRecords.submit, { identityRecordId, reviewConsent: true })

    const request = await t.run(async (ctx) => ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).unique())
    await t.withIdentity({ subject: 'rejected-retry-admin' }).mutation(api.admin.reviewMemberVerification, {
      verificationRequestId: request!._id,
      decision: 'rejected',
      note: 'Photo was unreadable.',
      memberReason: 'unclear_image',
    })

    const rejected = await t.run(async (ctx) => ({ user: await ctx.db.get(userId), record: await ctx.db.get(identityRecordId) }))
    expect(rejected.user?.verificationStatus).toBe('rejected')
    expect(rejected.record?.stage).toBe('rejected')

    // The rejected attempt must not block a new one, or a rejection is a lockout.
    const restarted = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'national_id' })
    expect(restarted.mode).toBe('started')
    if (restarted.mode !== 'started') throw new Error('Expected a fresh attempt')
    expect(restarted.identityRecordId).not.toBe(identityRecordId)

    const after = await t.run(async (ctx) => ({
      fresh: await ctx.db.get(restarted.identityRecordId),
      old: await ctx.db.get(identityRecordId),
      oldRequest: (await ctx.db.get(identityRecordId))?.verificationRequestId
        ? await ctx.db.get((await ctx.db.get(identityRecordId))!.verificationRequestId!)
        : null,
      currentRequests: await ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).collect(),
    }))
    expect(after.fresh?.stage).toBe('draft')
    expect(after.currentRequests).toHaveLength(1)
    expect(String(after.currentRequests[0]?.identityRecordId)).toBe(String(restarted.identityRecordId))
    // The rejected attempt stays as history and is no longer the current attempt.
    expect(after.old?.stage).toBe('rejected')
    expect(after.oldRequest).toMatchObject({ adminStatus: 'rejected', memberReason: 'unclear_image', isCurrent: false })
    expect(String(after.old?.verificationRequestId)).not.toBe(String(after.currentRequests[0]?._id))

    // The member lands on the upload step for the new attempt, not the rejected one.
    const currentRecord = await member.query(api.identityRecords.current, {})
    expect(currentRecord).toMatchObject({ _id: restarted.identityRecordId, stage: 'draft' })
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
  it('sends deduplicated reminders and expires approvals including legacy bypass rows', async () => {
    const t = createTest()
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
    expect(result).toMatchObject({ expiring: 2, expired: 2, skipped: 0 })

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
      expect(rows.bypassUser?.verificationStatus).toBe('not_started')
      expect(rows.laterUser?.verificationStatus).toBe('approved')
      expect(rows.bypassNotifications.filter((row) => row.recipientUserId === ids.bypassId && row.kind === 'identity_verification_expired')).toHaveLength(1)
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
  })
})

describe('identity attempt restart', () => {
  it('returns an unsubmitted attempt to draft and purges its stored images', async () => {
    const t = createTest()
    await insertUser(t, 'restart-member')
    const member = t.withIdentity({ subject: 'restart-member' })
    const started = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'drivers_license' })
    if (started.mode !== 'started') throw new Error('Expected a started attempt')
    const identityRecordId = started.identityRecordId
    await member.action(api.identityRecords.uploadImage, { identityRecordId, kind: 'id_front', bytes: imageBytes, contentType: 'image/jpeg' })
    await t.mutation(internal.identityRecords.prepareExtraction, { clerkUserId: 'restart-member', identityRecordId })
    await t.mutation(internal.identityRecords.completeExtraction, { clerkUserId: 'restart-member', identityRecordId, extraction: { ...extraction } as any })
    await member.mutation(api.identityRecords.confirmFields, {
      identityRecordId,
      fullLegalName: 'Restart Member',
      dateOfBirth: extraction.dateOfBirth,
      idType: 'national_id',
      nationality: 'PH',
    })

    const before = await t.run(async (ctx) => {
      const image = await ctx.db.query('identityRecordImages').withIndex('by_record_kind', (q) => q.eq('identityRecordId', identityRecordId).eq('kind', 'id_front')).unique()
      return { storageId: image?.storageId, purgedAt: image?.purgedAt ?? null }
    })
    expect(before.storageId).toBeTruthy()

    const result = await member.mutation(api.identityRecords.restartAttempt, { identityRecordId })
    expect(result).toEqual({ mode: 'restarted' })

    const state = await t.run(async (ctx) => {
      const record = await ctx.db.get(identityRecordId)
      const image = await ctx.db.query('identityRecordImages').withIndex('by_record_kind', (q) => q.eq('identityRecordId', identityRecordId).eq('kind', 'id_front')).unique()
      const request = await ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', record!.userId).eq('isCurrent', true)).unique()
      return { record, image, request, audits: await ctx.db.query('auditLogs').collect() }
    })
    // Back to the upload step, as if nothing had been uploaded.
    expect(state.record?.stage).toBe('draft')
    expect(state.record?.extraction).toBeUndefined()
    expect(state.record?.fullLegalName).toBeUndefined()
    expect(state.record?.dateOfBirth).toBeUndefined()
    expect(state.record?.fieldsConfirmedAt).toBeUndefined()
    expect(state.record?.thirdPartyProcessingConsentedAt).toBeUndefined()
    expect(state.record?.selectedIdType).toBe('drivers_license')
    // The bytes are gone but the row survives so the daily upload allowance counts it.
    expect(state.image?.storageId).toBeUndefined()
    expect(state.image?.purgeReason).toBe('member_restarted')
    expect(state.request?.identityStage).toBe('draft')
    expect(state.audits.some((audit) => audit.action === 'identity_record.restarted')).toBe(true)
  })

  it('lets the member replace the front image after a restart', async () => {
    const t = createTest()
    await insertUser(t, 'restart-reupload-member')
    const member = t.withIdentity({ subject: 'restart-reupload-member' })
    const started = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'national_id' })
    if (started.mode !== 'started') throw new Error('Expected a started attempt')
    const identityRecordId = started.identityRecordId
    await member.action(api.identityRecords.uploadImage, { identityRecordId, kind: 'id_front', bytes: imageBytes, contentType: 'image/jpeg' })
    await t.mutation(internal.identityRecords.prepareExtraction, { clerkUserId: 'restart-reupload-member', identityRecordId })
    await t.mutation(internal.identityRecords.completeExtraction, { clerkUserId: 'restart-reupload-member', identityRecordId, extraction: { ...extraction } as any })
    await member.mutation(api.identityRecords.restartAttempt, { identityRecordId })

    // Before the restart this would have failed with "already been uploaded".
    await member.action(api.identityRecords.uploadImage, { identityRecordId, kind: 'id_front', bytes: imageBytes, contentType: 'image/jpeg' })
    await t.mutation(internal.identityRecords.prepareExtraction, { clerkUserId: 'restart-reupload-member', identityRecordId })
    await t.mutation(internal.identityRecords.completeExtraction, { clerkUserId: 'restart-reupload-member', identityRecordId, extraction: { ...extraction } as any })
    const record = await t.run(async (ctx) => ctx.db.get(identityRecordId))
    expect(record?.stage).toBe('confirmation_required')
  })

  it('refuses to restart an attempt that is already queued for safety review', async () => {
    const t = createTest()
    const userId = await insertUser(t, 'restart-submitted-member')
    const member = t.withIdentity({ subject: 'restart-submitted-member' })
    const now = Date.now()
    const recordId = await t.run(async (ctx) => {
      const recordId = await ctx.db.insert('identityRecords', {
        userId, reason: 'member', source: 'in_app', stage: 'ready_for_review', selectedIdType: 'passport',
        fullLegalName: 'Submitted Member', dateOfBirth: '1990-01-01', idType: 'passport', expirationDate: '2035-01-01',
        fieldsConfirmedAt: now, thirdPartyProcessingConsentedAt: now, reviewConsentedAt: now, submittedAt: now,
        createdAt: now, updatedAt: now,
      })
      const requestId = await ctx.db.insert('verificationRequests', {
        userId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app',
        identityRecordId: recordId, identityStage: 'ready_for_review', adminStatus: 'pending', isCurrent: true, attempt: 1,
        createdAt: now, updatedAt: now,
      })
      await ctx.db.patch(recordId, { verificationRequestId: requestId })
      return recordId
    })
    await expect(member.mutation(api.identityRecords.restartAttempt, { identityRecordId: recordId }))
      .rejects.toThrow(/not been sent for safety review/)
  })

  it('refuses to restart another member attempt', async () => {
    const t = createTest()
    await insertUser(t, 'restart-owner')
    await insertUser(t, 'restart-outsider')
    const owner = t.withIdentity({ subject: 'restart-owner' })
    const started = await owner.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'national_id' })
    if (started.mode !== 'started') throw new Error('Expected a started attempt')
    await expect(t.withIdentity({ subject: 'restart-outsider' }).mutation(api.identityRecords.restartAttempt, { identityRecordId: started.identityRecordId }))
      .rejects.toThrow(/not found/)
  })
})

describe('identity reviewer signals', () => {
  const confirmed = { fullLegalName: 'Example Member', dateOfBirth: '1990-01-02' }
  const image = { bytes: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/jpeg' }

  it('asks bounded Decisions questions with the ID image only', () => {
    const request = buildIdentityAssessmentRequest(image, confirmed)
    expect(request.questions.map((question) => question.name)).toEqual([
      'fullLegalNameLegible', 'dateOfBirthLegible', 'expirationDateLegible', 'looksGenuine', 'fullLegalNameMatches', 'dateOfBirthMatches',
    ])
    expect(request.questions.every((question) => question.type === 'predicate')).toBe(true)
    expect(JSON.stringify(request)).toContain('data:image/jpeg;base64,AQID')
    expect(JSON.stringify(request)).toContain('Example Member')
    expect(JSON.stringify(request).toLowerCase()).not.toContain('selfie')
    expect(JSON.stringify(request)).toContain('untrusted data')
  })

  it('defaults to the beta Decisions model and honours a deployment override', () => {
    const previous = process.env.OPENAI_DECISION_MODEL
    try {
      delete process.env.OPENAI_DECISION_MODEL
      expect(buildIdentityAssessmentRequest(image, confirmed).model).toBe('gpt-6-luna')
      process.env.OPENAI_DECISION_MODEL = 'gpt-6-luna-preview'
      expect(buildIdentityAssessmentRequest(image, confirmed).model).toBe('gpt-6-luna-preview')
    } finally {
      if (previous === undefined) delete process.env.OPENAI_DECISION_MODEL
      else process.env.OPENAI_DECISION_MODEL = previous
    }
  })

  it('reads predicate probabilities, clamps out of range values, and keeps refusals', () => {
    const answers = parseOpenAiDecisionResponse({
      model: 'gpt-6-luna',
      answers: [
        { type: 'predicate', name: 'fullLegalNameLegible', probability: 0.93 },
        { type: 'predicate', name: 'looksGenuine', probability: 1.4 },
        { type: 'predicate', name: 'dateOfBirthMatches', probability: -0.2 },
        { type: 'refusal', name: 'expirationDateLegible' },
      ],
      usage: { input_tokens: 1200, output_tokens: 0 },
    })
    expect(answers.probabilities).toEqual({ fullLegalNameLegible: 0.93, looksGenuine: 1, dateOfBirthMatches: 0 })
    expect(answers.refusals).toEqual(['expirationDateLegible'])
  })

  it('rejects a malformed or empty Decisions response', () => {
    expect(() => parseOpenAiDecisionResponse(null)).toThrow(/invalid_response/)
    expect(() => parseOpenAiDecisionResponse({ answers: [] })).toThrow(/missing_output/)
    expect(() => parseOpenAiDecisionResponse({ answers: [{ type: 'choice', name: 'document', choice: 'passport' }] })).not.toThrow()
  })

  it('reads score and choice answers alongside predicates', () => {
    const answers = parseOpenAiDecisionResponse({
      model: 'gpt-6-luna',
      answers: [
        { type: 'score', name: 'readability', score: 1.1, probabilities: [{ value: 1, label: 'mostly_unreadable', probability: 0.7 }], confidence: 0.8 },
        { type: 'choice', name: 'defect', choice: 'glare', probabilities: [{ value: 'glare', probability: 0.9 }], confidence: 0.9 },
        { type: 'refusal', name: 'authenticity' },
      ],
    })
    expect(answers.scores).toEqual({ readability: 1.1 })
    expect(answers.choices).toEqual({ defect: 'glare' })
    expect(answers.probabilities).toEqual({})
    expect(answers.refusals).toEqual(['authenticity'])
  })

  it('records calibrated signals after submission and flags them for the reviewer', async () => {
    const t = createTest()
    await insertUser(t, 'assessed-member')
    await insertUser(t, 'assessed-admin', 'admin')
    const { recordId } = await insertSubmittableRecord(t, 'assessed-member')
    const bodies: Array<Record<string, unknown>> = []
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init: { body: string }) => {
      urls.push(String(url))
      bodies.push(JSON.parse(init.body))
      return {
        ok: true,
        json: async () => decisionAnswers({
          fullLegalNameLegible: 0.97, dateOfBirthLegible: 0.81, expirationDateLegible: 0.12,
          looksGenuine: 0.64, fullLegalNameMatches: 0.99, dateOfBirthMatches: 0.55,
        }),
      } as unknown as Response
    }))
    try {
      await withProviderEnv('test-key', () => submitAndRunScheduledWork(t, 'assessed-member', recordId))
    } finally {
      vi.unstubAllGlobals()
    }

    expect(urls).toEqual([expect.stringContaining('/decisions')])
    expect(JSON.stringify(bodies[0]).toLowerCase()).not.toContain('selfie')
    const record = await t.run(async (ctx) => ctx.db.get(recordId))
    expect(record?.stage).toBe('ready_for_review')
    expect(record?.assessment).toMatchObject({
      fullLegalNameLegible: 0.97, dateOfBirthLegible: 0.81, expirationDateLegible: 0.12,
      looksGenuine: 0.64, fullLegalNameMatches: 0.99, dateOfBirthMatches: 0.55,
      refusals: [], model: 'gpt-6-luna',
    })
    expect(typeof record?.assessment?.assessedAt).toBe('number')
    expect(record?.assessmentFailureCode).toBeUndefined()

    const rows = await t.withIdentity({ subject: 'assessed-admin' }).query(api.admin.memberVerifications, { status: 'pending' })
    expect(rows[0]?.identityRecord?.assessmentFlagged).toBe(true)
    const audits = await t.run(async (ctx) => ctx.db.query('auditLogs').collect())
    expect(audits.some((audit) => audit.action === 'identity_record.assessment_completed')).toBe(true)
    expect(audits.some((audit) => audit.action === 'identity_record.assessment_failed')).toBe(false)
  })

  it('leaves a national ID unflagged when only the expiration signal is low', async () => {
    const t = createTest()
    await insertUser(t, 'national-id-member')
    await insertUser(t, 'national-id-admin', 'admin')
    const { recordId } = await insertSubmittableRecord(t, 'national-id-member', 'national_id')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => decisionAnswers({
        fullLegalNameLegible: 0.95, dateOfBirthLegible: 0.95, expirationDateLegible: 0.02,
        looksGenuine: 0.95, fullLegalNameMatches: 0.98, dateOfBirthMatches: 0.97,
      }),
    } as unknown as Response)))
    try {
      await withProviderEnv('test-key', () => submitAndRunScheduledWork(t, 'national-id-member', recordId))
    } finally {
      vi.unstubAllGlobals()
    }
    const rows = await t.withIdentity({ subject: 'national-id-admin' }).query(api.admin.memberVerifications, { status: 'pending' })
    expect(rows[0]?.identityRecord?.assessmentFlagged).toBe(false)
  })

  it('records a refusal and flags it for the reviewer', async () => {
    const t = createTest()
    await insertUser(t, 'refusal-member')
    await insertUser(t, 'refusal-admin', 'admin')
    const { recordId } = await insertSubmittableRecord(t, 'refusal-member')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        model: 'gpt-6-luna',
        answers: [
          { type: 'predicate', name: 'fullLegalNameLegible', probability: 0.96 },
          { type: 'predicate', name: 'dateOfBirthLegible', probability: 0.94 },
          { type: 'refusal', name: 'expirationDateLegible' },
          { type: 'predicate', name: 'looksGenuine', probability: 0.93 },
          { type: 'predicate', name: 'fullLegalNameMatches', probability: 0.97 },
          { type: 'predicate', name: 'dateOfBirthMatches', probability: 0.95 },
        ],
      }),
    } as unknown as Response)))
    try {
      await withProviderEnv('test-key', () => submitAndRunScheduledWork(t, 'refusal-member', recordId))
    } finally {
      vi.unstubAllGlobals()
    }
    const record = await t.run(async (ctx) => ctx.db.get(recordId))
    expect(record?.assessment?.refusals).toEqual(['expirationDateLegible'])
    expect(record?.assessment?.expirationDateLegible).toBeUndefined()
    const rows = await t.withIdentity({ subject: 'refusal-admin' }).query(api.admin.memberVerifications, { status: 'pending' })
    expect(rows[0]?.identityRecord?.assessmentFlagged).toBe(true)
  })

  it('keeps the submission and records a failure code when the signal provider fails', async () => {
    const t = createTest()
    await insertUser(t, 'signal-failure-member')
    const { recordId, userId } = await insertSubmittableRecord(t, 'signal-failure-member')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) } as unknown as Response)))
    try {
      await withProviderEnv('test-key', () => submitAndRunScheduledWork(t, 'signal-failure-member', recordId))
    } finally {
      vi.unstubAllGlobals()
    }
    const state = await t.run(async (ctx) => ({
      record: await ctx.db.get(recordId),
      request: await ctx.db.query('verificationRequests').withIndex('by_user_current', (q) => q.eq('userId', userId).eq('isCurrent', true)).unique(),
      audits: await ctx.db.query('auditLogs').collect(),
    }))
    expect(state.record?.stage).toBe('ready_for_review')
    expect(state.record?.assessment).toBeUndefined()
    expect(state.record?.assessmentFailureCode).toBe('provider_error')
    expect(state.request?.adminStatus).toBe('pending')
    expect(state.audits.some((audit) => audit.action === 'identity_record.assessment_failed')).toBe(true)
  })

  it('records a missing provider key as unavailable without touching the submission', async () => {
    const t = createTest()
    await insertUser(t, 'signal-unavailable-member')
    const { recordId } = await insertSubmittableRecord(t, 'signal-unavailable-member')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      await withProviderEnv(undefined, () => submitAndRunScheduledWork(t, 'signal-unavailable-member', recordId))
    } finally {
      vi.unstubAllGlobals()
    }
    const record = await t.run(async (ctx) => ctx.db.get(recordId))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(record?.stage).toBe('ready_for_review')
    expect(record?.assessmentFailureCode).toBe('provider_unavailable')
  })

  it('stays best effort when the attempt is superseded before the failure is recorded', async () => {
    const t = createTest()
    await insertUser(t, 'signal-superseded-member')
    const { recordId, requestId, userId } = await insertSubmittableRecord(t, 'signal-superseded-member')
    await t.run(async (ctx) => ctx.db.patch(recordId, { stage: 'ready_for_review' }))
    // Supersede the attempt, exactly as a fresh start would, so every recorder
    // rejects when the scheduled action runs.
    await t.run(async (ctx) => ctx.db.patch(requestId, { isCurrent: false, supersededAt: Date.now(), updatedAt: Date.now() }))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) } as unknown as Response)))
    try {
      const result = await withProviderEnv('test-key', () => t.action(internal.identityRecords.assessConfirmedDetails, { userId, identityRecordId: recordId }))
      expect(result).toEqual({ assessed: false })
    } finally {
      vi.unstubAllGlobals()
    }
    const record = await t.run(async (ctx) => ctx.db.get(recordId))
    expect(record?.assessmentFailureCode).toBeUndefined()
  })
})

describe('identity rejections reach the member', () => {
  it('raises ConvexError so the message survives production redaction', async () => {
    const t = createTest()
    await insertUser(t, 'convex-error-member')
    const member = t.withIdentity({ subject: 'convex-error-member' })
    const started = await member.mutation(api.identityRecords.start, { reason: 'member', selectedIdType: 'passport' })
    if (started.mode !== 'started') throw new Error('Expected a started attempt')
    const identityRecordId = started.identityRecordId
    await member.action(api.identityRecords.uploadImage, { identityRecordId, kind: 'id_front', bytes: imageBytes, contentType: 'image/jpeg' })
    await t.mutation(internal.identityRecords.prepareExtraction, { clerkUserId: 'convex-error-member', identityRecordId })
    await t.mutation(internal.identityRecords.completeExtraction, { clerkUserId: 'convex-error-member', identityRecordId, extraction: { ...extraction, idType: 'passport' } as any })

    // An expired ID is the exact case a member hit in production and could not read.
    const failure = await member.mutation(api.identityRecords.confirmFields, {
      identityRecordId,
      fullLegalName: 'Example Member',
      dateOfBirth: extraction.dateOfBirth,
      idType: 'passport',
      expirationDate: '2020-01-01',
    }).then(() => null, (error: unknown) => error)

    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe('This ID is expired. Use a current government ID.')
    // Convex forwards only ConvexError data to the client, which is what makes the
    // sentence above readable on the member's screen.
    expect((failure as { data?: unknown }).data).toBe('This ID is expired. Use a current government ID.')
  })
})

describe('identity read failure reasons', () => {
  const image = { bytes: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/jpeg' }

  function qualityAnswers(readability: number | undefined, defect: string | undefined) {
    return {
      model: 'gpt-6-luna',
      answers: [
        ...(readability === undefined ? [{ type: 'refusal', name: 'readability' }] : [{ type: 'score', name: 'readability', score: readability }]),
        ...(defect === undefined ? [] : [{ type: 'choice', name: 'defect', choice: defect }]),
      ],
      usage: { input_tokens: 1200, output_tokens: 0 },
    }
  }

  it('asks only two narrow questions about the photo', () => {
    const request = buildImageQualityRequest(image)
    expect(request.questions.map((question) => question.name)).toEqual(['readability', 'defect'])
    expect(request.questions.map((question) => question.type)).toEqual(['score', 'choice'])
    const readability = request.questions[0] as { levels: Array<{ label: string }> }
    expect(readability.levels.map((level) => level.label)).toEqual(['unreadable', 'mostly_unreadable', 'usable', 'clear'])
    expect(JSON.stringify(request)).toContain('data:image/jpeg;base64,AQID')
    expect(JSON.stringify(request).toLowerCase()).not.toContain('selfie')
  })

  it('never blames the photo when the provider itself was unavailable', () => {
    expect(extractionFailureReasonFor('provider_unavailable', undefined)).toBe('service_unavailable')
    expect(extractionFailureReasonFor('provider_unavailable', { readability: 0.1, defect: 'blur' })).toBe('service_unavailable')
  })

  it('names a structural problem even when the photo is perfectly readable', () => {
    // A readable back of an ID is still the wrong photo, so the readability score
    // must not override it.
    expect(extractionFailureReasonFor('provider_error', { readability: 3, defect: 'wrong_side' })).toBe('wrong_side')
    expect(extractionFailureReasonFor('provider_error', { readability: 3, defect: 'cropped' })).toBe('cropped')
    expect(extractionFailureReasonFor('provider_error', { readability: 3, defect: 'not_a_document' })).toBe('not_a_document')
  })

  it('names the blur or glare when the photo is below the usable score', () => {
    expect(extractionFailureReasonFor('provider_error', { readability: 0.4, defect: 'blur' })).toBe('blur')
    expect(extractionFailureReasonFor('provider_error', { readability: 1.4, defect: 'glare' })).toBe('glare')
    expect(extractionFailureReasonFor('provider_error', { readability: 0.4, defect: 'none' })).toBe('unreadable')
    expect(extractionFailureReasonFor('provider_error', { readability: 0.4 })).toBe('unreadable')
  })

  it('treats a readable photo as our problem rather than the member\u2019s', () => {
    expect(extractionFailureReasonFor('extraction_failed', { readability: 1.5, defect: 'none' })).toBe('retryable')
    expect(extractionFailureReasonFor('extraction_failed', { readability: 3, defect: 'none' })).toBe('retryable')
  })

  it('falls back to unknown when there is no verdict to trust', () => {
    expect(extractionFailureReasonFor('provider_error', undefined)).toBe('unknown')
    expect(extractionFailureReasonFor('invalid_extraction', {})).toBe('unknown')
  })

  it('records the named reason and a clean message when the read fails and the photo is blurred', async () => {
    const t = createTest()
    await insertUser(t, 'blurred-read-member')
    const { recordId } = await insertDraftRecord(t, 'blurred-read-member')
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
      urls.push(String(url))
      if (String(url).includes('/decisions')) {
        return { ok: true, json: async () => qualityAnswers(0.3, 'blur') } as unknown as Response
      }
      return { ok: false, status: 500, json: async () => ({}) } as unknown as Response
    }))
    try {
      await withProviderEnv('test-key', async () => {
        await expect(t.withIdentity({ subject: 'blurred-read-member' }).action(api.identityRecords.extract, { identityRecordId: recordId, thirdPartyProcessingConsent: true }))
          .rejects.toThrow('We could not read that ID.')
      })
    } finally {
      vi.unstubAllGlobals()
    }
    expect(urls.filter((url) => url.includes('/decisions'))).toHaveLength(1)
    const state = await t.run(async (ctx) => ({ record: await ctx.db.get(recordId), audits: await ctx.db.query('auditLogs').collect() }))
    expect(state.record?.stage).toBe('failed')
    expect(state.record?.extractionFailureCode).toBe('provider_error')
    expect(state.record?.extractionFailureReason).toBe('blur')
    expect(state.audits.some((audit) => audit.action === 'identity_record.extraction_failed' && audit.note === 'provider_error:blur')).toBe(true)
    // The member's failed attempt is resumable and carries the reason the card shows.
    const current = await t.withIdentity({ subject: 'blurred-read-member' }).query(api.identityRecords.current, {})
    expect(current).toMatchObject({ stage: 'failed', extractionFailureReason: 'blur' })
  })

  it('does not call the photo check when the provider key is missing', async () => {
    const t = createTest()
    await insertUser(t, 'no-key-read-member')
    const { recordId } = await insertDraftRecord(t, 'no-key-read-member')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      await withProviderEnv(undefined, async () => {
        await expect(t.withIdentity({ subject: 'no-key-read-member' }).action(api.identityRecords.extract, { identityRecordId: recordId, thirdPartyProcessingConsent: true }))
          .rejects.toThrow('We could not read that ID.')
      })
    } finally {
      vi.unstubAllGlobals()
    }
    expect(fetchSpy).not.toHaveBeenCalled()
    const record = await t.run(async (ctx) => ctx.db.get(recordId))
    expect(record?.extractionFailureCode).toBe('provider_unavailable')
    expect(record?.extractionFailureReason).toBe('service_unavailable')
  })

  it('treats a provider response with no usable fields as a failed read', async () => {
    const t = createTest()
    await insertUser(t, 'empty-read-member')
    const { recordId } = await insertDraftRecord(t, 'empty-read-member')
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
      if (String(url).includes('/decisions')) {
        return { ok: true, json: async () => ({ answers: [{ type: 'score', name: 'readability', score: 0.2 }, { type: 'choice', name: 'defect', choice: 'blur' }] }) } as unknown as Response
      }
      // A structurally valid extraction that contains nothing at all.
      return {
        ok: true,
        json: async () => ({
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
            fullLegalName: null, dateOfBirth: null, idType: null, expirationDate: null, nationality: null,
            signals: { fullLegalName: 'needs_review', dateOfBirth: 'needs_review', idType: 'needs_review', expirationDate: 'needs_review', nationality: 'needs_review' },
            needsReview: true,
          }) }] }],
        }),
      } as unknown as Response
    }))
    try {
      await withProviderEnv('test-key', async () => {
        await expect(t.withIdentity({ subject: 'empty-read-member' }).action(api.identityRecords.extract, { identityRecordId: recordId, thirdPartyProcessingConsent: true }))
          .rejects.toThrow('We could not read that ID.')
      })
    } finally {
      vi.unstubAllGlobals()
    }
    const state = await t.run(async (ctx) => ({ record: await ctx.db.get(recordId), audits: await ctx.db.query('auditLogs').collect() }))
    // Not confirmation_required: the member goes back to the upload step instead
    // of facing a blank details form with no way back.
    expect(state.record?.stage).toBe('failed')
    expect(state.record?.extractionFailureCode).toBe('empty_extraction')
    expect(state.record?.extractionFailureReason).toBe('blur')
    expect(state.record?.extraction).toBeUndefined()
    expect(state.audits.some((audit) => audit.action === 'identity_record.extraction_failed' && audit.note === 'empty_extraction:blur')).toBe(true)
  })

  it('still accepts a read that finds only one of the two required fields', async () => {
    const t = createTest()
    await insertUser(t, 'partial-read-member')
    const { recordId } = await insertDraftRecord(t, 'partial-read-member')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
          fullLegalName: 'Partial Member', dateOfBirth: null, idType: 'national_id', expirationDate: null, nationality: 'PH',
          signals: { fullLegalName: 'high', dateOfBirth: 'needs_review', idType: 'high', expirationDate: 'needs_review', nationality: 'high' },
          needsReview: true,
        }) }] }],
      }),
    } as unknown as Response)))
    try {
      await withProviderEnv('test-key', async () => {
        const result = await t.withIdentity({ subject: 'partial-read-member' }).action(api.identityRecords.extract, { identityRecordId: recordId, thirdPartyProcessingConsent: true })
        expect(result.fullLegalName).toBe('Partial Member')
      })
    } finally {
      vi.unstubAllGlobals()
    }
    const record = await t.run(async (ctx) => ctx.db.get(recordId))
    expect(record?.stage).toBe('confirmation_required')
  })

  it('keeps the unknown reason when the photo check also fails', async () => {
    const t = createTest()
    await insertUser(t, 'no-verdict-read-member')
    const { recordId } = await insertDraftRecord(t, 'no-verdict-read-member')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) } as unknown as Response)))
    try {
      await withProviderEnv('test-key', async () => {
        await expect(t.withIdentity({ subject: 'no-verdict-read-member' }).action(api.identityRecords.extract, { identityRecordId: recordId, thirdPartyProcessingConsent: true }))
          .rejects.toThrow('We could not read that ID.')
      })
    } finally {
      vi.unstubAllGlobals()
    }
    const record = await t.run(async (ctx) => ctx.db.get(recordId))
    expect(record?.extractionFailureCode).toBe('provider_error')
    expect(record?.extractionFailureReason).toBe('unknown')
  })
})
