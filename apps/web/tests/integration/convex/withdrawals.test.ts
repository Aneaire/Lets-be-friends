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

async function seed(t: ReturnType<typeof convexTest>, availableCentavos = AVAILABLE) {
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
      deterministicKey: `member:${companionUserId}:booking`,
      accountType: 'member_booking',
      ownerUserId: companionUserId,
      currency: 'PHP',
      availableCentavos,
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

describe('Companion withdrawals', () => {
  it('withdraws available unified wallet funds atomically and exposes only masked payout details', async () => {
    const t = createTest()
    const ids = await seed(t)
    const saved = await addPayoutMethod(t, ids.now)
    expect(saved.availableAt).toBe(ids.now)

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
    const walletDashboard = await t.withIdentity({ subject: 'withdrawal-companion' }).query(api.finance.memberDashboard, {})
    expect(dashboard?.payoutMethod).toMatchObject({ institutionName: 'BDO Unibank', accountNumberLast4: '4321', ready: true })
    expect(dashboard?.activeWithdrawalId).toBe(result.withdrawalId)
    expect(dashboard).toMatchObject({ availableEarningsCentavos: AVAILABLE - WITHDRAWAL, inTransferEarningsCentavos: WITHDRAWAL })
    expect(walletDashboard).toMatchObject({ availableCentavos: AVAILABLE - WITHDRAWAL, reservedCentavos: WITHDRAWAL })
    expect(JSON.stringify(dashboard)).not.toContain('encrypted-account-number')
    expect(JSON.stringify(dashboard)).not.toContain('encrypted-iv')
  })

  it('exposes the PHP 10 withdrawal minimum on the dashboard', async () => {
    const t = createTest()
    await seed(t)

    const dashboard = await t.withIdentity({ subject: 'withdrawal-companion' }).query(api.withdrawals.dashboard, {})
    expect(dashboard).toMatchObject({
      minimumCentavos: 1_000,
      maximumCentavos: 5_000_000,
      providerFeeCentavos: 1_000,
      feePaidByPlatform: true,
    })
  })

  it('reserves exactly the PHP 10 minimum from an exact PHP 10 balance without charging the provider fee', async () => {
    const t = createTest()
    const ids = await seed(t, 1_000)
    await addPayoutMethod(t, ids.now)

    const result = await t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: 1_000,
    })
    const state = await t.run(async (ctx) => ({
      account: await ctx.db.get(ids.accountId),
      withdrawal: await ctx.db.get(result.withdrawalId),
      transactions: await ctx.db.query('walletTransactions').collect(),
      entries: await ctx.db.query('walletEntries').collect(),
    }))
    expect(state.account).toMatchObject({ availableCentavos: 0, reservedCentavos: 1_000 })
    expect(state.withdrawal).toMatchObject({ status: 'queued', amountCentavos: 1_000, providerFeeCentavos: 1_000 })
    expect(state.transactions).toHaveLength(1)
    expect(state.transactions[0]).toMatchObject({ kind: 'payout_reserve', amountCentavos: 1_000 })
    expect(state.entries).toHaveLength(2)
    expect(state.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: ids.accountId, bucket: 'available', direction: 'debit', amountCentavos: 1_000 }),
      expect.objectContaining({ accountId: ids.accountId, bucket: 'reserved', direction: 'credit', amountCentavos: 1_000 }),
    ]))
    expect(state.entries.some((entry) => entry.amountCentavos !== 1_000)).toBe(false)
  })

  it('rejects a request below the PHP 10 minimum without partial writes', async () => {
    const t = createTest()
    const ids = await seed(t)
    await addPayoutMethod(t, ids.now)

    const snapshot = () => t.run(async (ctx) => ({
      account: await ctx.db.get(ids.accountId),
      accounts: await ctx.db.query('walletAccounts').collect(),
      withdrawals: await ctx.db.query('withdrawals').collect(),
      transactions: await ctx.db.query('walletTransactions').collect(),
      entries: await ctx.db.query('walletEntries').collect(),
      notifications: await ctx.db.query('notifications').collect(),
      auditLogs: await ctx.db.query('auditLogs').collect(),
      scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
    }))

    const before = await snapshot()
    expect(before.account).toMatchObject({ availableCentavos: AVAILABLE, reservedCentavos: 0 })
    expect(before.withdrawals).toEqual([])
    expect(before.transactions).toEqual([])
    expect(before.entries).toEqual([])
    expect(before.notifications).toEqual([])
    expect(before.scheduled).toEqual([])
    expect(before.auditLogs.map((row) => row.action)).toEqual(['payout_method.added'])

    await expect(t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: 999,
    })).rejects.toThrow('between ₱10 and ₱50,000')

    expect(await snapshot()).toEqual(before)
  })

  it('treats newly saved and future-dated payout methods as ready immediately', async () => {
    const t = createTest()
    const ids = await seed(t)
    const saved = await addPayoutMethod(t, ids.now)
    expect(saved.availableAt).toBe(ids.now)

    await t.run(async (ctx) => {
      const method = await ctx.db.query('payoutMethods').withIndex('by_companion_status', (q) => q.eq('companionUserId', ids.companionUserId).eq('status', 'active')).unique()
      await ctx.db.patch(method!._id, { availableAt: Date.now() + 86_400_000, updatedAt: Date.now() })
    })

    const result = await t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: WITHDRAWAL,
    })
    expect(result.status).toBe('queued')
    const dashboard = await t.withIdentity({ subject: 'withdrawal-companion' }).query(api.withdrawals.dashboard, {})
    expect(dashboard?.payoutMethod).toMatchObject({ ready: true })
  })

  it('rejects an insufficient-balance request without partial financial writes', async () => {
    const t = createTest()
    const ids = await seed(t)
    await addPayoutMethod(t, ids.now)
    await expect(t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: AVAILABLE + 1,
    })).rejects.toThrow('Available wallet balance is lower')

    const state = await t.run(async (ctx) => ({
      account: await ctx.db.get(ids.accountId),
      withdrawals: await ctx.db.query('withdrawals').collect(),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.account).toMatchObject({ availableCentavos: AVAILABLE, reservedCentavos: 0 })
    expect(state.withdrawals).toEqual([])
    expect(state.transactions).toEqual([])
  })

  it('consolidates legacy Companion earnings with booking funds before withdrawal', async () => {
    const t = createTest()
    const ids = await seed(t)
    const legacyAmount = 30_000
    const legacyAccountId = await t.run(async (ctx) => await ctx.db.insert('walletAccounts', {
      deterministicKey: `companion:${ids.companionUserId}:earnings`,
      accountType: 'companion_earnings',
      ownerUserId: ids.companionUserId,
      currency: 'PHP',
      availableCentavos: legacyAmount,
      reservedCentavos: 0,
      pendingCentavos: 0,
      createdAt: ids.now,
      updatedAt: ids.now,
    }))
    await addPayoutMethod(t, ids.now)

    const before = await t.withIdentity({ subject: 'withdrawal-companion' }).query(api.withdrawals.dashboard, {})
    expect(before?.availableEarningsCentavos).toBe(AVAILABLE + legacyAmount)
    await t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, { amountCentavos: WITHDRAWAL })

    const state = await t.run(async (ctx) => ({
      wallet: await ctx.db.get(ids.accountId),
      legacy: await ctx.db.get(legacyAccountId),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.wallet).toMatchObject({ availableCentavos: AVAILABLE + legacyAmount - WITHDRAWAL, reservedCentavos: WITHDRAWAL })
    expect(state.legacy).toMatchObject({ availableCentavos: 0, reservedCentavos: 0, pendingCentavos: 0 })
    expect(state.transactions.filter((row) => row.kind === 'wallet_consolidation')).toHaveLength(1)
    expect(state.transactions.filter((row) => row.kind === 'payout_reserve')).toHaveLength(1)
  })

  it('leaves legacy and unified balances unchanged when a withdrawal exceeds their combined total', async () => {
    const t = createTest()
    const ids = await seed(t, 0)
    const legacyAmount = 30_000
    const legacyAccountId = await t.run(async (ctx) => await ctx.db.insert('walletAccounts', {
      deterministicKey: `companion:${ids.companionUserId}:earnings`,
      accountType: 'companion_earnings',
      ownerUserId: ids.companionUserId,
      currency: 'PHP',
      availableCentavos: legacyAmount,
      reservedCentavos: 0,
      pendingCentavos: 0,
      createdAt: ids.now,
      updatedAt: ids.now,
    }))
    await addPayoutMethod(t, ids.now)

    await expect(t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: WITHDRAWAL,
    })).rejects.toThrow('Available wallet balance is lower')
    const state = await t.run(async (ctx) => ({
      wallet: await ctx.db.get(ids.accountId),
      legacy: await ctx.db.get(legacyAccountId),
      withdrawals: await ctx.db.query('withdrawals').collect(),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.wallet).toMatchObject({ availableCentavos: 0, reservedCentavos: 0, pendingCentavos: 0 })
    expect(state.legacy).toMatchObject({ availableCentavos: legacyAmount, reservedCentavos: 0, pendingCentavos: 0 })
    expect(state.withdrawals).toEqual([])
    expect(state.transactions).toEqual([])
  })

  it('allows a provider-confirmed QR Ph top-up to be withdrawn from the same wallet', async () => {
    const t = createTest()
    const ids = await seed(t, 0)
    const topUpAmount = 20_000
    const withdrawalAmount = 15_000
    const topUpId = await t.run(async (ctx) => await ctx.db.insert('paymongoTopUps', {
      beneficiaryUserId: ids.companionUserId,
      purpose: 'member_booking_balance',
      amountCentavos: topUpAmount,
      currency: 'PHP',
      mode: 'test',
      status: 'processing',
      providerIntentId: 'pi_withdrawable_topup',
      createdAt: ids.now,
      updatedAt: ids.now,
    }))
    await t.mutation(internal.paymongo.applyReconciliation, {
      topUpId,
      intent: {
        id: 'pi_withdrawable_topup',
        amountCentavos: topUpAmount,
        currency: 'PHP',
        status: 'succeeded',
        mode: 'test',
        methodTypes: ['qrph'],
      },
    })
    await addPayoutMethod(t, ids.now)

    await expect(t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: withdrawalAmount,
    })).resolves.toMatchObject({ status: 'queued', amountCentavos: withdrawalAmount })
    const state = await t.run(async (ctx) => ({
      wallet: await ctx.db.get(ids.accountId),
      transactions: await ctx.db.query('walletTransactions').collect(),
    }))
    expect(state.wallet).toMatchObject({ availableCentavos: topUpAmount - withdrawalAmount, reservedCentavos: withdrawalAmount })
    expect(state.transactions.filter((row) => row.kind === 'paymongo_member_credit')).toHaveLength(1)
    expect(state.transactions.filter((row) => row.kind === 'payout_reserve')).toHaveLength(1)
  })

  it('completes a provider-confirmed transfer exactly once and keeps a second withdrawal blocked while active', async () => {
    const t = createTest()
    const ids = await seed(t)
    await addPayoutMethod(t, ids.now)
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
    await addPayoutMethod(t, ids.now)
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

  it('requires a current, unsuspended identity but not a completed Companion profile', async () => {
    const t = createTest()
    const ids = await seed(t)
    await addPayoutMethod(t, ids.now)

    const dashboard = await t.withIdentity({ subject: 'withdrawal-companion' }).query(api.withdrawals.dashboard, {})
    expect(dashboard?.identityEligible).toBe(true)

    // The Companion profile exists only to make the member bookable. Removing
    // it must not block withdrawals once identity verification is current.
    await t.run(async (ctx) => {
      const profile = await ctx.db.query('companionProfiles').withIndex('by_user', (q) => q.eq('userId', ids.companionUserId)).unique()
      await ctx.db.delete(profile!._id)
    })
    const result = await t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: WITHDRAWAL,
    })
    expect(result).toMatchObject({ status: 'queued', amountCentavos: WITHDRAWAL })
    expect(await t.run((ctx) => ctx.db.get(ids.accountId))).toMatchObject({
      availableCentavos: AVAILABLE - WITHDRAWAL,
      reservedCentavos: WITHDRAWAL,
    })
  })

  it('rejects a suspended account and an expired identity verification', async () => {
    const t = createTest()
    const ids = await seed(t)
    await addPayoutMethod(t, ids.now)

    await t.run((ctx) => ctx.db.patch(ids.companionUserId, { suspended: true, updatedAt: Date.now() }))
    await expect(t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: WITHDRAWAL,
    })).rejects.toThrow('Account is suspended')

    await t.run((ctx) => ctx.db.patch(ids.companionUserId, {
      suspended: false,
      verificationStatus: 'not_started',
      identityVerifiedAt: undefined,
      identityExpiresAt: undefined,
      updatedAt: Date.now(),
    }))
    const dashboard = await t.withIdentity({ subject: 'withdrawal-companion' }).query(api.withdrawals.dashboard, {})
    expect(dashboard?.identityEligible).toBe(false)
    await expect(t.withIdentity({ subject: 'withdrawal-companion' }).mutation(api.withdrawals.request, {
      amountCentavos: WITHDRAWAL,
    })).rejects.toThrow('Current identity verification is required for withdrawals')
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
