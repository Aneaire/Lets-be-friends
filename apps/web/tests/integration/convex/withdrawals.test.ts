import { convexTest } from 'convex-test'
import geospatialTest from '@convex-dev/geospatial/test'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { api, internal } from '../../../convex/_generated/api'
import schema from '../../../convex/schema'
import { convexModules } from '../../helpers/convex'

const AVAILABLE = 120_000
const WITHDRAWAL = 50_000
let previousEnabled: string | undefined
let previousMode: string | undefined

function createTest() {
  const t = convexTest(schema, convexModules)
  geospatialTest.register(t)
  return t
}

beforeEach(() => {
  previousEnabled = process.env.COMPANION_WITHDRAWALS_ENABLED
  previousMode = process.env.PAYMONGO_MODE
  process.env.COMPANION_WITHDRAWALS_ENABLED = 'true'
  process.env.PAYMONGO_MODE = 'test'
})

afterEach(() => {
  if (previousEnabled === undefined) delete process.env.COMPANION_WITHDRAWALS_ENABLED
  else process.env.COMPANION_WITHDRAWALS_ENABLED = previousEnabled
  if (previousMode === undefined) delete process.env.PAYMONGO_MODE
  else process.env.PAYMONGO_MODE = previousMode
})

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const companionUserId = await ctx.db.insert('users', {
      clerkUserId: 'withdrawal-companion',
      displayName: 'Maria Santos',
      firstName: 'Maria',
      lastName: 'Santos',
      role: 'companion',
      verificationStatus: 'approved',
      verificationSource: 'in_app',
      identityVerifiedAt: now,
      identityExpiresAt: now + 86_400_000,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('identityRecords', {
      userId: companionUserId,
      reason: 'companion_application',
      source: 'in_app',
      stage: 'approved',
      selectedIdType: 'national_id',
      fullLegalName: 'Maria Santos',
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('companionProfiles', {
      userId: companionUserId,
      displayName: 'Maria Santos',
      intro: 'A verified Companion for withdrawal testing.',
      city: 'Makati',
      strengths: ['Good listener'],
      categories: ['Coffee and meals'],
      boundaries: ['Public places only'],
      mode: 'both',
      hourlyRateCentavos: 50_000,
      status: 'approved',
      rating: 5,
      reviewCount: 1,
      createdAt: now,
      updatedAt: now,
    })
    const accountId = await ctx.db.insert('walletAccounts', {
      deterministicKey: `companion:${companionUserId}:earnings`,
      accountType: 'companion_earnings',
      ownerUserId: companionUserId,
      currency: 'PHP',
      availableCentavos: AVAILABLE,
      reservedCentavos: 0,
      pendingCentavos: 0,
      createdAt: now,
      updatedAt: now,
    })
    return { now, companionUserId, accountId }
  })
}

async function addPayoutMethod(t: ReturnType<typeof convexTest>, now: number) {
  return await t.mutation(internal.withdrawals.persistPayoutMethod, {
    clerkUserId: 'withdrawal-companion',
    provider: 'instapay',
    institutionBic: 'BNORPHMM',
    institutionName: 'BDO Unibank',
    accountName: 'Maria Santos',
    accountNumberCiphertext: 'encrypted-account-number',
    accountNumberIv: 'encrypted-iv',
    accountNumberLast4: '4321',
    mode: 'test',
    now,
  })
}

async function readyPayoutMethod(t: ReturnType<typeof convexTest>, now: number) {
  return await addPayoutMethod(t, now - 86_400_001)
}

describe('Companion withdrawals', () => {
  it('reserves available earnings atomically and exposes only masked payout details', async () => {
    const t = createTest()
    const ids = await seed(t)
    await readyPayoutMethod(t, ids.now)

    const result = await t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: WITHDRAWAL,
    })
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.get(ids.accountId),
      withdrawal: await ctx.db.get(result.withdrawalId),
      transactions: await ctx.db.query('walletTransactions').collect(),
      scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
    }))
    expect(state.account).toMatchObject({ availableCentavos: AVAILABLE - WITHDRAWAL, reservedCentavos: WITHDRAWAL })
    expect(state.withdrawal).toMatchObject({ status: 'queued', amountCentavos: WITHDRAWAL, destinationAccountLast4: '4321' })
    expect(state.transactions).toHaveLength(1)
    expect(state.transactions[0]).toMatchObject({ kind: 'payout_reserve', withdrawalId: result.withdrawalId })
    expect(state.scheduled).toHaveLength(1)

    const dashboard = await t.withIdentity({ subject: 'withdrawal-companion' }).query(api.withdrawals.dashboard, {})
    expect(dashboard?.payoutMethod).toMatchObject({ institutionName: 'BDO Unibank', accountNumberLast4: '4321', ready: true })
    expect(dashboard?.activeWithdrawalId).toBe(result.withdrawalId)
    expect(JSON.stringify(dashboard)).not.toContain('encrypted-account-number')
    expect(JSON.stringify(dashboard)).not.toContain('encrypted-iv')
  })

  it('rejects a security-hold or insufficient-balance request without partial financial writes', async () => {
    const t = createTest()
    const ids = await seed(t)
    await addPayoutMethod(t, ids.now)
    await expect(t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: WITHDRAWAL,
    })).rejects.toThrow('24-hour security hold')

    await t.run(async (ctx) => {
      const method = await ctx.db.query('payoutMethods').withIndex('by_companion_status', (q) => q.eq('companionUserId', ids.companionUserId).eq('status', 'active')).unique()
      await ctx.db.patch(method!._id, { availableAt: Date.now() - 1, updatedAt: Date.now() })
    })
    await expect(t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: AVAILABLE + 1,
    })).rejects.toThrow('Available earnings are lower')

    const state = await t.run(async (ctx) => ({
      account: await ctx.db.get(ids.accountId),
      withdrawals: await ctx.db.query('withdrawals').collect(),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.account).toMatchObject({ availableCentavos: AVAILABLE, reservedCentavos: 0 })
    expect(state.withdrawals).toEqual([])
    expect(state.transactions).toEqual([])
  })

  it('completes a provider-confirmed transfer exactly once and keeps a second withdrawal blocked while active', async () => {
    const t = createTest()
    const ids = await seed(t)
    await readyPayoutMethod(t, ids.now)
    const created = await t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, { amountCentavos: WITHDRAWAL })
    await expect(t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: WITHDRAWAL,
    })).rejects.toThrow('current withdrawal')
    const withdrawal = await t.run((ctx) => ctx.db.get(created.withdrawalId))
    const transfer = {
      id: 'tr_success',
      batchId: 'btr_success',
      status: 'succeeded',
      amountCentavos: WITHDRAWAL,
      feeCentavos: 1_000,
      currency: 'PHP',
      referenceNumber: withdrawal!.referenceNumber,
      providerReferenceNumber: 'provider-success',
    }
    await t.mutation(internal.withdrawals.applyProviderTransfer, { withdrawalId: created.withdrawalId, transfer, mode: 'test' })
    await t.mutation(internal.withdrawals.applyProviderTransfer, { withdrawalId: created.withdrawalId, transfer, mode: 'test' })

    const state = await t.run(async (ctx) => ({
      account: await ctx.db.get(ids.accountId),
      withdrawal: await ctx.db.get(created.withdrawalId),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.account).toMatchObject({ availableCentavos: AVAILABLE - WITHDRAWAL, reservedCentavos: 0 })
    expect(state.withdrawal).toMatchObject({ status: 'succeeded', providerTransferId: 'tr_success' })
    expect(state.transactions.filter((row) => row.kind === 'payout_complete')).toHaveLength(1)
  })

  it('releases a definitively failed transfer exactly once and rejects canonical mismatches atomically', async () => {
    const t = createTest()
    const ids = await seed(t)
    await readyPayoutMethod(t, ids.now)
    const created = await t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, { amountCentavos: WITHDRAWAL })
    const withdrawal = await t.run((ctx) => ctx.db.get(created.withdrawalId))

    await expect(t.mutation(internal.withdrawals.applyProviderTransfer, {
      withdrawalId: created.withdrawalId,
      mode: 'test',
      transfer: {
        id: 'tr_mismatch',
        status: 'failed',
        amountCentavos: WITHDRAWAL + 1,
        feeCentavos: 1_000,
        currency: 'PHP',
        referenceNumber: withdrawal!.referenceNumber,
      },
    })).rejects.toThrow('amount mismatch')
    expect(await t.run((ctx) => ctx.db.get(ids.accountId))).toMatchObject({ availableCentavos: AVAILABLE - WITHDRAWAL, reservedCentavos: WITHDRAWAL })

    const transfer = {
      id: 'tr_failed',
      status: 'failed',
      amountCentavos: WITHDRAWAL,
      feeCentavos: 1_000,
      currency: 'PHP',
      referenceNumber: withdrawal!.referenceNumber,
      failureCode: 'invalid_destination_account',
    }
    await t.mutation(internal.withdrawals.applyProviderTransfer, { withdrawalId: created.withdrawalId, transfer, mode: 'test' })
    await t.mutation(internal.withdrawals.applyProviderTransfer, { withdrawalId: created.withdrawalId, transfer, mode: 'test' })
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.get(ids.accountId),
      withdrawal: await ctx.db.get(created.withdrawalId),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.account).toMatchObject({ availableCentavos: AVAILABLE, reservedCentavos: 0 })
    expect(state.withdrawal).toMatchObject({ status: 'failed', failureCode: 'invalid_destination_account' })
    expect(state.transactions.filter((row) => row.kind === 'payout_release')).toHaveLength(1)
  })

  it('requires an approved, current, unsuspended Companion identity', async () => {
    const t = createTest()
    const ids = await seed(t)
    await readyPayoutMethod(t, ids.now)
    await t.run((ctx) => ctx.db.patch(ids.companionUserId, { suspended: true, updatedAt: Date.now() }))
    await expect(t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: WITHDRAWAL,
    })).rejects.toThrow('Account is suspended')
    expect(await t.run((ctx) => ctx.db.query('withdrawals').collect())).toEqual([])
  })

  it('deduplicates processed transfer webhooks but allows a rejected delivery to retry', async () => {
    const t = createTest()
    const event = {
      eventId: 'evt_transfer_retry',
      eventType: 'transfer.outward.successful',
      mode: 'test' as const,
      providerTransferId: 'tr_retry',
      rawBodyHash: 'same-body',
    }
    const reserved = await t.mutation(internal.withdrawals.reserveWebhookEvent, event)
    expect(reserved.outcome).toBe('reserved')
    if (reserved.outcome !== 'reserved') throw new Error('Expected webhook reservation')
    await t.mutation(internal.withdrawals.rejectWebhookEvent, {
      eventRecordId: reserved.eventRecordId,
      outcome: 'provider_unavailable',
    })
    await expect(t.mutation(internal.withdrawals.reserveWebhookEvent, event)).resolves.toMatchObject({
      outcome: 'reserved',
      eventRecordId: reserved.eventRecordId,
    })
    await expect(t.mutation(internal.withdrawals.reserveWebhookEvent, { ...event, rawBodyHash: 'different-body' }))
      .resolves.toEqual({ outcome: 'conflict' })
  })
})
