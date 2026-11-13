import { internalMutation, type MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { ConvexError, v } from 'convex/values'
import {
  REFERRAL_LAUNCH_BONUS_MAX_CLAIMS,
} from '@lets-be-friends/shared'

export const REFERRAL_PROGRAM_KEY = 'referrals' as const

export type ReferralProgram = {
  active: boolean
  launchBonusCentavos: number
  launchBonusMaxClaims: number
  launchBonusClaims: number
  launchBonusActive: boolean
}

export const DEFAULT_REFERRAL_PROGRAM: ReferralProgram = {
  active: false,
  launchBonusCentavos: 0,
  launchBonusMaxClaims: REFERRAL_LAUNCH_BONUS_MAX_CLAIMS,
  launchBonusClaims: 0,
  launchBonusActive: false,
}

export async function getReferralProgram(ctx: { db: any }): Promise<ReferralProgram> {
  const row = await ctx.db.query('referralProgram')
    .withIndex('by_key', (q: any) => q.eq('key', REFERRAL_PROGRAM_KEY))
    .unique() as Doc<'referralProgram'> | null
  if (!row) return DEFAULT_REFERRAL_PROGRAM
  return {
    active: row.active,
    launchBonusCentavos: row.launchBonusCentavos,
    launchBonusMaxClaims: row.launchBonusMaxClaims,
    launchBonusClaims: row.launchBonusClaims,
    launchBonusActive: row.launchBonusActive,
  }
}

export async function requireActiveReferralProgram(ctx: { db: any }) {
  const program = await getReferralProgram(ctx)
  if (!program.active) throw new ConvexError('Referrals are paused right now.')
  return program
}

export type ReferralSummary = {
  totalReferrals: number
  totalRewardedBookings: number
  totalEarnedCentavos: number
  totalPendingCentavos: number
  totalReversedCentavos: number
}

export const EMPTY_REFERRAL_SUMMARY: ReferralSummary = {
  totalReferrals: 0,
  totalRewardedBookings: 0,
  totalEarnedCentavos: 0,
  totalPendingCentavos: 0,
  totalReversedCentavos: 0,
}

export async function getReferralSummary(
  ctx: { db: any },
  referrerUserId: any,
): Promise<ReferralSummary | null> {
  const row = await ctx.db.query('referralSummaries')
    .withIndex('by_referrer', (q: any) => q.eq('referrerUserId', referrerUserId))
    .unique()
  if (!row) return null
  return {
    totalReferrals: row.totalReferrals,
    totalRewardedBookings: row.totalRewardedBookings,
    totalEarnedCentavos: row.totalEarnedCentavos,
    totalPendingCentavos: row.totalPendingCentavos,
    totalReversedCentavos: row.totalReversedCentavos,
  }
}

export async function incrementReferralSummary(
  ctx: { db: any },
  referrerUserId: any,
  delta: Partial<ReferralSummary>,
  now = Date.now(),
) {
  const row = await ctx.db.query('referralSummaries')
    .withIndex('by_referrer', (q: any) => q.eq('referrerUserId', referrerUserId))
    .unique()
  if (!row) {
    await ctx.db.insert('referralSummaries', {
      referrerUserId,
      totalReferrals: Math.max(0, delta.totalReferrals ?? 0),
      totalRewardedBookings: Math.max(0, delta.totalRewardedBookings ?? 0),
      totalEarnedCentavos: Math.max(0, delta.totalEarnedCentavos ?? 0),
      totalPendingCentavos: Math.max(0, delta.totalPendingCentavos ?? 0),
      totalReversedCentavos: Math.max(0, delta.totalReversedCentavos ?? 0),
      updatedAt: now,
    })
    return
  }
  await ctx.db.patch(row._id, {
    totalReferrals: Math.max(0, row.totalReferrals + (delta.totalReferrals ?? 0)),
    totalRewardedBookings: Math.max(0, row.totalRewardedBookings + (delta.totalRewardedBookings ?? 0)),
    totalEarnedCentavos: Math.max(0, row.totalEarnedCentavos + (delta.totalEarnedCentavos ?? 0)),
    totalPendingCentavos: Math.max(0, row.totalPendingCentavos + (delta.totalPendingCentavos ?? 0)),
    totalReversedCentavos: Math.max(0, row.totalReversedCentavos + (delta.totalReversedCentavos ?? 0)),
    updatedAt: now,
  })
}

export async function recordReferralFraudSignal(
  ctx: { db: any },
  referral: { _id: any; referrerUserId: any; referredUserId: any },
  signal: 'same_device' | 'referral_volume' | 'companion_self_dealing',
  note?: string,
  now = Date.now(),
) {
  const existing = await ctx.db.query('referralFraudSignals')
    .withIndex('by_referral', (q: any) => q.eq('referralId', referral._id))
    .collect()
  if (existing.some((row: any) => row.signal === signal && row.status === 'open')) return
  await ctx.db.insert('referralFraudSignals', {
    referralId: referral._id,
    referrerUserId: referral.referrerUserId,
    referredUserId: referral.referredUserId,
    signal,
    status: 'open',
    note,
    createdAt: now,
  })
}

export async function ensureReferralProgram(ctx: MutationCtx, now: number, actorUserId?: Doc<'users'>['_id']) {
  const existing = await ctx.db.query('referralProgram')
    .withIndex('by_key', (q) => q.eq('key', REFERRAL_PROGRAM_KEY))
    .unique()
  if (existing) return existing
  const id = await ctx.db.insert('referralProgram', {
    key: REFERRAL_PROGRAM_KEY,
    active: DEFAULT_REFERRAL_PROGRAM.active,
    launchBonusCentavos: DEFAULT_REFERRAL_PROGRAM.launchBonusCentavos,
    launchBonusMaxClaims: DEFAULT_REFERRAL_PROGRAM.launchBonusMaxClaims,
    launchBonusClaims: DEFAULT_REFERRAL_PROGRAM.launchBonusClaims,
    launchBonusActive: DEFAULT_REFERRAL_PROGRAM.launchBonusActive,
    updatedByUserId: actorUserId,
    updatedAt: now,
  })
  return await ctx.db.get(id) as Doc<'referralProgram'>
}

export const seedReferralProgram = internalMutation({
  args: {
    active: v.optional(v.boolean()),
    launchBonusActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const row = await ensureReferralProgram(ctx, now)
    await ctx.db.patch(row._id, {
      active: args.active ?? true,
      launchBonusActive: args.launchBonusActive ?? true,
      updatedAt: now,
    })
    return null
  },
})
