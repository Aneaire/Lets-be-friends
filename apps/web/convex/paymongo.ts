import { BOOKING_CURRENCY, validateTopUpCentavos } from '@lets-be-friends/shared'
import { action, internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { memberWalletV2Enabled, settleTopUpInTransaction } from './finance'
import { writeAudit } from './lib'

const PAYMONGO_API_BASE_URL = 'https://api.paymongo.com'
const PAYMONGO_TIMEOUT_MS = 10_000
const QR_FALLBACK_LIFETIME_MS = 30 * 60 * 1_000
const STALE_CREATION_MS = 10 * 60 * 1_000
export const MAX_PAYMONGO_WEBHOOK_BYTES = 256 * 1_024

const canonicalIntentValidator = v.object({
  id: v.string(),
  amountCentavos: v.number(),
  currency: v.string(),
  status: v.string(),
  mode: v.union(v.literal('test'), v.literal('live')),
  methodTypes: v.array(v.string()),
  qrImageUrl: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
})

export type PaymongoMode = 'test' | 'live'
export type CanonicalPaymongoIntent = {
  id: string
  amountCentavos: number
  currency: string
  status: string
  mode: PaymongoMode
  methodTypes: string[]
  qrImageUrl?: string
  expiresAt?: number
}

type TopUpPurpose = 'legacy_host_fee' | 'member_booking_balance'
type TopUpResult = {
  topUpId: Id<'paymongoTopUps'>
  status: 'awaiting_payment' | 'processing'
  amountCentavos: number
  currency: 'PHP'
  qrImageUrl?: string
  expiresAt?: number
}

export const createTopUp = action({
  args: { amountCentavos: v.number() },
  handler: async (ctx, args): Promise<TopUpResult> => createTopUpForPurpose(ctx, args.amountCentavos, 'legacy_host_fee'),
})

export const createMemberTopUp = action({
  args: { amountCentavos: v.number() },
  handler: async (ctx, args): Promise<TopUpResult> => {
    if (!memberWalletV2Enabled()) throw new Error('Member-wallet top-ups are not enabled')
    return await createTopUpForPurpose(ctx, args.amountCentavos, 'member_booking_balance')
  },
})

async function createTopUpForPurpose(ctx: any, requestedAmountCentavos: number, purpose: TopUpPurpose): Promise<TopUpResult> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Authentication required')
  const amountCentavos = validateTopUpCentavos(requestedAmountCentavos)
  const config = paymongoConfig()
  const prepared = await ctx.runMutation(internal.paymongo.prepareTopUp, {
    clerkUserId: identity.subject,
    amountCentavos,
    mode: config.mode,
    purpose,
  })

  let providerIntentId: string | undefined
  try {
    const createdIntent = await paymongoRequest('/v1/payment_intents', {
      method: 'POST',
      config,
      idempotencyKey: `topup:${prepared.topUpId}:intent`,
      body: {
        data: {
          attributes: {
            amount: amountCentavos,
            payment_method_allowed: ['qrph'],
            currency: BOOKING_CURRENCY,
            description: purpose === 'member_booking_balance'
              ? 'Lets Be Friends member booking balance top-up'
              : 'Lets Be Friends legacy platform-fee balance top-up',
            metadata: {
              top_up_id: String(prepared.topUpId),
              beneficiary_user_id: String(prepared.beneficiaryUserId),
              purpose,
            },
          },
        },
      },
    })
    providerIntentId = providerResourceId(createdIntent, 'payment_intent')
    const providerClientKey = paymentIntentClientKey(createdIntent)
    if (!providerIntentId || !providerClientKey) throw new Error('PayMongo did not return a Payment Intent ID and client key')
    await ctx.runMutation(internal.paymongo.attachProviderIntent, { topUpId: prepared.topUpId, providerIntentId, providerClientKey })

    const paymentMethod = await paymongoRequest('/v1/payment_methods', {
      method: 'POST',
      config,
      idempotencyKey: `topup:${prepared.topUpId}:method`,
      authorization: 'public',
      body: { data: { attributes: { type: 'qrph', expiry_seconds: QR_FALLBACK_LIFETIME_MS / 1_000 } } },
    })
    const providerPaymentMethodId = providerResourceId(paymentMethod, 'payment_method')
    if (!providerPaymentMethodId) throw new Error('PayMongo did not return a QR Ph Payment Method ID')

    await paymongoRequest(`/v1/payment_intents/${encodeURIComponent(providerIntentId)}/attach`, {
      method: 'POST',
      config,
      idempotencyKey: `topup:${prepared.topUpId}:attach`,
      authorization: 'public',
      body: { data: { attributes: { payment_method: providerPaymentMethodId, client_key: providerClientKey } } },
    })
    const canonical = await retrievePaymongoIntent(providerIntentId, config)
    validateCanonicalIntent(canonical, {
      intentId: providerIntentId,
      amountCentavos,
      currency: BOOKING_CURRENCY,
      mode: config.mode,
    })
    const expiresAt = canonical.expiresAt ?? Date.now() + QR_FALLBACK_LIFETIME_MS
    await ctx.runMutation(internal.paymongo.markQrReady, {
      topUpId: prepared.topUpId,
      providerPaymentMethodId,
      providerStatus: canonical.status,
      qrImageUrl: canonical.qrImageUrl,
      expiresAt,
    })
    return {
      topUpId: prepared.topUpId,
      status: 'awaiting_payment',
      amountCentavos,
      currency: BOOKING_CURRENCY,
      qrImageUrl: canonical.qrImageUrl,
      expiresAt,
    }
  } catch (error) {
    await ctx.runMutation(internal.paymongo.recordCreationFailure, {
      topUpId: prepared.topUpId,
      failureCode: providerIntentId ? 'provider_result_unknown' : paymongoFailureCode(error),
    })
    if (providerIntentId) throw new Error('QR creation is still being confirmed with PayMongo. The balance screen will reconcile it automatically.')
    throw new Error('PayMongo QR Ph top-up could not be started. Please try again shortly.')
  }
}

export const prepareTopUp = internalMutation({
  args: {
    clerkUserId: v.string(),
    amountCentavos: v.number(),
    mode: v.union(v.literal('test'), v.literal('live')),
    purpose: v.optional(v.union(v.literal('legacy_host_fee'), v.literal('member_booking_balance'))),
  },
  handler: async (ctx, args) => {
    validateTopUpCentavos(args.amountCentavos)
    const user = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', args.clerkUserId)).unique()
    if (!user) throw new Error('Profile sync required')
    if (user.suspended) throw new Error('Account is suspended')
    const purpose = args.purpose ?? 'legacy_host_fee'
    if (purpose === 'member_booking_balance' && !memberWalletV2Enabled()) throw new Error('Member-wallet top-ups are not enabled')
    if (purpose === 'legacy_host_fee') {
      const host = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', user._id)).first()
      if (!host || host.status !== 'approved') throw new Error('An approved Friend Host profile is required to top up')
    }

    const now = Date.now()
    const existing = purpose === 'member_booking_balance'
      ? await ctx.db.query('paymongoTopUps').withIndex('by_beneficiary_created_at', (q) => q.eq('beneficiaryUserId', user._id)).order('desc').take(10)
      : await ctx.db.query('paymongoTopUps').withIndex('by_host_created_at', (q) => q.eq('hostUserId', user._id)).order('desc').take(10)
    for (const topUp of existing) {
      if ((topUp.purpose ?? 'legacy_host_fee') !== purpose) continue
      if (!['creating', 'awaiting_payment', 'processing'].includes(topUp.status)) continue
      if (topUp.status === 'creating' && !topUp.providerIntentId && topUp.createdAt <= now - STALE_CREATION_MS) {
        await ctx.db.patch(topUp._id, { status: 'failed', failedAt: now, failureCode: 'stale_creation', updatedAt: now })
        continue
      }
      if (topUp.expiresAt !== undefined && topUp.expiresAt <= now) {
        await ctx.db.patch(topUp._id, { status: 'expired', expiredAt: now, updatedAt: now })
        continue
      }
      throw new Error('An unresolved QR Ph top-up is already active')
    }

    const topUpId = await ctx.db.insert('paymongoTopUps', {
      hostUserId: purpose === 'legacy_host_fee' ? user._id : undefined,
      beneficiaryUserId: user._id,
      purpose,
      amountCentavos: args.amountCentavos,
      currency: BOOKING_CURRENCY,
      mode: args.mode,
      status: 'creating',
      createdAt: now,
      updatedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: user._id,
      action: purpose === 'member_booking_balance' ? 'member_wallet.top_up_started' : 'platform_fee.top_up_started',
      targetType: 'paymongoTopUp',
      targetId: String(topUpId),
      after: { amountCentavos: args.amountCentavos, currency: BOOKING_CURRENCY, mode: args.mode, purpose },
    })
    return { topUpId, beneficiaryUserId: user._id }
  },
})

export const attachProviderIntent = internalMutation({
  args: { topUpId: v.id('paymongoTopUps'), providerIntentId: v.string(), providerClientKey: v.string() },
  handler: async (ctx, args) => {
    const topUp = await ctx.db.get(args.topUpId)
    if (!topUp) throw new Error('Top-up not found')
    if (topUp.providerIntentId && topUp.providerIntentId !== args.providerIntentId) {
      throw new Error('Top-up is already attached to another Payment Intent')
    }
    const duplicate = await ctx.db.query('paymongoTopUps').withIndex('by_provider_intent_id', (q) => q.eq('providerIntentId', args.providerIntentId)).first()
    if (duplicate && duplicate._id !== topUp._id) throw new Error('Payment Intent is already attached to another top-up')
    await ctx.db.patch(topUp._id, {
      providerIntentId: args.providerIntentId,
      providerClientKey: args.providerClientKey,
      status: 'processing',
      updatedAt: Date.now(),
    })
  },
})

export const markQrReady = internalMutation({
  args: {
    topUpId: v.id('paymongoTopUps'),
    providerPaymentMethodId: v.string(),
    providerStatus: v.string(),
    qrImageUrl: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const topUp = await ctx.db.get(args.topUpId)
    if (!topUp) throw new Error('Top-up not found')
    if (topUp.status === 'paid') return
    await ctx.db.patch(topUp._id, {
      providerPaymentMethodId: args.providerPaymentMethodId,
      providerStatus: args.providerStatus,
      qrImageUrl: args.qrImageUrl,
      expiresAt: args.expiresAt,
      status: 'awaiting_payment',
      failureCode: undefined,
      updatedAt: Date.now(),
    })
  },
})

export const recordCreationFailure = internalMutation({
  args: { topUpId: v.id('paymongoTopUps'), failureCode: v.string() },
  handler: async (ctx, args) => {
    const topUp = await ctx.db.get(args.topUpId)
    if (!topUp || topUp.status === 'paid') return
    const now = Date.now()
    await ctx.db.patch(topUp._id, topUp.providerIntentId
      ? { status: 'processing', failureCode: args.failureCode, updatedAt: now }
      : { status: 'failed', failureCode: args.failureCode, failedAt: now, updatedAt: now })
  },
})

export const reserveWebhookEvent = internalMutation({
  args: {
    eventId: v.string(),
    rawBodyHash: v.string(),
    eventType: v.string(),
    mode: v.union(v.literal('test'), v.literal('live')),
    providerIntentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('paymongoWebhookEvents').withIndex('by_event_id', (q) => q.eq('eventId', args.eventId)).unique()
    if (existing) {
      if (existing.rawBodyHash !== args.rawBodyHash) return { outcome: 'conflict' as const }
      return { outcome: existing.status === 'processed' ? 'duplicate' as const : 'process' as const, eventRecordId: existing._id }
    }
    const eventRecordId = await ctx.db.insert('paymongoWebhookEvents', {
      ...args,
      status: 'received',
      receivedAt: Date.now(),
    })
    return { outcome: 'process' as const, eventRecordId }
  },
})

export const rejectWebhookEvent = internalMutation({
  args: { eventRecordId: v.id('paymongoWebhookEvents'), outcome: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventRecordId)
    if (!event || event.status === 'processed') return
    await ctx.db.patch(event._id, { status: 'rejected', outcome: args.outcome, processedAt: Date.now() })
  },
})

export const applyWebhookEvent = internalMutation({
  args: {
    eventRecordId: v.id('paymongoWebhookEvents'),
    eventType: v.string(),
    intent: canonicalIntentValidator,
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventRecordId)
    if (!event) throw new Error('Webhook event reservation not found')
    if (event.status === 'processed') return { outcome: 'duplicate' as const }
    const topUp = await ctx.db.query('paymongoTopUps').withIndex('by_provider_intent_id', (q) => q.eq('providerIntentId', args.intent.id)).unique()
    if (!topUp) throw new Error('Payment Intent does not belong to a top-up')
    validateCanonicalIntent(args.intent, {
      intentId: topUp.providerIntentId!,
      amountCentavos: topUp.amountCentavos,
      currency: topUp.currency,
      mode: topUp.mode,
    })

    const now = Date.now()
    if (isPaidIntentStatus(args.intent.status)) {
      if (topUp.status !== 'paid') {
        await settleTopUpInTransaction(ctx, topUp, now)
        await ctx.db.patch(topUp._id, {
          status: 'paid',
          providerStatus: args.intent.status,
          paidAt: now,
          failureCode: undefined,
          updatedAt: now,
        })
      }
    } else if (args.eventType === 'payment.paid') {
      throw new Error('Canonical Payment Intent is not paid')
    } else if (args.eventType === 'payment.failed') {
      if (topUp.status !== 'paid') {
        await ctx.db.patch(topUp._id, {
          status: 'failed',
          providerStatus: args.intent.status,
          failedAt: now,
          failureCode: 'payment_failed',
          updatedAt: now,
        })
      }
    } else if (args.eventType === 'qrph.expired') {
      if (topUp.status !== 'paid') {
        await ctx.db.patch(topUp._id, {
          status: 'expired',
          providerStatus: args.intent.status,
          expiredAt: now,
          updatedAt: now,
        })
      }
    } else {
      throw new Error('Unsupported PayMongo event type')
    }

    await ctx.db.patch(event._id, {
      status: 'processed',
      providerIntentId: args.intent.id,
      outcome: topUp.status === 'paid' ? 'already_paid' : args.eventType,
      processedAt: now,
    })
    return { outcome: 'processed' as const }
  },
})

export const pendingTopUps = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows: Doc<'paymongoTopUps'>[] = []
    for (const status of ['creating', 'awaiting_payment', 'processing', 'failed', 'expired'] as const) {
      rows.push(...await ctx.db
        .query('paymongoTopUps')
        .withIndex('by_status_updated_at', (q) => q.eq('status', status))
        .order('asc')
        .take(10))
    }
    return rows
  },
})

export const failStaleCreations = internalMutation({
  args: { topUpIds: v.array(v.id('paymongoTopUps')) },
  handler: async (ctx, args) => {
    const now = Date.now()
    let failed = 0
    for (const topUpId of args.topUpIds.slice(0, 40)) {
      const topUp = await ctx.db.get(topUpId)
      if (
        !topUp
        || topUp.status !== 'creating'
        || topUp.providerIntentId
        || topUp.createdAt > now - STALE_CREATION_MS
      ) continue
      await ctx.db.patch(topUp._id, {
        status: 'failed',
        failedAt: now,
        failureCode: 'stale_creation',
        updatedAt: now,
      })
      failed += 1
    }
    return { failed }
  },
})

export const reconcilePendingTopUps = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checked: number }> => {
    const topUps = await ctx.runQuery(internal.paymongo.pendingTopUps, {})
    const staleTopUpIds = topUps
      .filter((topUp) => topUp.status === 'creating' && !topUp.providerIntentId && topUp.createdAt <= Date.now() - STALE_CREATION_MS)
      .map((topUp) => topUp._id)
    if (staleTopUpIds.length > 0) {
      await ctx.runMutation(internal.paymongo.failStaleCreations, { topUpIds: staleTopUpIds })
    }
    const providerTopUps = topUps.filter((topUp) => Boolean(topUp.providerIntentId))
    if (providerTopUps.length === 0) return { checked: 0 }
    const config = paymongoConfig()
    let checked = 0
    for (const topUp of providerTopUps) {
      if (topUp.mode !== config.mode || !topUp.providerIntentId) continue
      checked += 1
      try {
        let intent = await retrievePaymongoIntent(topUp.providerIntentId, config)
        await ctx.runMutation(internal.paymongo.applyReconciliation, { topUpId: topUp._id, intent })
        if (
          !isPaidIntentStatus(intent.status)
          && !isFailedIntentStatus(intent.status)
          && !topUp.providerPaymentMethodId
        ) {
          if (!topUp.providerClientKey || topUp.createdAt <= Date.now() - QR_FALLBACK_LIFETIME_MS) {
            await ctx.runMutation(internal.paymongo.failUnrecoverableProviderSetup, { topUpId: topUp._id })
            continue
          }
          const paymentMethod = await paymongoRequest('/v1/payment_methods', {
            method: 'POST',
            config,
            idempotencyKey: `topup:${topUp._id}:method`,
            authorization: 'public',
            body: { data: { attributes: { type: 'qrph', expiry_seconds: QR_FALLBACK_LIFETIME_MS / 1_000 } } },
          })
          const providerPaymentMethodId = providerResourceId(paymentMethod, 'payment_method')
          if (!providerPaymentMethodId) throw new Error('PayMongo did not return a QR Ph Payment Method ID')
          await paymongoRequest(`/v1/payment_intents/${encodeURIComponent(topUp.providerIntentId)}/attach`, {
            method: 'POST',
            config,
            idempotencyKey: `topup:${topUp._id}:attach`,
            authorization: 'public',
            body: { data: { attributes: { payment_method: providerPaymentMethodId, client_key: topUp.providerClientKey } } },
          })
          intent = await retrievePaymongoIntent(topUp.providerIntentId, config)
          await ctx.runMutation(internal.paymongo.markQrReady, {
            topUpId: topUp._id,
            providerPaymentMethodId,
            providerStatus: intent.status,
            qrImageUrl: intent.qrImageUrl,
            expiresAt: intent.expiresAt ?? Date.now() + QR_FALLBACK_LIFETIME_MS,
          })
          await ctx.runMutation(internal.paymongo.applyReconciliation, { topUpId: topUp._id, intent })
        }
      } catch {
        // A bounded later run retries provider outages; no accounting state is inferred locally.
      }
    }
    return { checked }
  },
})

export const applyReconciliation = internalMutation({
  args: { topUpId: v.id('paymongoTopUps'), intent: canonicalIntentValidator },
  handler: async (ctx, args) => {
    const topUp = await ctx.db.get(args.topUpId)
    if (!topUp || !topUp.providerIntentId) return
    validateCanonicalIntent(args.intent, {
      intentId: topUp.providerIntentId,
      amountCentavos: topUp.amountCentavos,
      currency: topUp.currency,
      mode: topUp.mode,
    })
    if (topUp.status === 'paid') return
    const now = Date.now()
    if (isPaidIntentStatus(args.intent.status)) {
      await settleTopUpInTransaction(ctx, topUp, now)
      await ctx.db.patch(topUp._id, {
        status: 'paid',
        providerStatus: args.intent.status,
        paidAt: now,
        failureCode: undefined,
        updatedAt: now,
      })
      return
    }
    if (topUp.status === 'failed' || topUp.status === 'expired') {
      await ctx.db.patch(topUp._id, { providerStatus: args.intent.status, updatedAt: now })
      return
    }
    if (isFailedIntentStatus(args.intent.status)) {
      await ctx.db.patch(topUp._id, {
        status: 'failed',
        providerStatus: args.intent.status,
        failedAt: now,
        failureCode: 'payment_failed',
        updatedAt: now,
      })
      return
    }
    const expiresAt = args.intent.expiresAt ?? topUp.expiresAt
    if (expiresAt !== undefined && expiresAt <= now) {
      await ctx.db.patch(topUp._id, { status: 'expired', providerStatus: args.intent.status, expiresAt, expiredAt: now, updatedAt: now })
      return
    }
    await ctx.db.patch(topUp._id, {
      status: args.intent.status === 'processing' ? 'processing' : 'awaiting_payment',
      providerStatus: args.intent.status,
      qrImageUrl: args.intent.qrImageUrl ?? topUp.qrImageUrl,
      expiresAt,
      updatedAt: now,
    })
  },
})

export const failUnrecoverableProviderSetup = internalMutation({
  args: { topUpId: v.id('paymongoTopUps') },
  handler: async (ctx, args) => {
    const topUp = await ctx.db.get(args.topUpId)
    if (!topUp || topUp.status === 'paid' || topUp.providerPaymentMethodId) return
    const now = Date.now()
    const staleWithoutIntent = !topUp.providerIntentId && topUp.createdAt <= now - STALE_CREATION_MS
    const attachmentWindowExpired = Boolean(topUp.providerIntentId) && topUp.createdAt <= now - QR_FALLBACK_LIFETIME_MS
    if (!staleWithoutIntent && !attachmentWindowExpired) return
    await ctx.db.patch(topUp._id, {
      status: 'failed',
      failureCode: topUp.providerIntentId ? 'qr_setup_window_expired' : 'stale_creation',
      failedAt: topUp.failedAt ?? now,
      updatedAt: now,
    })
  },
})

export function paymongoConfig(): {
  secretKey: string
  publicKey: string
  webhookSecret: string | undefined
  mode: PaymongoMode
  apiBaseUrl: string
} {
  const secretKey = process.env.PAYMONGO_SECRET_KEY?.trim()
  const publicKey = process.env.PAYMONGO_PUBLIC_KEY?.trim()
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim()
  const configuredMode = process.env.PAYMONGO_MODE?.trim().toLowerCase()
  if (!secretKey) throw new Error('PAYMONGO_SECRET_KEY is not configured')
  if (!publicKey) throw new Error('PAYMONGO_PUBLIC_KEY is not configured')
  const secretMode: PaymongoMode | null = secretKey.startsWith('sk_test_') ? 'test' : secretKey.startsWith('sk_live_') ? 'live' : null
  const publicMode: PaymongoMode | null = publicKey.startsWith('pk_test_') ? 'test' : publicKey.startsWith('pk_live_') ? 'live' : null
  if (!secretMode) throw new Error('PAYMONGO_SECRET_KEY has an unsupported mode')
  if (!publicMode) throw new Error('PAYMONGO_PUBLIC_KEY has an unsupported mode')
  if (configuredMode !== 'test' && configuredMode !== 'live') throw new Error('PAYMONGO_MODE must be test or live')
  if (configuredMode !== secretMode || configuredMode !== publicMode) {
    throw new Error('PAYMONGO_MODE does not match the PayMongo keys')
  }
  return {
    secretKey,
    publicKey,
    webhookSecret,
    mode: configuredMode,
    apiBaseUrl: process.env.PAYMONGO_API_BASE_URL?.trim() || PAYMONGO_API_BASE_URL,
  }
}

export async function verifyPaymongoSignature(
  rawBody: string | Uint8Array,
  header: string,
  secret: string,
  expectedMode: PaymongoMode,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1_000),
) {
  const parts = header.split(/[ ,]+/).filter(Boolean)
  const timestamp = Number(parts.find((part) => part.startsWith('t='))?.slice(2))
  const signatureKey = expectedMode === 'live' ? 'li=' : 'te='
  const signatures = parts.filter((part) => part.startsWith(signatureKey)).map((part) => part.slice(3))
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false
  const bodyBytes = typeof rawBody === 'string' ? new TextEncoder().encode(rawBody) : rawBody
  const prefix = new TextEncoder().encode(`${timestamp}.`)
  const signedBytes = new Uint8Array(prefix.length + bodyBytes.length)
  signedBytes.set(prefix)
  signedBytes.set(bodyBytes, prefix.length)
  const expected = await hmacHex(secret, signedBytes)
  return signatures.some((signature) => timingSafeHexEqual(expected, signature))
}

export async function readPaymongoWebhookBody(request: Request, maxBytes = MAX_PAYMONGO_WEBHOOK_BYTES) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new PaymongoWebhookRequestError('Content-Type must be application/json', 415)
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PaymongoWebhookRequestError('PayMongo webhook body is too large', 413)
  }
  const reader = request.body?.getReader()
  if (!reader) return { bytes: new Uint8Array(), text: '' }
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteLength += value.byteLength
      if (byteLength > maxBytes) {
        await reader.cancel()
        throw new PaymongoWebhookRequestError('PayMongo webhook body is too large', 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new PaymongoWebhookRequestError('PayMongo webhook body must be valid UTF-8', 400)
  }
  return { bytes, text }
}

export class PaymongoWebhookRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'PaymongoWebhookRequestError'
  }
}

export function parsePaymongoWebhookEvent(event: unknown) {
  const root = asRecord(event)
  const data = asRecord(root?.data)
  const attributes = asRecord(data?.attributes)
  const eventId = stringValue(data?.id)
  const eventType = stringValue(attributes?.type)
  const livemode = attributes?.livemode
  if (!eventId || !eventType || typeof livemode !== 'boolean') throw new Error('Invalid PayMongo event envelope')
  if (!['payment.paid', 'payment.failed', 'qrph.expired'].includes(eventType)) throw new Error('Unsupported PayMongo event type')
  const resource = asRecord(attributes?.data)
  const providerIntentId = extractPaymentIntentId(resource)
  if (!providerIntentId) throw new Error('PayMongo event is missing its Payment Intent ID')
  return { eventId, eventType, mode: (livemode ? 'live' : 'test') as PaymongoMode, providerIntentId }
}

export function normalizeCanonicalIntent(response: unknown): CanonicalPaymongoIntent {
  const root = asRecord(response)
  const data = asRecord(root?.data)
  const attributes = asRecord(data?.attributes)
  const id = stringValue(data?.id)
  const amountCentavos = numberValue(attributes?.amount)
  const currency = stringValue(attributes?.currency)?.toUpperCase()
  const status = stringValue(attributes?.status)
  const livemode = attributes?.livemode
  if (!id || amountCentavos === undefined || !currency || !status || typeof livemode !== 'boolean') {
    throw new Error('PayMongo returned an incomplete Payment Intent')
  }

  const methodTypes = new Set<string>()
  for (const method of stringArray(attributes?.payment_method_allowed)) methodTypes.add(method)
  const payments = asArray(attributes?.payments)
  for (const paymentValue of payments) {
    const payment = asRecord(paymentValue)
    const paymentAttributes = asRecord(payment?.attributes)
    const source = asRecord(paymentAttributes?.source)
    const paymentMethod = asRecord(paymentAttributes?.payment_method)
    const method = stringValue(source?.type) ?? stringValue(paymentMethod?.type)
    if (method) methodTypes.add(method)
  }

  const nextAction = asRecord(attributes?.next_action)
  const code = asRecord(nextAction?.code)
  const redirect = asRecord(nextAction?.redirect)
  const qrImageUrl = stringValue(code?.image_url)
    ?? stringValue(code?.image)
    ?? stringValue(nextAction?.image_url)
    ?? stringValue(redirect?.url)
  const expiresAtSeconds = numberValue(code?.expires_at)
    ?? numberValue(nextAction?.expires_at)
    ?? numberValue(attributes?.expires_at)

  return {
    id,
    amountCentavos,
    currency,
    status,
    mode: livemode ? 'live' : 'test',
    methodTypes: [...methodTypes],
    qrImageUrl,
    expiresAt: expiresAtSeconds === undefined ? undefined : normalizeProviderTimestamp(expiresAtSeconds),
  }
}

export function validateCanonicalIntent(
  intent: CanonicalPaymongoIntent,
  expected: { intentId: string; amountCentavos: number; currency: string; mode: PaymongoMode },
) {
  if (intent.id !== expected.intentId) throw new Error('PayMongo Payment Intent ID mismatch')
  if (intent.amountCentavos !== expected.amountCentavos) throw new Error('PayMongo top-up amount mismatch')
  if (intent.currency !== expected.currency.toUpperCase()) throw new Error('PayMongo top-up currency mismatch')
  if (intent.mode !== expected.mode) throw new Error('PayMongo mode mismatch')
  if (!intent.methodTypes.includes('qrph')) throw new Error('PayMongo Payment Intent is not QR Ph')
}

export async function sha256Hex(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
  return bytesToHex(new Uint8Array(digest))
}

export async function retrievePaymongoIntent(intentId: string, config: ReturnType<typeof paymongoConfig>) {
  const response = await paymongoRequest(`/v1/payment_intents/${encodeURIComponent(intentId)}`, { method: 'GET', config })
  return normalizeCanonicalIntent(response)
}

async function paymongoRequest(
  path: string,
  input: {
    method: 'GET' | 'POST'
    config: ReturnType<typeof paymongoConfig>
    body?: unknown
    idempotencyKey?: string
    authorization?: 'secret' | 'public'
  },
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAYMONGO_TIMEOUT_MS)
  try {
    const response = await fetch(`${input.config.apiBaseUrl}${path}`, {
      method: input.method,
      headers: {
        Authorization: `Basic ${btoa(`${input.authorization === 'public' ? input.config.publicKey : input.config.secretKey}:`)}`,
        Accept: 'application/json',
        ...(input.body ? { 'Content-Type': 'application/json' } : {}),
        ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const errors = asArray(asRecord(payload)?.errors)
      const first = asRecord(errors[0])
      throw new Error(stringValue(first?.detail) ?? stringValue(first?.title) ?? `PayMongo request failed with ${response.status}`)
    }
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

function paymentIntentClientKey(response: unknown) {
  const data = asRecord(asRecord(response)?.data)
  const attributes = asRecord(data?.attributes)
  return stringValue(attributes?.client_key)
}

function providerResourceId(response: unknown, expectedType: string) {
  const data = asRecord(asRecord(response)?.data)
  const type = stringValue(data?.type)
  if (type && type !== expectedType) return undefined
  return stringValue(data?.id)
}

function extractPaymentIntentId(resource: Record<string, unknown> | undefined) {
  const resourceId = stringValue(resource?.id)
  const resourceType = stringValue(resource?.type)
  if (resourceType === 'payment_intent' && resourceId) return resourceId
  const attributes = asRecord(resource?.attributes)
  const direct = stringValue(attributes?.payment_intent_id) ?? stringValue(attributes?.payment_intent)
  if (direct) return direct
  const relationships = asRecord(resource?.relationships)
  const relation = asRecord(relationships?.payment_intent)
  const relationData = asRecord(relation?.data)
  return stringValue(relationData?.id)
}

function isPaidIntentStatus(status: string) {
  return status === 'succeeded' || status === 'paid'
}

function isFailedIntentStatus(status: string) {
  return status === 'failed' || status === 'cancelled'
}

function paymongoFailureCode(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return 'timeout'
  if (error instanceof Error) return error.message.slice(0, 120)
  return 'unknown_error'
}

async function hmacHex(secret: string, value: string | Uint8Array) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const digest = await crypto.subtle.sign('HMAC', key, Uint8Array.from(bytes).buffer)
  return bytesToHex(new Uint8Array(digest))
}

function normalizeProviderTimestamp(value: number) {
  return value < 10_000_000_000 ? value * 1_000 : value
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeHexEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return mismatch === 0
}
