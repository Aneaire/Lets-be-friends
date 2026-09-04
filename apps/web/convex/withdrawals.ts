import {
  BOOKING_CURRENCY,
  COMPANION_PAYOUT_METHOD_HOLD_MS,
  MAX_COMPANION_WITHDRAWAL_CENTAVOS,
  MIN_COMPANION_WITHDRAWAL_CENTAVOS,
  PAYMONGO_TRANSFER_FEE_CENTAVOS,
  validateCompanionWithdrawalCentavos,
} from '@lets-be-friends/shared'
import { action, internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { applyWalletTransaction, companionEarningsAccountKey, findWalletAccount } from './finance'
import { PaymongoRequestError, paymongoConfig, paymongoRequest } from './paymongo'
import { getViewer, writeAudit } from './lib'

const ACTIVE_WITHDRAWAL_STATUSES = ['queued', 'submitting', 'pending', 'needs_review'] as const
const MAX_SUBMISSION_ATTEMPTS = 3
const SUBMISSION_RETRY_DELAY_MS = 60_000
const STALE_SUBMISSION_MS = 5 * 60_000
const RECONCILIATION_BATCH_SIZE = 50

const canonicalTransferValidator = v.object({
  id: v.string(),
  batchId: v.optional(v.string()),
  status: v.string(),
  amountCentavos: v.number(),
  feeCentavos: v.number(),
  currency: v.string(),
  referenceNumber: v.string(),
  providerReferenceNumber: v.optional(v.string()),
  failureCode: v.optional(v.string()),
})

export type CanonicalPaymongoTransfer = {
  id: string
  batchId?: string
  status: string
  amountCentavos: number
  feeCentavos: number
  currency: string
  referenceNumber: string
  providerReferenceNumber?: string
  failureCode?: string
}

type SubmissionPayload = Doc<'withdrawals'> & {
  institutionBic: string
  accountName: string
  accountNumberCiphertext: string
  accountNumberIv: string
}

type ReconciliationCandidates = {
  provider: Doc<'withdrawals'>[]
  submit: Doc<'withdrawals'>[]
}

export function companionWithdrawalsEnabled() {
  return process.env.COMPANION_WITHDRAWALS_ENABLED?.trim().toLowerCase() === 'true'
}

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return null
    if (viewer.suspended) throw new Error('Account is suspended')
    const companion = await ctx.db.query('companionProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).unique()
    if (!companion) return null

    const now = Date.now()
    const [method, withdrawals, earningsAccount, legalName] = await Promise.all([
      ctx.db.query('payoutMethods')
        .withIndex('by_companion_status', (q) => q.eq('companionUserId', viewer._id).eq('status', 'active'))
        .unique(),
      ctx.db.query('withdrawals')
        .withIndex('by_companion_created_at', (q) => q.eq('companionUserId', viewer._id))
        .order('desc')
        .take(20),
      findWalletAccount(ctx, companionEarningsAccountKey(viewer._id)),
      verifiedLegalName(ctx, viewer),
    ])
    const activeWithdrawal = withdrawals.find((row) => ACTIVE_WITHDRAWAL_STATUSES.includes(row.status as typeof ACTIVE_WITHDRAWAL_STATUSES[number]))
    const currentMode = configuredPaymongoMode()
    const methodMatchesMode = method?.mode === currentMode
    const methodReady = Boolean(method && methodMatchesMode && method.availableAt <= now)

    return {
      enabled: companionWithdrawalsEnabled(),
      currency: BOOKING_CURRENCY,
      minimumCentavos: MIN_COMPANION_WITHDRAWAL_CENTAVOS,
      maximumCentavos: MAX_COMPANION_WITHDRAWAL_CENTAVOS,
      providerFeeCentavos: PAYMONGO_TRANSFER_FEE_CENTAVOS,
      feePaidByPlatform: true,
      verifiedAccountName: legalName,
      availableEarningsCentavos: earningsAccount?.availableCentavos ?? 0,
      inTransferEarningsCentavos: earningsAccount?.reservedCentavos ?? 0,
      payoutMethod: method ? {
        id: method._id,
        provider: method.provider,
        institutionBic: method.institutionBic,
        institutionName: method.institutionName,
        accountName: method.accountName,
        accountNumberLast4: method.accountNumberLast4,
        availableAt: method.availableAt,
        ready: methodReady,
        modeMismatch: !methodMatchesMode,
      } : null,
      activeWithdrawalId: activeWithdrawal?._id ?? null,
      withdrawals: withdrawals.map((row) => ({
        id: row._id,
        amountCentavos: row.amountCentavos,
        providerFeeCentavos: row.providerFeeCentavos,
        status: row.status,
        institutionName: row.destinationInstitutionName,
        accountNumberLast4: row.destinationAccountLast4,
        providerReferenceNumber: row.providerReferenceNumber,
        failureCode: row.failureCode,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        succeededAt: row.succeededAt,
        failedAt: row.failedAt,
      })),
    }
  },
})

export const listReceivingInstitutions = action({
  args: {},
  handler: async (ctx): Promise<{ accountName: string; institutions: Array<{ bic: string; name: string }> }> => {
    if (!companionWithdrawalsEnabled()) throw new Error('Companion withdrawals are not enabled')
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Authentication required')
    const setup = await ctx.runQuery(internal.withdrawals.payoutSetupContext, { clerkUserId: identity.subject })
    const config = paymongoConfig()
    const response = await paymongoRequest('/v2/transfers/receiving_institutions?provider=instapay', { method: 'GET', config })
    return { accountName: setup.legalName, institutions: normalizeReceivingInstitutions(response) }
  },
})

export const savePayoutMethod = action({
  args: {
    institutionBic: v.string(),
    accountNumber: v.string(),
  },
  handler: async (ctx, args): Promise<{ availableAt: number; institutionName: string; accountNumberLast4: string }> => {
    if (!companionWithdrawalsEnabled()) throw new Error('Companion withdrawals are not enabled')
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Authentication required')
    const accountNumber = normalizeAccountNumber(args.accountNumber)
    const config = paymongoConfig()
    const setup = await ctx.runQuery(internal.withdrawals.payoutSetupContext, { clerkUserId: identity.subject })
    const institutions = normalizeReceivingInstitutions(await paymongoRequest(
      '/v2/transfers/receiving_institutions?provider=instapay',
      { method: 'GET', config },
    ))
    const institution = institutions.find((candidate) => candidate.bic === args.institutionBic.trim())
    if (!institution) throw new Error('Choose a currently supported bank or e-wallet')
    const encrypted = await encryptPayoutAccountNumber(
      accountNumber,
      encryptionContext(String(setup.userId), institution.bic, setup.legalName),
    )
    return await ctx.runMutation(internal.withdrawals.persistPayoutMethod, {
      clerkUserId: identity.subject,
      provider: 'instapay',
      institutionBic: institution.bic,
      institutionName: institution.name,
      accountName: setup.legalName,
      accountNumberCiphertext: encrypted.ciphertext,
      accountNumberIv: encrypted.iv,
      accountNumberLast4: accountNumber.slice(-4),
      mode: config.mode,
    })
  },
})

export const request = mutation({
  args: { amountCentavos: v.number() },
  handler: async (ctx, args) => {
    if (!companionWithdrawalsEnabled()) throw new Error('Companion withdrawals are not enabled')
    const viewer = await requireEligibleCompanion(ctx)
    const amountCentavos = validateCompanionWithdrawalCentavos(args.amountCentavos)
    const now = Date.now()
    const method = await ctx.db.query('payoutMethods')
      .withIndex('by_companion_status', (q) => q.eq('companionUserId', viewer._id).eq('status', 'active'))
      .unique()
    if (!method) throw new Error('Add a payout method before withdrawing')
    if (method.mode !== configuredPaymongoMode()) throw new Error('Replace the payout method for the current payment mode')
    if (method.availableAt > now) throw new Error('This payout method is still in its 24-hour security hold')
    const active = await firstActiveWithdrawal(ctx, viewer._id)
    if (active) throw new Error('Wait for the current withdrawal to finish before starting another')
    const account = await findWalletAccount(ctx, companionEarningsAccountKey(viewer._id))
    if (!account || account.availableCentavos < amountCentavos) throw new Error('Available earnings are lower than this withdrawal amount')

    const withdrawalId = await ctx.db.insert('withdrawals', {
      companionUserId: viewer._id,
      payoutMethodId: method._id,
      amountCentavos,
      providerFeeCentavos: PAYMONGO_TRANSFER_FEE_CENTAVOS,
      currency: BOOKING_CURRENCY,
      status: 'queued',
      mode: method.mode,
      destinationInstitutionName: method.institutionName,
      destinationAccountName: method.accountName,
      destinationAccountLast4: method.accountNumberLast4,
      referenceNumber: 'pending',
      idempotencyKey: 'pending',
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    const referenceNumber = buildWithdrawalReferenceNumber(String(withdrawalId))
    const idempotencyKey = `withdrawal:${String(withdrawalId)}:submit`
    await ctx.db.patch(withdrawalId, { referenceNumber, idempotencyKey })
    await applyWalletTransaction(ctx, {
      kind: 'payout_reserve',
      idempotencyKey: `withdrawal:${String(withdrawalId)}:reserve`,
      withdrawalId,
      actorUserId: viewer._id,
      amountCentavos,
      note: `Reserved for withdrawal to ${method.institutionName} ending in ${method.accountNumberLast4}`,
      now,
      legs: [
        { accountId: account._id, bucket: 'available', direction: 'debit', amountCentavos },
        { accountId: account._id, bucket: 'reserved', direction: 'credit', amountCentavos },
      ],
    })
    await ctx.scheduler.runAfter(0, internal.withdrawals.submit, { withdrawalId })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: 'withdrawal.requested',
      targetType: 'withdrawal',
      targetId: String(withdrawalId),
      after: { amountCentavos, institutionName: method.institutionName, accountNumberLast4: method.accountNumberLast4 },
    })
    return { withdrawalId, status: 'queued' as const, amountCentavos }
  },
})

export const payoutSetupContext = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const viewer = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', args.clerkUserId)).unique()
    if (!viewer) throw new Error('Profile sync required')
    await assertEligibleCompanion(ctx, viewer)
    return { userId: viewer._id, legalName: await verifiedLegalName(ctx, viewer) }
  },
})

export const persistPayoutMethod = internalMutation({
  args: {
    clerkUserId: v.string(),
    provider: v.literal('instapay'),
    institutionBic: v.string(),
    institutionName: v.string(),
    accountName: v.string(),
    accountNumberCiphertext: v.string(),
    accountNumberIv: v.string(),
    accountNumberLast4: v.string(),
    mode: v.union(v.literal('test'), v.literal('live')),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewer = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', args.clerkUserId)).unique()
    if (!viewer) throw new Error('Profile sync required')
    await assertEligibleCompanion(ctx, viewer)
    const expectedName = await verifiedLegalName(ctx, viewer)
    if (normalizedName(args.accountName) !== normalizedName(expectedName)) {
      throw new Error('Payout account name must match the verified legal name')
    }
    if (!/^[A-Z0-9]{6,16}$/.test(args.institutionBic)) throw new Error('Receiving institution BIC is invalid')
    if (!/^\d{4}$/.test(args.accountNumberLast4)) throw new Error('Payout account ending is invalid')
    if (!args.accountNumberCiphertext || !args.accountNumberIv) throw new Error('Encrypted payout account is required')
    const now = args.now ?? Date.now()
    const current = await ctx.db.query('payoutMethods')
      .withIndex('by_companion_status', (q) => q.eq('companionUserId', viewer._id).eq('status', 'active'))
      .unique()
    if (current) await ctx.db.patch(current._id, { status: 'replaced', replacedAt: now, updatedAt: now })
    const availableAt = now + COMPANION_PAYOUT_METHOD_HOLD_MS
    const methodId = await ctx.db.insert('payoutMethods', {
      companionUserId: viewer._id,
      provider: args.provider,
      institutionBic: args.institutionBic,
      institutionName: normalizeRequiredText(args.institutionName, 120, 'Institution name'),
      accountName: expectedName,
      accountNumberCiphertext: args.accountNumberCiphertext,
      accountNumberIv: args.accountNumberIv,
      accountNumberLast4: args.accountNumberLast4,
      status: 'active',
      mode: args.mode,
      availableAt,
      createdAt: now,
      updatedAt: now,
    })
    await writeAudit(ctx, {
      actorUserId: viewer._id,
      action: current ? 'payout_method.replaced' : 'payout_method.added',
      targetType: 'payoutMethod',
      targetId: String(methodId),
      after: { institutionName: args.institutionName, accountNumberLast4: args.accountNumberLast4, availableAt },
    })
    return { availableAt, institutionName: args.institutionName, accountNumberLast4: args.accountNumberLast4 }
  },
})

export const beginSubmission = internalMutation({
  args: { withdrawalId: v.id('withdrawals'), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const withdrawal = await ctx.db.get(args.withdrawalId)
    if (!withdrawal || !['queued', 'submitting'].includes(withdrawal.status)) return null
    const now = args.now ?? Date.now()
    if (withdrawal.nextAttemptAt && withdrawal.nextAttemptAt > now) return null
    const method = await ctx.db.get(withdrawal.payoutMethodId)
    if (!method || method.companionUserId !== withdrawal.companionUserId) throw new Error('Withdrawal payout method is unavailable')
    await ctx.db.patch(withdrawal._id, {
      status: 'submitting',
      attemptCount: withdrawal.attemptCount + 1,
      nextAttemptAt: undefined,
      updatedAt: now,
    })
    return {
      ...withdrawal,
      attemptCount: withdrawal.attemptCount + 1,
      institutionBic: method.institutionBic,
      accountName: method.accountName,
      accountNumberCiphertext: method.accountNumberCiphertext,
      accountNumberIv: method.accountNumberIv,
    }
  },
})

export const submit = internalAction({
  args: { withdrawalId: v.id('withdrawals') },
  handler: async (ctx, args): Promise<{ outcome: string }> => {
    const prepared: SubmissionPayload | null = await ctx.runMutation(internal.withdrawals.beginSubmission, { withdrawalId: args.withdrawalId })
    if (!prepared) return { outcome: 'ignored' as const }
    try {
      const config = paymongoConfig()
      if (config.mode !== prepared.mode) throw new Error('PayMongo mode mismatch')
      const accountNumber = await decryptPayoutAccountNumber(
        prepared.accountNumberCiphertext,
        prepared.accountNumberIv,
        encryptionContext(String(prepared.companionUserId), prepared.institutionBic, prepared.accountName),
      )
      const sourceAccount = normalizeWalletSourceAccount(await paymongoRequest('/v2/wallets', { method: 'GET', config }))
      const requiredCentavos = prepared.amountCentavos + PAYMONGO_TRANSFER_FEE_CENTAVOS
      if (sourceAccount.availableCentavos !== undefined && sourceAccount.availableCentavos < requiredCentavos) {
        await ctx.runMutation(internal.withdrawals.failSubmission, {
          withdrawalId: prepared._id,
          failureCode: 'insufficient_wallet_balance',
        })
        return { outcome: 'failed' as const }
      }
      const callbackUrl = paymongoTransferCallbackUrl()
      const response = await paymongoRequest('/v2/batch_transfers', {
        method: 'POST',
        config,
        idempotencyKey: prepared.idempotencyKey,
        body: {
          transfers: [{
            provider: 'instapay',
            amount: prepared.amountCentavos,
            currency: BOOKING_CURRENCY,
            purpose: 'Companion earnings withdrawal',
            description: 'Lets Be Friends Companion earnings withdrawal',
            reference_number: prepared.referenceNumber,
            source_account: { number: sourceAccount.number, name: sourceAccount.name, bic: sourceAccount.bic },
            destination_account: {
              number: accountNumber,
              name: prepared.accountName,
              bic: prepared.institutionBic,
            },
            ...(callbackUrl ? { callback_url: callbackUrl } : {}),
            metadata: { withdrawal_id: String(prepared._id), companion_user_id: String(prepared.companionUserId) },
          }],
        },
      })
      const transfer = normalizeBatchTransfer(response)
      await ctx.runMutation(internal.withdrawals.applyProviderTransfer, {
        withdrawalId: prepared._id,
        transfer,
        mode: config.mode,
      })
      return { outcome: transfer.status as string }
    } catch (error) {
      const definitive = error instanceof PaymongoRequestError
        && error.status >= 400 && error.status < 500
        && ![408, 409, 429].includes(error.status)
      if (definitive) {
        await ctx.runMutation(internal.withdrawals.failSubmission, {
          withdrawalId: prepared._id,
          failureCode: safeFailureCode(error.message),
        })
        return { outcome: 'failed' as const }
      }
      const result: { status: string; retryAt?: number } = await ctx.runMutation(internal.withdrawals.markSubmissionUnknown, {
        withdrawalId: prepared._id,
        failureCode: error instanceof Error ? safeFailureCode(error.message) : 'submission_unavailable',
      })
      if (result.retryAt) await ctx.scheduler.runAt(result.retryAt, internal.withdrawals.submit, { withdrawalId: prepared._id })
      return { outcome: result.status }
    }
  },
})

export const markSubmissionUnknown = internalMutation({
  args: { withdrawalId: v.id('withdrawals'), failureCode: v.string(), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const withdrawal = await ctx.db.get(args.withdrawalId)
    if (!withdrawal || ['succeeded', 'failed'].includes(withdrawal.status)) return { status: withdrawal?.status ?? 'missing' }
    const now = args.now ?? Date.now()
    const exhausted = withdrawal.attemptCount >= MAX_SUBMISSION_ATTEMPTS
    const retryAt = exhausted ? undefined : now + SUBMISSION_RETRY_DELAY_MS * withdrawal.attemptCount
    const status = exhausted ? 'needs_review' as const : 'queued' as const
    await ctx.db.patch(withdrawal._id, { status, failureCode: args.failureCode, nextAttemptAt: retryAt, updatedAt: now })
    return { status, retryAt }
  },
})

export const failSubmission = internalMutation({
  args: { withdrawalId: v.id('withdrawals'), failureCode: v.string(), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const withdrawal = await ctx.db.get(args.withdrawalId)
    if (!withdrawal || withdrawal.status === 'succeeded') return { applied: false }
    if (withdrawal.status === 'failed') return { applied: false }
    const now = args.now ?? Date.now()
    await releaseWithdrawalFunds(ctx, withdrawal, now)
    await ctx.db.patch(withdrawal._id, {
      status: 'failed',
      failureCode: args.failureCode,
      providerStatus: 'failed',
      failedAt: withdrawal.failedAt ?? now,
      nextAttemptAt: undefined,
      updatedAt: now,
    })
    return { applied: true }
  },
})

export const applyProviderTransfer = internalMutation({
  args: {
    withdrawalId: v.optional(v.id('withdrawals')),
    transfer: canonicalTransferValidator,
    mode: v.union(v.literal('test'), v.literal('live')),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => applyProviderTransferInTransaction(ctx, args),
})

export const reconciliationCandidates = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const [pending, review, queued, submitting] = await Promise.all([
      ctx.db.query('withdrawals').withIndex('by_status_updated_at', (q) => q.eq('status', 'pending')).take(RECONCILIATION_BATCH_SIZE),
      ctx.db.query('withdrawals').withIndex('by_status_updated_at', (q) => q.eq('status', 'needs_review')).take(RECONCILIATION_BATCH_SIZE),
      ctx.db.query('withdrawals').withIndex('by_status_updated_at', (q) => q.eq('status', 'queued')).take(RECONCILIATION_BATCH_SIZE),
      ctx.db.query('withdrawals').withIndex('by_status_updated_at', (q) => q.eq('status', 'submitting')).take(RECONCILIATION_BATCH_SIZE),
    ])
    return {
      provider: [...pending, ...review].filter((row) => row.providerTransferId),
      submit: [...queued, ...submitting].filter((row) => !row.nextAttemptAt || row.nextAttemptAt <= now)
        .filter((row) => row.status === 'queued' || row.updatedAt <= now - STALE_SUBMISSION_MS),
    }
  },
})

export const reconcile = internalAction({
  args: {},
  handler: async (ctx): Promise<{ scheduled: number; reconciled: number }> => {
    const candidates: ReconciliationCandidates = await ctx.runQuery(internal.withdrawals.reconciliationCandidates, {})
    for (const row of candidates.submit) {
      await ctx.scheduler.runAfter(0, internal.withdrawals.submit, { withdrawalId: row._id })
    }
    let reconciled = 0
    for (const row of candidates.provider) {
      try {
        const config = paymongoConfig()
        if (config.mode !== row.mode || !row.providerTransferId) continue
        const transfer = await retrievePaymongoTransfer(row.providerTransferId, config)
        await ctx.runMutation(internal.withdrawals.applyProviderTransfer, { withdrawalId: row._id, transfer, mode: config.mode })
        reconciled += 1
      } catch {
        // Keep funds reserved until the provider can be read canonically.
      }
    }
    return { scheduled: candidates.submit.length, reconciled }
  },
})

export const reserveWebhookEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    mode: v.union(v.literal('test'), v.literal('live')),
    providerTransferId: v.string(),
    rawBodyHash: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('withdrawalWebhookEvents').withIndex('by_event_id', (q) => q.eq('eventId', args.eventId)).unique()
    if (existing) {
      const same = existing.rawBodyHash === args.rawBodyHash && existing.eventType === args.eventType
        && existing.mode === args.mode && existing.providerTransferId === args.providerTransferId
      if (!same) return { outcome: 'conflict' as const }
      if (existing.status === 'rejected') {
        await ctx.db.patch(existing._id, { status: 'received', outcome: undefined, processedAt: undefined })
        return { outcome: 'reserved' as const, eventRecordId: existing._id }
      }
      return { outcome: 'duplicate' as const }
    }
    const eventRecordId = await ctx.db.insert('withdrawalWebhookEvents', {
      ...args,
      status: 'received',
      receivedAt: Date.now(),
    })
    return { outcome: 'reserved' as const, eventRecordId }
  },
})

export const rejectWebhookEvent = internalMutation({
  args: { eventRecordId: v.id('withdrawalWebhookEvents'), outcome: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventRecordId)
    if (!event || event.status === 'processed') return
    await ctx.db.patch(event._id, { status: 'rejected', outcome: args.outcome, processedAt: Date.now() })
  },
})

export const applyWebhookEvent = internalMutation({
  args: {
    eventRecordId: v.id('withdrawalWebhookEvents'),
    transfer: canonicalTransferValidator,
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventRecordId)
    if (!event || event.status === 'processed') return
    await applyProviderTransferInTransaction(ctx, { transfer: args.transfer, mode: event.mode })
    await ctx.db.patch(event._id, { status: 'processed', outcome: args.transfer.status, processedAt: Date.now() })
  },
})

async function applyProviderTransferInTransaction(
  ctx: any,
  args: {
    withdrawalId?: Id<'withdrawals'>
    transfer: CanonicalPaymongoTransfer
    mode: 'test' | 'live'
    now?: number
  },
) {
  const withdrawal = args.withdrawalId
    ? await ctx.db.get(args.withdrawalId)
    : await ctx.db.query('withdrawals').withIndex('by_provider_transfer_id', (q: any) => q.eq('providerTransferId', args.transfer.id)).unique()
  if (!withdrawal) throw new Error('Withdrawal was not found for this PayMongo transfer')
  if (withdrawal.mode !== args.mode) throw new Error('PayMongo mode mismatch')
  if (args.transfer.amountCentavos !== withdrawal.amountCentavos) throw new Error('PayMongo withdrawal amount mismatch')
  if (args.transfer.currency !== withdrawal.currency) throw new Error('PayMongo withdrawal currency mismatch')
  if (normalizePaymongoReferenceNumber(args.transfer.referenceNumber) !== normalizePaymongoReferenceNumber(withdrawal.referenceNumber)) {
    throw new Error('PayMongo withdrawal reference mismatch')
  }
  if (withdrawal.providerTransferId && withdrawal.providerTransferId !== args.transfer.id) throw new Error('PayMongo transfer ID mismatch')
  const now = args.now ?? Date.now()
  const providerPatch = {
    providerBatchTransferId: args.transfer.batchId ?? withdrawal.providerBatchTransferId,
    providerTransferId: args.transfer.id,
    providerReferenceNumber: args.transfer.providerReferenceNumber,
    providerStatus: args.transfer.status,
    providerFeeCentavos: args.transfer.feeCentavos,
    submittedAt: withdrawal.submittedAt ?? now,
    failureCode: args.transfer.failureCode,
    nextAttemptAt: undefined,
    updatedAt: now,
  }
  if (args.transfer.status === 'succeeded') {
    if (withdrawal.status !== 'succeeded') await completeWithdrawalFunds(ctx, withdrawal, now)
    await ctx.db.patch(withdrawal._id, { ...providerPatch, status: 'succeeded', succeededAt: withdrawal.succeededAt ?? now })
    return { status: 'succeeded' as const }
  }
  if (args.transfer.status === 'failed') {
    if (withdrawal.status !== 'failed') await releaseWithdrawalFunds(ctx, withdrawal, now)
    await ctx.db.patch(withdrawal._id, { ...providerPatch, status: 'failed', failedAt: withdrawal.failedAt ?? now })
    return { status: 'failed' as const }
  }
  if (withdrawal.status === 'succeeded' || withdrawal.status === 'failed') return { status: withdrawal.status }
  await ctx.db.patch(withdrawal._id, { ...providerPatch, status: 'pending' })
  return { status: 'pending' as const }
}

async function requireEligibleCompanion(ctx: any) {
  const viewer = await getViewer(ctx)
  if (!viewer) throw new Error('Profile sync required')
  await assertEligibleCompanion(ctx, viewer)
  return viewer as Doc<'users'>
}

async function assertEligibleCompanion(ctx: any, viewer: Doc<'users'>) {
  if (viewer.suspended) throw new Error('Account is suspended')
  if (viewer.verificationStatus !== 'approved' || !viewer.identityExpiresAt || viewer.identityExpiresAt <= Date.now()) {
    throw new Error('Current identity verification is required for withdrawals')
  }
  const companion = await ctx.db.query('companionProfiles').withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).unique()
  if (!companion || companion.status !== 'approved') throw new Error('An approved Companion profile is required for withdrawals')
}

async function verifiedLegalName(ctx: any, viewer: Doc<'users'>) {
  const records = await ctx.db.query('identityRecords')
    .withIndex('by_user_created_at', (q: any) => q.eq('userId', viewer._id))
    .order('desc')
    .take(20)
  const approvedName = records.find((record: Doc<'identityRecords'>) => record.stage === 'approved' && record.fullLegalName)?.fullLegalName
  const fallback = [viewer.firstName, viewer.lastName].filter(Boolean).join(' ') || viewer.displayName
  return normalizeRequiredText(approvedName ?? fallback, 120, 'Verified legal name')
}

async function firstActiveWithdrawal(ctx: any, companionUserId: Id<'users'>) {
  for (const status of ACTIVE_WITHDRAWAL_STATUSES) {
    const row = await ctx.db.query('withdrawals')
      .withIndex('by_companion_status', (q: any) => q.eq('companionUserId', companionUserId).eq('status', status))
      .first()
    if (row) return row as Doc<'withdrawals'>
  }
  return null
}

async function completeWithdrawalFunds(ctx: any, withdrawal: Doc<'withdrawals'>, now: number) {
  const account = await findWalletAccount(ctx, companionEarningsAccountKey(withdrawal.companionUserId))
  if (!account) throw new Error('Companion earnings account was not found')
  await applyWalletTransaction(ctx, {
    kind: 'payout_complete',
    idempotencyKey: `withdrawal:${String(withdrawal._id)}:complete`,
    withdrawalId: withdrawal._id,
    actorUserId: withdrawal.companionUserId,
    amountCentavos: withdrawal.amountCentavos,
    note: `Completed withdrawal to ${withdrawal.destinationInstitutionName} ending in ${withdrawal.destinationAccountLast4}`,
    now,
    allowExternalDebit: true,
    legs: [{ accountId: account._id, bucket: 'reserved', direction: 'debit', amountCentavos: withdrawal.amountCentavos }],
  })
}

async function releaseWithdrawalFunds(ctx: any, withdrawal: Doc<'withdrawals'>, now: number) {
  const account = await findWalletAccount(ctx, companionEarningsAccountKey(withdrawal.companionUserId))
  if (!account) throw new Error('Companion earnings account was not found')
  await applyWalletTransaction(ctx, {
    kind: 'payout_release',
    idempotencyKey: `withdrawal:${String(withdrawal._id)}:release`,
    withdrawalId: withdrawal._id,
    actorUserId: withdrawal.companionUserId,
    amountCentavos: withdrawal.amountCentavos,
    note: `Released failed withdrawal to ${withdrawal.destinationInstitutionName} ending in ${withdrawal.destinationAccountLast4}`,
    now,
    legs: [
      { accountId: account._id, bucket: 'reserved', direction: 'debit', amountCentavos: withdrawal.amountCentavos },
      { accountId: account._id, bucket: 'available', direction: 'credit', amountCentavos: withdrawal.amountCentavos },
    ],
  })
}

export async function retrievePaymongoTransfer(transferId: string, config: ReturnType<typeof paymongoConfig>) {
  return normalizeTransfer(await paymongoRequest(`/v2/transfers/${encodeURIComponent(transferId)}`, { method: 'GET', config }))
}

export function normalizeBatchTransfer(response: unknown) {
  const root = asRecord(response)
  const data = asRecord(root?.data)
  const batchId = stringValue(data?.id)
  const transfers = asArray(data?.transfers ?? asRecord(data?.attributes)?.transfers)
  if (!batchId || transfers.length !== 1) throw new Error('PayMongo returned an incomplete batch transfer')
  return normalizeTransfer({ data: { ...asRecord(transfers[0]), batch_transfer_id: batchId } })
}

export function normalizeTransfer(response: unknown): CanonicalPaymongoTransfer {
  const root = asRecord(response)
  const data = asRecord(root?.data) ?? root
  const attributes = asRecord(data?.attributes)
  const value = attributes ?? data
  const id = stringValue(data?.id) ?? stringValue(value?.id) ?? stringValue(value?.transfer_id)
  const status = stringValue(value?.status)
  const amountCentavos = numberValue(value?.amount)
  const feeCentavos = numberValue(value?.fee) ?? PAYMONGO_TRANSFER_FEE_CENTAVOS
  const currency = stringValue(value?.currency)?.toUpperCase()
  const referenceNumber = stringValue(value?.reference_number)
  if (!id || !status || amountCentavos === undefined || !currency || !referenceNumber) {
    throw new Error('PayMongo returned an incomplete transfer')
  }
  return {
    id,
    batchId: stringValue(value?.batch_transfer_id) ?? stringValue(value?.batch_id),
    status,
    amountCentavos,
    feeCentavos,
    currency,
    referenceNumber,
    providerReferenceNumber: stringValue(value?.provider_reference_number),
    failureCode: stringValue(value?.provider_error_code) ?? stringValue(value?.failure_code),
  }
}

export function parsePaymongoTransferWebhookEvent(event: unknown) {
  const root = asRecord(event)
  const data = asRecord(root?.data)
  const attributes = asRecord(data?.attributes)
  const eventId = stringValue(data?.id)
  const eventType = stringValue(attributes?.type)
  const livemode = attributes?.livemode
  if (!eventId || !eventType || typeof livemode !== 'boolean') throw new Error('Invalid PayMongo event envelope')
  if (!['transfer.outward.successful', 'transfer.outward.failed'].includes(eventType)) throw new Error('Unsupported PayMongo transfer event type')
  const resource = asRecord(attributes?.data)
  const providerTransferId = stringValue(resource?.id) ?? stringValue(asRecord(resource?.attributes)?.transfer_id)
  if (!providerTransferId) throw new Error('PayMongo event is missing its transfer ID')
  return { eventId, eventType, mode: livemode ? 'live' as const : 'test' as const, providerTransferId }
}

export function normalizeReceivingInstitutions(response: unknown) {
  const root = asRecord(response)
  const values = asArray(root?.data)
  const institutions = values.flatMap((item) => {
    const data = asRecord(item)
    const attributes = asRecord(data?.attributes)
    const value = attributes ?? data
    const bic = stringValue(value?.bic) ?? stringValue(value?.bank_code) ?? stringValue(value?.code)
    const name = stringValue(value?.name) ?? stringValue(value?.bank_name)
    return bic && name ? [{ bic, name }] : []
  })
  if (!institutions.length) throw new Error('PayMongo returned no InstaPay receiving institutions')
  return institutions.sort((left, right) => left.name.localeCompare(right.name))
}

export function normalizeWalletSourceAccount(response: unknown) {
  const root = asRecord(response)
  const rawData = root?.data
  const wallets = Array.isArray(rawData) ? rawData : rawData ? [rawData] : []
  for (const walletValue of wallets) {
    const wallet = asRecord(walletValue)
    const value = asRecord(wallet?.attributes) ?? wallet
    const source = asRecord(value?.source_account)
    const account = asRecord(value?.account)
    const number = stringValue(source?.number)
      ?? stringValue(account?.account_number)
      ?? stringValue(account?.number)
    const name = stringValue(source?.name)
      ?? stringValue(account?.account_name)
      ?? stringValue(account?.name)
    const bic = stringValue(source?.bic) ?? stringValue(account?.bic) ?? 'PAEYPHM2XXX'
    const balance = asRecord(value?.balance)
    const availableCentavos = numberValue(balance?.available)
    const status = stringValue(value?.status)
    if (number && name && bic && (!status || ['activated', 'active'].includes(status))) {
      return { number, name, bic, availableCentavos }
    }
  }
  throw new Error('No activated PayMongo Wallet source account is available')
}

export function buildWithdrawalReferenceNumber(withdrawalId: string) {
  const sanitized = withdrawalId.replace(/[^a-zA-Z0-9]/g, '')
  if (!sanitized) throw new Error('Withdrawal reference requires an identifier')
  return `lbf ${sanitized}`.slice(0, 60)
}

export function normalizePaymongoReferenceNumber(value: string) {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function paymongoTransferCallbackUrl() {
  const raw = process.env.PAYMONGO_TRANSFER_CALLBACK_URL?.trim()
  if (!raw) return undefined
  if (!raw.startsWith('https://')) throw new Error('PAYMONGO_TRANSFER_CALLBACK_URL must use HTTPS')
  return raw
}

function configuredPaymongoMode(): 'test' | 'live' | null {
  const mode = process.env.PAYMONGO_MODE?.trim().toLowerCase()
  return mode === 'test' || mode === 'live' ? mode : null
}

function normalizeAccountNumber(value: string) {
  const normalized = value.replace(/[\s-]/g, '')
  if (!/^\d{8,24}$/.test(normalized)) throw new Error('Enter a valid 8 to 24 digit bank or e-wallet account number')
  return normalized
}

function normalizedName(value: string) {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function normalizeRequiredText(value: string, maximum: number, label: string) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized || normalized.length > maximum) throw new Error(`${label} is invalid`)
  return normalized
}

function encryptionKeyBytes() {
  const encoded = process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY?.trim()
  if (!encoded) throw new Error('PAYOUT_ACCOUNT_ENCRYPTION_KEY is not configured')
  let bytes: Uint8Array
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
  } catch {
    throw new Error('PAYOUT_ACCOUNT_ENCRYPTION_KEY must be base64 encoded')
  }
  if (bytes.byteLength !== 32) throw new Error('PAYOUT_ACCOUNT_ENCRYPTION_KEY must decode to 32 bytes')
  return bytes
}

export async function encryptPayoutAccountNumber(accountNumber: string, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(encryptionKeyBytes()).buffer, 'AES-GCM', false, ['encrypt'])
  const ciphertext = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv: Uint8Array.from(iv).buffer,
    additionalData: new TextEncoder().encode(context),
  }, key, new TextEncoder().encode(accountNumber))
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv) }
}

export async function decryptPayoutAccountNumber(ciphertext: string, iv: string, context: string) {
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(encryptionKeyBytes()).buffer, 'AES-GCM', false, ['decrypt'])
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(base64ToBytes(iv)).buffer,
      additionalData: new TextEncoder().encode(context),
    },
    key,
    Uint8Array.from(base64ToBytes(ciphertext)).buffer,
  )
  return new TextDecoder().decode(plaintext)
}

function encryptionContext(companionUserId: string, institutionBic: string, accountName: string) {
  return `payout:${companionUserId}:${institutionBic}:${normalizedName(accountName)}`
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function safeFailureCode(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'provider_error'
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}
