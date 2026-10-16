import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const modules = convexModules
const SECRET_KEY = 'sk_test_webhook_route'
const PUBLIC_KEY = 'pk_test_webhook_route'
const WEBHOOK_SECRET = 'whsec_webhook_route'
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

function nowSeconds() {
  return Math.floor(Date.now() / 1_000)
}

async function sign(secret: string, body: string, timestamp: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`))
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `t=${timestamp},te=${hex}`
}

function paymentEvent(eventId: string, intentId: string, livemode = false) {
  return JSON.stringify({
    data: {
      id: eventId,
      attributes: {
        type: 'payment.paid',
        livemode,
        data: { id: intentId, type: 'payment_intent', attributes: {} },
      },
    },
  })
}

function transferEvent(eventId: string, transferId: string) {
  return JSON.stringify({
    data: {
      id: eventId,
      attributes: {
        type: 'transfer.outward.successful',
        livemode: false,
        data: { id: transferId },
      },
    },
  })
}

function providerJson(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
}

async function post(
  t: ReturnType<typeof createTest>,
  body: string,
  signature: string | undefined,
  contentType = 'application/json',
) {
  const headers: Record<string, string> = { 'content-type': contentType }
  if (signature) headers['Paymongo-Signature'] = signature
  return await t.fetch('/paymongo/webhook', { method: 'POST', headers, body })
}

beforeEach(() => {
  previousEnv = {}
  for (const key of ENV_KEYS) previousEnv[key] = process.env[key]
  process.env.PAYMONGO_SECRET_KEY = SECRET_KEY
  process.env.PAYMONGO_PUBLIC_KEY = PUBLIC_KEY
  process.env.PAYMONGO_MODE = 'test'
  process.env.PAYMONGO_WEBHOOK_SECRET = WEBHOOK_SECRET
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

describe('PayMongo webhook route', () => {
  it('rejects unsigned, wrongly signed, stale, and mode-mismatched events without contacting PayMongo', async () => {
    const t = createTest()
    const provider = vi.fn()
    vi.stubGlobal('fetch', provider)
    const body = paymentEvent('evt_auth', 'pi_auth')

    expect((await post(t, body, undefined)).status).toBe(401)
    expect((await post(t, body, await sign('whsec_other', body, nowSeconds()))).status).toBe(401)
    expect((await post(t, body, await sign(WEBHOOK_SECRET, body, nowSeconds() - 10_000))).status).toBe(401)

    const liveMode = paymentEvent('evt_mode', 'pi_mode', true)
    expect((await post(t, liveMode, await sign(WEBHOOK_SECRET, liveMode, nowSeconds()))).status).toBe(400)

    expect(provider).not.toHaveBeenCalled()
  })

  it('requires JSON and bounds the raw body before verification', async () => {
    const t = createTest()
    const provider = vi.fn()
    vi.stubGlobal('fetch', provider)
    const body = paymentEvent('evt_type', 'pi_type')

    expect((await post(t, body, await sign(WEBHOOK_SECRET, body, nowSeconds()), 'text/plain')).status).toBe(415)
    expect((await post(t, 'a'.repeat(300_000), undefined)).status).toBe(413)

    expect(provider).not.toHaveBeenCalled()
  })

  it('credits a signed payment.paid event once and acknowledges the identical retry', async () => {
    const t = createTest()
    const topUpId = await t.run(async (ctx) => {
      const now = Date.now()
      const memberId = await ctx.db.insert('users', {
        clerkUserId: 'route-member',
        displayName: 'Route Member',
        role: 'member',
        verificationStatus: 'approved',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      return await ctx.db.insert('paymongoTopUps', {
        beneficiaryUserId: memberId,
        purpose: 'member_booking_balance',
        amountCentavos: 25_000,
        currency: 'PHP',
        mode: 'test',
        status: 'awaiting_payment',
        providerIntentId: 'pi_route_paid',
        createdAt: now,
        updatedAt: now,
      })
    })
    const provider = vi.fn(async () => providerJson({
      data: {
        id: 'pi_route_paid',
        type: 'payment_intent',
        attributes: {
          amount: 25_000,
          currency: 'PHP',
          status: 'succeeded',
          livemode: false,
          payment_method_allowed: ['qrph'],
        },
      },
    }))
    vi.stubGlobal('fetch', provider)

    const body = paymentEvent('evt_route_paid', 'pi_route_paid')
    const signature = await sign(WEBHOOK_SECRET, body, nowSeconds())

    expect((await post(t, body, signature)).status).toBe(200)
    expect((await post(t, body, signature)).status).toBe(200)

    const state = await t.run(async (ctx) => ({
      topUp: await ctx.db.get(topUpId),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.topUp?.status).toBe('paid')
    expect(state.transactions.filter((row) => row.kind === 'paymongo_member_credit')).toHaveLength(1)
    expect(provider).toHaveBeenCalledTimes(1)
  })

  it('routes a transfer event to the withdrawal handler', async () => {
    const t = createTest()
    const withdrawalId = await t.run(async (ctx) => {
      const now = Date.now()
      const companionUserId = await ctx.db.insert('users', {
        clerkUserId: 'route-companion',
        displayName: 'Route Companion',
        role: 'companion',
        verificationStatus: 'approved',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('walletAccounts', {
        deterministicKey: `member:${companionUserId}:booking`,
        accountType: 'member_booking',
        ownerUserId: companionUserId,
        currency: 'PHP',
        availableCentavos: 0,
        reservedCentavos: 50_000,
        pendingCentavos: 0,
        createdAt: now,
        updatedAt: now,
      })
      const payoutMethodId = await ctx.db.insert('payoutMethods', {
        companionUserId,
        provider: 'instapay',
        institutionBic: 'PAEYPHM2XXX',
        institutionName: 'PayMongo Wallet',
        accountName: 'Route Companion',
        accountNumberCiphertext: 'ciphertext',
        accountNumberIv: 'iv',
        accountNumberLast4: '4321',
        status: 'active',
        mode: 'test',
        availableAt: now,
        createdAt: now,
        updatedAt: now,
      })
      return await ctx.db.insert('withdrawals', {
        companionUserId,
        payoutMethodId,
        amountCentavos: 50_000,
        providerFeeCentavos: 1_000,
        currency: 'PHP',
        status: 'pending',
        mode: 'test',
        destinationInstitutionName: 'PayMongo Wallet',
        destinationAccountName: 'Route Companion',
        destinationAccountLast4: '4321',
        referenceNumber: 'lbf route123',
        idempotencyKey: 'withdrawal:route:submit',
        providerTransferId: 'tr_route',
        attemptCount: 1,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    })
    const provider = vi.fn(async () => providerJson({
      data: {
        id: 'tr_route',
        attributes: {
          status: 'succeeded',
          amount: 50_000,
          currency: 'PHP',
          reference_number: 'lbf route123',
          fee: 1_000,
        },
      },
    }))
    vi.stubGlobal('fetch', provider)

    const body = transferEvent('evt_route_transfer', 'tr_route')
    expect((await post(t, body, await sign(WEBHOOK_SECRET, body, nowSeconds()))).status).toBe(200)

    const state = await t.run(async (ctx) => ({
      withdrawal: await ctx.db.get(withdrawalId),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.withdrawal?.status).toBe('succeeded')
    expect(state.transactions.filter((row) => row.kind === 'payout_complete')).toHaveLength(1)
  })
})
