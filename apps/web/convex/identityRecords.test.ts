import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { buildOpenAiIdentityRequest, parseOpenAiIdentityResponse } from './identityRecords'

const modules = import.meta.glob('./**/*.ts')

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
      const recordId = await ctx.db.insert('identityRecords', { userId, reason: 'member', source: 'in_app', stage: 'ready_for_review', selectedIdType: 'passport', createdAt: now, updatedAt: now })
      const requestId = await ctx.db.insert('verificationRequests', { userId, reason: 'member', personaStatus: 'not_started', personaDecision: 'unknown', verificationSource: 'in_app', identityRecordId: recordId, identityStage: 'ready_for_review', adminStatus: 'pending', isCurrent: true, attempt: 1, createdAt: now, updatedAt: now })
      await ctx.db.patch(recordId, { verificationRequestId: requestId })
      return { requestId, recordId }
    })
    expect((await t.run(async (ctx) => ctx.db.get(userId)))?.verificationStatus).not.toBe('approved')
    await t.withIdentity({ subject: 'identity-admin' }).mutation(api.admin.reviewMemberVerification, { verificationRequestId: requestId, decision: 'approved' })
    const approved = await t.run(async (ctx) => ({ user: await ctx.db.get(userId), record: await ctx.db.get(recordId) }))
    expect(approved.user).toMatchObject({ verificationStatus: 'approved', verificationSource: 'in_app' })
    expect(approved.record?.stage).toBe('approved')
  })
})
