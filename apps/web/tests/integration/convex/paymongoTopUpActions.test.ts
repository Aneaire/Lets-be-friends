import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
const AMOUNT = 25_000
const INTENT_ID = 'pi_topup_action'
const CLIENT_KEY = 'ck_topup_action'
const PAYMENT_METHOD_ID = 'pm_topup_action'
const QR_IMAGE_URL = 'https://example.test/topup-action-qr.png'
const EXPIRES_AT_SECONDS = 1_800_000_000
const ENV_KEYS = [
  'PAYMONGO_SECRET_KEY',
  'PAYMONGO_PUBLIC_KEY',
  'PAYMONGO_MODE',
  'PAYMONGO_WEBHOOK_SECRET',
  'MEMBER_WALLET_V2_ENABLED',
] as const

let previousEnv: Record<string, string | undefined> = {}

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

beforeEach(() => {
  previousEnv = {}
  for (const key of ENV_KEYS) previousEnv[key] = process.env[key]
  // Fake, non-secret values. No live provider is ever contacted.
  process.env.PAYMONGO_SECRET_KEY = 'sk_test_topup_actions'
  process.env.PAYMONGO_PUBLIC_KEY = 'pk_test_topup_actions'
  process.env.PAYMONGO_MODE = 'test'
  delete process.env.PAYMONGO_WEBHOOK_SECRET
  process.env.MEMBER_WALLET_V2_ENABLED = 'true'
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = previousEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function seedMember(
  t: ReturnType<typeof convexTest>,
  subject: string,
  options: { suspended?: boolean } = {},
) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      role: 'member',
      verificationStatus: 'approved',
      suspended: options.suspended ?? false,
      createdAt: now,
      updatedAt: now,
    })
  })
}

async function seedCompanion(t: ReturnType<typeof convexTest>, subject: string) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const userId = await ctx.db.insert('users', {
      clerkUserId: subject,
      displayName: subject,
      role: 'companion',
      verificationStatus: 'approved',
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('companionProfiles', {
      userId,
      displayName: subject,
      intro: 'Companion for top-up action tests.',
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
    return userId
  })
}

type ProviderRoute = 'intent' | 'method' | 'attach' | 'retrieve'
type ProviderCall = { route: ProviderRoute; method: string; url: string; body: any }

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}

function mockProvider(options: { fail?: ProviderRoute } = {}) {
  const calls: ProviderCall[] = []
  const intentIds: string[] = []
  let created = 0
  const fetchMock = vi.fn(async (url: string, init: { method?: string; body?: string } | undefined) => {
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    const path = String(url)
    const route: ProviderRoute = path.includes('/attach')
      ? 'attach'
      : path.endsWith('/v1/payment_intents')
        ? 'intent'
        : path.endsWith('/v1/payment_methods')
          ? 'method'
          : 'retrieve'
    calls.push({ route, method, url: path, body })
    if (options.fail === route) {
      return jsonResponse({ errors: [{ detail: 'provider unavailable' }] }, 503)
    }
    if (route === 'intent') {
      created += 1
      const intentId = `${INTENT_ID}_${created}`
      intentIds.push(intentId)
      return jsonResponse({
        data: {
          id: intentId,
          type: 'payment_intent',
          attributes: {
            amount: AMOUNT,
            currency: 'PHP',
            status: 'awaiting_payment_method',
            livemode: false,
            payment_method_allowed: ['qrph'],
            client_key: `${CLIENT_KEY}_${created}`,
          },
        },
      })
    }
    if (route === 'method') {
      return jsonResponse({ data: { id: `${PAYMENT_METHOD_ID}_${created}`, type: 'payment_method', attributes: { type: 'qrph' } } })
    }
    const intentId = route === 'attach'
      ? decodeURIComponent(path.split('/').slice(-2)[0])
      : decodeURIComponent(path.split('/').pop() ?? '')
    if (route === 'attach') {
      return jsonResponse({ data: { id: intentId, type: 'payment_intent', attributes: {} } })
    }
    return jsonResponse({
      data: {
        id: intentId,
        type: 'payment_intent',
        attributes: {
          amount: AMOUNT,
          currency: 'PHP',
          status: 'awaiting_payment_method',
          livemode: false,
          payment_method_allowed: ['qrph'],
          next_action: { code: { image_url: QR_IMAGE_URL, expires_at: EXPIRES_AT_SECONDS } },
        },
      },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls, intentIds }
}

async function financialState(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => ({
    topUps: await ctx.db.query('paymongoTopUps').collect(),
    rateLimits: await ctx.db.query('rateLimits').collect(),
    audits: await ctx.db.query('auditLogs').collect(),
    notifications: await ctx.db.query('notifications').collect(),
    walletAccounts: await ctx.db.query('walletAccounts').collect(),
    walletTransactions: await ctx.db.query('walletTransactions').collect(),
    walletEntries: await ctx.db.query('walletEntries').collect(),
    platformFeeLedger: await ctx.db.query('platformFeeLedger').collect(),
  }))
}

function expectNoFinancialWrites(state: Awaited<ReturnType<typeof financialState>>) {
  expect(state.topUps).toHaveLength(0)
  expect(state.rateLimits).toHaveLength(0)
  expect(state.audits).toHaveLength(0)
  expect(state.notifications).toHaveLength(0)
  expect(state.walletAccounts).toHaveLength(0)
  expect(state.walletTransactions).toHaveLength(0)
  expect(state.walletEntries).toHaveLength(0)
  expect(state.platformFeeLedger).toHaveLength(0)
}

describe('PayMongo top-up actions', () => {
  it('runs the member top-up action end to end without crediting the wallet before provider confirmation', async () => {
    const t = createTest()
    const memberId = await seedMember(t, 'topup-member')
    const { fetchMock, calls, intentIds } = mockProvider()

    const result = await t.withIdentity({ subject: 'topup-member' }).action(api.paymongo.createMemberTopUp, {
      amountCentavos: AMOUNT,
    })

    expect(result).toMatchObject({
      status: 'awaiting_payment',
      amountCentavos: AMOUNT,
      currency: 'PHP',
      qrImageUrl: QR_IMAGE_URL,
    })
    expect(calls.map((call) => call.route)).toEqual(['intent', 'method', 'attach', 'retrieve'])
    expect(calls.map((call) => call.method)).toEqual(['POST', 'POST', 'POST', 'GET'])
    expect(fetchMock).toHaveBeenCalledTimes(4)

    const intentAttributes = calls[0].body.data.attributes
    expect(intentAttributes).toMatchObject({
      amount: AMOUNT,
      currency: 'PHP',
      payment_method_allowed: ['qrph'],
      description: 'Lets Be Friends member booking balance top-up',
      metadata: {
        top_up_id: String(result.topUpId),
        beneficiary_user_id: String(memberId),
        purpose: 'member_booking_balance',
      },
    })

    const state = await financialState(t)
    expect(state.topUps).toHaveLength(1)
    expect(state.topUps[0]).toMatchObject({
      beneficiaryUserId: memberId,
      purpose: 'member_booking_balance',
      amountCentavos: AMOUNT,
      status: 'awaiting_payment',
      providerIntentId: intentIds[0],
      providerPaymentMethodId: `${PAYMENT_METHOD_ID}_1`,
    })
    expect(state.rateLimits).toHaveLength(1)
    expect(state.rateLimits[0]).toMatchObject({ userId: memberId, actionFamily: 'create_topup', count: 1 })
    expect(state.audits.filter((row) => row.action === 'member_wallet.top_up_started')).toHaveLength(1)
    expect(state.walletAccounts).toHaveLength(0)
    expect(state.walletTransactions).toHaveLength(0)
    expect(state.walletEntries).toHaveLength(0)
    expect(state.platformFeeLedger).toHaveLength(0)
  })

  it('runs the legacy companion top-up action end to end with the legacy purpose and no wallet credit', async () => {
    const t = createTest()
    const companionId = await seedCompanion(t, 'topup-companion')
    const { fetchMock, calls } = mockProvider()

    const result = await t.withIdentity({ subject: 'topup-companion' }).action(api.paymongo.createTopUp, {
      amountCentavos: AMOUNT,
    })

    expect(result).toMatchObject({ status: 'awaiting_payment', amountCentavos: AMOUNT, qrImageUrl: QR_IMAGE_URL })
    expect(calls.map((call) => call.route)).toEqual(['intent', 'method', 'attach', 'retrieve'])
    expect(fetchMock).toHaveBeenCalledTimes(4)

    expect(calls[0].body.data.attributes).toMatchObject({
      amount: AMOUNT,
      currency: 'PHP',
      description: 'Lets Be Friends legacy platform-fee balance top-up',
      metadata: {
        top_up_id: String(result.topUpId),
        beneficiary_user_id: String(companionId),
        purpose: 'legacy_companion_fee',
      },
    })

    const state = await financialState(t)
    expect(state.topUps).toHaveLength(1)
    expect(state.topUps[0]).toMatchObject({
      companionUserId: companionId,
      beneficiaryUserId: companionId,
      purpose: 'legacy_companion_fee',
      status: 'awaiting_payment',
    })
    expect(state.rateLimits).toHaveLength(1)
    expect(state.rateLimits[0]).toMatchObject({ userId: companionId, actionFamily: 'create_topup', count: 1 })
    expect(state.audits.filter((row) => row.action === 'platform_fee.top_up_started')).toHaveLength(1)
    expect(state.walletAccounts).toHaveLength(0)
    expect(state.walletTransactions).toHaveLength(0)
    expect(state.platformFeeLedger).toHaveLength(0)
  })

  it('consumes the 15-per-hour create_topup limit exactly once per action and rejects the 16th before any provider call', async () => {
    const t = createTest()
    const memberId = await seedMember(t, 'topup-member')
    const { fetchMock, calls } = mockProvider()
    const member = t.withIdentity({ subject: 'topup-member' })

    for (let index = 0; index < 15; index += 1) {
      await member.action(api.paymongo.createMemberTopUp, { amountCentavos: AMOUNT })
    }
    expect(calls).toHaveLength(60)

    const rateLimits = await t.run(async (ctx) => ctx.db.query('rateLimits').collect())
    expect(rateLimits).toHaveLength(1)
    expect(rateLimits[0]).toMatchObject({ userId: memberId, actionFamily: 'create_topup', count: 15 })
    expect(await t.run(async (ctx) => ctx.db.query('paymongoTopUps').collect())).toHaveLength(15)

    const callsBeforeRejection = calls.length
    await expect(member.action(api.paymongo.createMemberTopUp, { amountCentavos: AMOUNT }))
      .rejects.toThrow('hourly limit for starting top-ups')
    expect(calls).toHaveLength(callsBeforeRejection)
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeRejection)
    expect(await t.run(async (ctx) => ctx.db.query('paymongoTopUps').collect())).toHaveLength(15)
  })

  it('rejects an already rate-limited caller without a provider call, top-up, audit, or notification write', async () => {
    const t = createTest()
    const memberId = await seedMember(t, 'topup-member')
    const { fetchMock, calls } = mockProvider()
    const windowMs = 60 * 60 * 1_000
    const bucketStart = Math.floor(Date.now() / windowMs) * windowMs
    await t.run(async (ctx) => {
      await ctx.db.insert('rateLimits', {
        userId: memberId,
        actionFamily: 'create_topup',
        bucketStart,
        count: 15,
        expiresAt: bucketStart + windowMs * 2,
        createdAt: bucketStart,
        updatedAt: bucketStart,
      })
    })

    await expect(t.withIdentity({ subject: 'topup-member' }).action(api.paymongo.createMemberTopUp, {
      amountCentavos: AMOUNT,
    })).rejects.toThrow('hourly limit for starting top-ups')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
    const state = await financialState(t)
    expect(state.rateLimits).toHaveLength(1)
    expect(state.rateLimits[0].count).toBe(15)
    expect(state.topUps).toHaveLength(0)
    expect(state.audits).toHaveLength(0)
    expect(state.notifications).toHaveLength(0)
    expect(state.walletTransactions).toHaveLength(0)
    expect(state.walletEntries).toHaveLength(0)
  })

  it('rejects a signed-out caller for both top-up actions before any provider call or write', async () => {
    const t = createTest()
    await seedMember(t, 'topup-member')
    const { fetchMock } = mockProvider()

    await expect(t.action(api.paymongo.createMemberTopUp, { amountCentavos: AMOUNT }))
      .rejects.toThrow('Authentication required')
    await expect(t.action(api.paymongo.createTopUp, { amountCentavos: AMOUNT }))
      .rejects.toThrow('Authentication required')

    expect(fetchMock).not.toHaveBeenCalled()
    expectNoFinancialWrites(await financialState(t))
  })

  it('rejects a suspended member before any provider call or write', async () => {
    const t = createTest()
    await seedMember(t, 'topup-suspended', { suspended: true })
    const { fetchMock } = mockProvider()

    await expect(t.withIdentity({ subject: 'topup-suspended' }).action(api.paymongo.createMemberTopUp, {
      amountCentavos: AMOUNT,
    })).rejects.toThrow('Account is suspended')

    expect(fetchMock).not.toHaveBeenCalled()
    expectNoFinancialWrites(await financialState(t))
  })

  it('rejects an invalid amount before any provider call or write', async () => {
    const t = createTest()
    await seedMember(t, 'topup-member')
    const { fetchMock } = mockProvider()

    await expect(t.withIdentity({ subject: 'topup-member' }).action(api.paymongo.createMemberTopUp, {
      amountCentavos: 50,
    })).rejects.toThrow('between')

    expect(fetchMock).not.toHaveBeenCalled()
    expectNoFinancialWrites(await financialState(t))
  })

  it('fails closed on missing provider configuration before creating a top-up or calling the provider', async () => {
    const t = createTest()
    await seedMember(t, 'topup-member')
    const { fetchMock } = mockProvider()
    const previousSecret = process.env.PAYMONGO_SECRET_KEY
    delete process.env.PAYMONGO_SECRET_KEY
    try {
      await expect(t.withIdentity({ subject: 'topup-member' }).action(api.paymongo.createMemberTopUp, {
        amountCentavos: AMOUNT,
      })).rejects.toThrow('PAYMONGO_SECRET_KEY is not configured')
    } finally {
      if (previousSecret !== undefined) process.env.PAYMONGO_SECRET_KEY = previousSecret
    }

    expect(fetchMock).not.toHaveBeenCalled()
    expectNoFinancialWrites(await financialState(t))
  })

  it('records a failed top-up when the provider rejects intent creation without crediting the wallet', async () => {
    const t = createTest()
    await seedMember(t, 'topup-member')
    const { fetchMock } = mockProvider({ fail: 'intent' })

    await expect(t.withIdentity({ subject: 'topup-member' }).action(api.paymongo.createMemberTopUp, {
      amountCentavos: AMOUNT,
    })).rejects.toThrow('could not be started')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const state = await financialState(t)
    expect(state.topUps).toHaveLength(1)
    expect(state.topUps[0]).toMatchObject({ status: 'failed', failureCode: 'provider unavailable' })
    expect(state.topUps[0].providerIntentId).toBeUndefined()
    expect(state.rateLimits).toHaveLength(1)
    expect(state.rateLimits[0].count).toBe(1)
    expect(state.audits.filter((row) => row.action === 'member_wallet.top_up_started')).toHaveLength(1)
    expect(state.notifications).toHaveLength(0)
    expect(state.walletAccounts).toHaveLength(0)
    expect(state.walletTransactions).toHaveLength(0)
    expect(state.walletEntries).toHaveLength(0)
    expect(state.platformFeeLedger).toHaveLength(0)
  })

  it('keeps a provider-unknown top-up processing for reconciliation without crediting the wallet', async () => {
    const t = createTest()
    await seedMember(t, 'topup-member')
    const { fetchMock, intentIds } = mockProvider({ fail: 'method' })

    await expect(t.withIdentity({ subject: 'topup-member' }).action(api.paymongo.createMemberTopUp, {
      amountCentavos: AMOUNT,
    })).rejects.toThrow('still being confirmed')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const state = await financialState(t)
    expect(state.topUps).toHaveLength(1)
    expect(state.topUps[0]).toMatchObject({
      status: 'processing',
      providerIntentId: intentIds[0],
      failureCode: 'provider_result_unknown',
    })
    expect(state.notifications).toHaveLength(0)
    expect(state.walletTransactions).toHaveLength(0)
    expect(state.walletEntries).toHaveLength(0)
    expect(state.platformFeeLedger).toHaveLength(0)
  })
})
