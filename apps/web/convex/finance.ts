import { BOOKING_CURRENCY, nextSaturdayManilaCutoff } from '@lets-be-friends/shared'
import { internalMutation, query } from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { v } from 'convex/values'
import { getViewer, writeAudit } from './lib'

const COLLECTION_BATCH_SIZE = 200

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return null
    if (viewer.suspended) throw new Error('Account is suspended')
    const host = await ctx.db.query('hostProfiles').withIndex('by_user', (q) => q.eq('userId', viewer._id)).first()
    if (!host) return null

    const now = Date.now()
    const nextCutoff = nextSaturdayManilaCutoff(now)
    const [ledger, obligations, topUps] = await Promise.all([
      ctx.db.query('platformFeeLedger').withIndex('by_host_created_at', (q) => q.eq('hostUserId', viewer._id)).order('desc').collect(),
      ctx.db.query('commissionObligations').withIndex('by_host_due_at', (q) => q.eq('hostUserId', viewer._id)).collect(),
      ctx.db.query('paymongoTopUps').withIndex('by_host_created_at', (q) => q.eq('hostUserId', viewer._id)).order('desc').take(10),
    ])

    const paidByObligation = new Map<string, number>()
    let availableBalanceCentavos = 0
    for (const entry of ledger) {
      availableBalanceCentavos += entry.direction === 'credit' ? entry.amountCentavos : -entry.amountCentavos
      if (entry.direction === 'debit' && entry.obligationId) {
        const key = String(entry.obligationId)
        paidByObligation.set(key, (paidByObligation.get(key) ?? 0) + entry.amountCentavos)
      }
    }

    let pastDueCentavos = 0
    let dueThisSaturdayCentavos = 0
    const obligationRows = obligations.map((obligation) => {
      const paidCentavos = paidByObligation.get(String(obligation._id)) ?? 0
      const remainingCentavos = Math.max(0, obligation.amountCentavos - paidCentavos)
      if (remainingCentavos > 0 && obligation.dueAt <= now) pastDueCentavos += remainingCentavos
      if (remainingCentavos > 0 && obligation.dueAt === nextCutoff) dueThisSaturdayCentavos += remainingCentavos
      return { ...obligation, paidCentavos, remainingCentavos }
    })

    return {
      currency: BOOKING_CURRENCY,
      availableBalanceCentavos,
      dueThisSaturdayCentavos,
      dueAt: nextCutoff,
      pastDueCentavos,
      canAcceptBookings: pastDueCentavos === 0,
      obligations: obligationRows.filter((row) => row.remainingCentavos > 0).sort((a, b) => a.dueAt - b.dueAt).slice(0, 20),
      ledger: ledger.slice(0, 20),
      topUps,
    }
  },
})

export const collectWeekly = internalMutation({
  args: { now: v.optional(v.number()), cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    const cycleAt = mostRecentSaturdayManilaCutoff(now)
    const page = await ctx.db
      .query('commissionObligations')
      .withIndex('by_due_at', (q) => q.lte('dueAt', now))
      .order('asc')
      .paginate({ cursor: args.cursor ?? null, numItems: COLLECTION_BATCH_SIZE })
    const availableByHost = new Map<string, number>()
    let collectedCentavos = 0

    for (const obligation of page.page) {
      const idempotencyKey = `weekly:${cycleAt}:${obligation._id}`
      const existing = await ctx.db.query('platformFeeLedger').withIndex('by_idempotency_key', (q) => q.eq('idempotencyKey', idempotencyKey)).unique()
      if (existing) continue

      const remainingCentavos = await obligationRemainingCentavos(ctx, obligation)
      if (remainingCentavos <= 0) continue
      const hostKey = String(obligation.hostUserId)
      const cachedAvailable = availableByHost.get(hostKey)
      const available: number = cachedAvailable === undefined
        ? await availableBalanceForHost(ctx, obligation.hostUserId)
        : cachedAvailable
      const appliedCentavos = Math.min(available, remainingCentavos)
      if (appliedCentavos <= 0) {
        availableByHost.set(hostKey, available)
        continue
      }

      await ctx.db.insert('platformFeeLedger', {
        hostUserId: obligation.hostUserId,
        direction: 'debit',
        amountCentavos: appliedCentavos,
        currency: BOOKING_CURRENCY,
        kind: 'commission_collection',
        obligationId: obligation._id,
        idempotencyKey,
        createdAt: now,
      })
      availableByHost.set(hostKey, available - appliedCentavos)
      collectedCentavos += appliedCentavos
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.finance.collectWeekly, { now, cursor: page.continueCursor })
    }
    return { processed: page.page.length, collectedCentavos, done: page.isDone }
  },
})

export async function pastDueCommissionCentavos(ctx: { db: any }, hostUserId: Id<'users'>, now = Date.now()) {
  const obligations = await ctx.db
    .query('commissionObligations')
    .withIndex('by_host_due_at', (q: any) => q.eq('hostUserId', hostUserId).lte('dueAt', now))
    .collect()
  let total = 0
  for (const obligation of obligations) total += await obligationRemainingCentavos(ctx, obligation)
  return total
}

export async function settleTopUpInTransaction(
  ctx: { db: any },
  topUp: Doc<'paymongoTopUps'>,
  paidAt: number,
) {
  const creditKey = `topup:${topUp._id}:credit`
  const existingCredit = await ctx.db.query('platformFeeLedger').withIndex('by_idempotency_key', (q: any) => q.eq('idempotencyKey', creditKey)).unique()
  if (!existingCredit) {
    await ctx.db.insert('platformFeeLedger', {
      hostUserId: topUp.hostUserId,
      direction: 'credit',
      amountCentavos: topUp.amountCentavos,
      currency: BOOKING_CURRENCY,
      kind: 'top_up_credit',
      topUpId: topUp._id,
      idempotencyKey: creditKey,
      createdAt: paidAt,
    })
  }

  let available = await availableBalanceForHost(ctx, topUp.hostUserId)
  const pastDue = await ctx.db
    .query('commissionObligations')
    .withIndex('by_host_due_at', (q: any) => q.eq('hostUserId', topUp.hostUserId).lte('dueAt', paidAt))
    .collect()
  for (const obligation of pastDue) {
    if (available <= 0) break
    const applicationKey = `topup:${topUp._id}:obligation:${obligation._id}`
    const existing = await ctx.db.query('platformFeeLedger').withIndex('by_idempotency_key', (q: any) => q.eq('idempotencyKey', applicationKey)).unique()
    if (existing) continue
    const remaining = await obligationRemainingCentavos(ctx, obligation)
    const applied = Math.min(available, remaining)
    if (applied <= 0) continue
    await ctx.db.insert('platformFeeLedger', {
      hostUserId: topUp.hostUserId,
      direction: 'debit',
      amountCentavos: applied,
      currency: BOOKING_CURRENCY,
      kind: 'commission_collection',
      obligationId: obligation._id,
      topUpId: topUp._id,
      idempotencyKey: applicationKey,
      createdAt: paidAt,
    })
    available -= applied
  }

  await writeAudit(ctx, {
    actorUserId: topUp.hostUserId,
    action: 'platform_fee.top_up_credited',
    targetType: 'paymongoTopUp',
    targetId: String(topUp._id),
    after: { amountCentavos: topUp.amountCentavos, currency: BOOKING_CURRENCY },
  })
}

async function obligationRemainingCentavos(ctx: { db: any }, obligation: Doc<'commissionObligations'>) {
  const entries = await ctx.db.query('platformFeeLedger').withIndex('by_obligation', (q: any) => q.eq('obligationId', obligation._id)).collect()
  const paid = entries.reduce((sum: number, entry: Doc<'platformFeeLedger'>) => (
    entry.direction === 'debit' ? sum + entry.amountCentavos : sum
  ), 0)
  return Math.max(0, obligation.amountCentavos - paid)
}

async function availableBalanceForHost(ctx: { db: any }, hostUserId: Id<'users'>) {
  const entries = await ctx.db.query('platformFeeLedger').withIndex('by_host', (q: any) => q.eq('hostUserId', hostUserId)).collect()
  return entries.reduce((balance: number, entry: Doc<'platformFeeLedger'>) => (
    balance + (entry.direction === 'credit' ? entry.amountCentavos : -entry.amountCentavos)
  ), 0)
}

export function mostRecentSaturdayManilaCutoff(timestamp: number) {
  const next = nextSaturdayManilaCutoff(timestamp)
  return next - 7 * 24 * 60 * 60 * 1_000
}
