import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { describe, expect, it } from 'vitest'
import { internal } from './_generated/api'
import schema from './schema'
import {
  normalizeCanonicalIntent,
  readPaymongoWebhookBody,
  validateCanonicalIntent,
  verifyPaymongoSignature,
} from './paymongo'

const modules = import.meta.glob('./**/*.ts')

function createTest() {
  const t = convexTest(schema, modules)
  geospatialTest.register(t)
  return t
}

async function signature(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('PayMongo trust boundary', () => {
  it('verifies only the configured mode signature inside the tolerance', async () => {
    const rawBody = '{"data":{"id":"evt_test"}}'
    const timestamp = 1_700_000_000
    const digest = await signature('whsec_test', `${timestamp}.${rawBody}`)
    const header = `t=${timestamp},te=${digest},li=${digest}`
    await expect(verifyPaymongoSignature(rawBody, header, 'whsec_test', 'test', 300, timestamp)).resolves.toBe(true)
    await expect(verifyPaymongoSignature(rawBody, `t=${timestamp},li=${digest}`, 'whsec_test', 'test', 300, timestamp)).resolves.toBe(false)
    await expect(verifyPaymongoSignature(rawBody, header, 'whsec_test', 'test', 300, timestamp + 301)).resolves.toBe(false)
  })

  it('rejects canonical amount, mode, and QR Ph method mismatches', () => {
    const intent = {
      id: 'pi_test',
      amountCentavos: 50_000,
      currency: 'PHP',
      status: 'succeeded',
      mode: 'test' as const,
      methodTypes: ['qrph'],
    }
    expect(() => validateCanonicalIntent(intent, {
      intentId: 'pi_test', amountCentavos: 50_000, currency: 'PHP', mode: 'test',
    })).not.toThrow()
    expect(() => validateCanonicalIntent({ ...intent, amountCentavos: 49_999 }, {
      intentId: 'pi_test', amountCentavos: 50_000, currency: 'PHP', mode: 'test',
    })).toThrow('amount mismatch')
    expect(() => validateCanonicalIntent({ ...intent, methodTypes: ['card'] }, {
      intentId: 'pi_test', amountCentavos: 50_000, currency: 'PHP', mode: 'test',
    })).toThrow('not QR Ph')
  })

  it('normalizes every supported PayMongo QR image response shape', () => {
    const response = (attributes: Record<string, unknown>) => ({
      data: {
        id: 'pi_qr_variants',
        type: 'payment_intent',
        attributes: {
          amount: 50_000,
          currency: 'PHP',
          status: 'awaiting_payment_method',
          livemode: false,
          payment_method_allowed: ['qrph'],
          ...attributes,
        },
      },
    })
    const variants = [
      { attributes: { next_action: { code: { image_url: 'https://example.test/code-image-url.png' } } }, expected: 'https://example.test/code-image-url.png' },
      { attributes: { next_action: { code: { image: 'data:image/png;base64,Y29kZQ==' } } }, expected: 'data:image/png;base64,Y29kZQ==' },
      { attributes: { next_action: { image_url: 'https://example.test/next-action.png' } }, expected: 'https://example.test/next-action.png' },
      { attributes: { qr_image_url: 'https://example.test/attributes.png' }, expected: 'https://example.test/attributes.png' },
    ]

    for (const variant of variants) {
      expect(normalizeCanonicalIntent(response(variant.attributes)).qrImageUrl).toBe(variant.expected)
    }
  })

  it('authorizes refresh only for the owning member-wallet beneficiary', async () => {
    const t = createTest()
    const { memberTopUpId, otherTopUpId, legacyTopUpId } = await t.run(async (ctx) => {
      const now = Date.now()
      const memberId = await ctx.db.insert('users', {
        clerkUserId: 'refresh-member', displayName: 'Refresh Member', role: 'member', verificationStatus: 'approved', suspended: false, createdAt: now, updatedAt: now,
      })
      const otherId = await ctx.db.insert('users', {
        clerkUserId: 'other-member', displayName: 'Other Member', role: 'member', verificationStatus: 'approved', suspended: false, createdAt: now, updatedAt: now,
      })
      const memberTopUpId = await ctx.db.insert('paymongoTopUps', {
        beneficiaryUserId: memberId, purpose: 'member_booking_balance', amountCentavos: 10_000, currency: 'PHP', mode: 'test', status: 'awaiting_payment', providerIntentId: 'pi_refresh_member', createdAt: now, updatedAt: now,
      })
      const otherTopUpId = await ctx.db.insert('paymongoTopUps', {
        beneficiaryUserId: otherId, purpose: 'member_booking_balance', amountCentavos: 10_000, currency: 'PHP', mode: 'test', status: 'awaiting_payment', providerIntentId: 'pi_refresh_other', createdAt: now, updatedAt: now,
      })
      const legacyTopUpId = await ctx.db.insert('paymongoTopUps', {
        hostUserId: memberId, beneficiaryUserId: memberId, purpose: 'legacy_host_fee', amountCentavos: 10_000, currency: 'PHP', mode: 'test', status: 'awaiting_payment', providerIntentId: 'pi_refresh_legacy', createdAt: now, updatedAt: now,
      })
      return { memberTopUpId, otherTopUpId, legacyTopUpId }
    })

    await expect(t.query(internal.paymongo.memberTopUpForRefresh, {
      topUpId: memberTopUpId, clerkUserId: 'refresh-member',
    })).resolves.toMatchObject({ providerIntentId: 'pi_refresh_member', purpose: 'member_booking_balance' })
    await expect(t.query(internal.paymongo.memberTopUpForRefresh, {
      topUpId: otherTopUpId, clerkUserId: 'refresh-member',
    })).rejects.toThrow('not found')
    await expect(t.query(internal.paymongo.memberTopUpForRefresh, {
      topUpId: legacyTopUpId, clerkUserId: 'refresh-member',
    })).rejects.toThrow('Only member-wallet top-ups')
  })

  it('requires JSON and bounds the exact raw body', async () => {
    await expect(readPaymongoWebhookBody(new Request('https://example.test', {
      method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}',
    }))).rejects.toMatchObject({ status: 415 })

    await expect(readPaymongoWebhookBody(new Request('https://example.test', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '12345',
    }), 4)).rejects.toMatchObject({ status: 413 })

    const body = await readPaymongoWebhookBody(new Request('https://example.test', {
      method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: '{"ok":true}',
    }))
    expect(body.text).toBe('{"ok":true}')
    expect(body.bytes).toEqual(new TextEncoder().encode('{"ok":true}'))
  })

  it('deduplicates an identical event ID and rejects a conflicting payload hash', async () => {
    const t = createTest()
    const first = await t.mutation(internal.paymongo.reserveWebhookEvent, {
      eventId: 'evt_same', rawBodyHash: 'hash-a', eventType: 'payment.paid', mode: 'test', providerIntentId: 'pi_test',
    })
    expect(first.outcome).toBe('process')
    const retry = await t.mutation(internal.paymongo.reserveWebhookEvent, {
      eventId: 'evt_same', rawBodyHash: 'hash-a', eventType: 'payment.paid', mode: 'test', providerIntentId: 'pi_test',
    })
    expect(retry.outcome).toBe('process')
    const conflict = await t.mutation(internal.paymongo.reserveWebhookEvent, {
      eventId: 'evt_same', rawBodyHash: 'hash-b', eventType: 'payment.paid', mode: 'test', providerIntentId: 'pi_test',
    })
    expect(conflict.outcome).toBe('conflict')
  })

  it('lets canonical paid state win over an out-of-order failure event exactly once', async () => {
    const t = createTest()
    const { topUpId, eventRecordId } = await t.run(async (ctx) => {
      const now = Date.now()
      const hostUserId = await ctx.db.insert('users', {
        clerkUserId: 'late-paid-host',
        displayName: 'Late Paid Host',
        role: 'friend_host',
        verificationStatus: 'approved',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      const topUpId = await ctx.db.insert('paymongoTopUps', {
        hostUserId,
        amountCentavos: 10_000,
        currency: 'PHP',
        mode: 'test',
        status: 'processing',
        providerIntentId: 'pi_late_paid',
        createdAt: now,
        updatedAt: now,
      })
      const eventRecordId = await ctx.db.insert('paymongoWebhookEvents', {
        eventId: 'evt_out_of_order_failure',
        rawBodyHash: 'hash-late-paid',
        eventType: 'payment.failed',
        mode: 'test',
        providerIntentId: 'pi_late_paid',
        status: 'received',
        receivedAt: now,
      })
      return { topUpId, eventRecordId }
    })
    const intent = {
      id: 'pi_late_paid', amountCentavos: 10_000, currency: 'PHP', status: 'succeeded', mode: 'test' as const, methodTypes: ['qrph'],
    }
    await t.mutation(internal.paymongo.applyWebhookEvent, { eventRecordId, eventType: 'payment.failed', intent })
    await t.mutation(internal.paymongo.applyWebhookEvent, { eventRecordId, eventType: 'payment.failed', intent })
    const state = await t.run(async (ctx) => ({
      topUp: await ctx.db.get(topUpId),
      ledger: await ctx.db.query('platformFeeLedger').collect(),
    }))
    expect(state.topUp?.status).toBe('paid')
    expect(state.ledger.filter((entry) => entry.kind === 'top_up_credit')).toHaveLength(1)
  })

  it('credits a provider-verified member top-up once without using the legacy host ledger', async () => {
    const t = createTest()
    const { memberId, topUpId } = await t.run(async (ctx) => {
      const now = Date.now()
      const memberId = await ctx.db.insert('users', {
        clerkUserId: 'paymongo-wallet-member',
        displayName: 'PayMongo Wallet Member',
        role: 'member',
        verificationStatus: 'approved',
        suspended: false,
        createdAt: now,
        updatedAt: now,
      })
      const topUpId = await ctx.db.insert('paymongoTopUps', {
        beneficiaryUserId: memberId,
        purpose: 'member_booking_balance',
        amountCentavos: 25_000,
        currency: 'PHP',
        mode: 'test',
        status: 'processing',
        providerIntentId: 'pi_member_wallet',
        createdAt: now,
        updatedAt: now,
      })
      return { memberId, topUpId }
    })
    const intent = {
      id: 'pi_member_wallet', amountCentavos: 25_000, currency: 'PHP', status: 'succeeded', mode: 'test' as const, methodTypes: ['qrph'],
    }
    await t.mutation(internal.paymongo.applyReconciliation, { topUpId, intent })
    await t.mutation(internal.paymongo.applyReconciliation, { topUpId, intent })
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.query('walletAccounts').withIndex('by_owner_type', (q) => q.eq('ownerUserId', memberId).eq('accountType', 'member_booking')).unique(),
      transactions: await ctx.db.query('walletTransactions').collect(),
      entries: await ctx.db.query('walletEntries').collect(),
      legacyLedger: await ctx.db.query('platformFeeLedger').collect(),
    }))
    expect(state.account).toMatchObject({ availableCentavos: 25_000, reservedCentavos: 0, pendingCentavos: 0 })
    expect(state.transactions.filter((row) => row.kind === 'paymongo_member_credit')).toHaveLength(1)
    expect(state.entries).toHaveLength(1)
    expect(state.legacyLedger).toHaveLength(0)
  })

  it('fails closed when preparing new member-wallet top-ups without the feature flag', async () => {
    const previous = process.env.MEMBER_WALLET_V2_ENABLED
    delete process.env.MEMBER_WALLET_V2_ENABLED
    try {
      const t = createTest()
      await t.run(async (ctx) => {
        const now = Date.now()
        await ctx.db.insert('users', {
          clerkUserId: 'flagged-member', displayName: 'Flagged Member', role: 'member', verificationStatus: 'approved', suspended: false, createdAt: now, updatedAt: now,
        })
      })
      await expect(t.mutation(internal.paymongo.prepareTopUp, {
        clerkUserId: 'flagged-member', amountCentavos: 10_000, mode: 'test', purpose: 'member_booking_balance',
      })).rejects.toThrow('not enabled')
    } finally {
      if (previous === undefined) delete process.env.MEMBER_WALLET_V2_ENABLED
      else process.env.MEMBER_WALLET_V2_ENABLED = previous
    }
  })
})
