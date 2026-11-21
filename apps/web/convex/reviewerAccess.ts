import { ConvexError, v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { applyWalletTransaction, getOrCreateUserWalletAccount } from './finance'
import { writeAudit } from './lib'

// Prepares a member account for Google Play review. The reviewer signs in with
// the account first, then this internal mutation approves identity and credits a
// small test balance through the wallet ledger, so no balance is ever edited by
// hand. Internal only: it is not reachable from the client.
//
// Run it from the repository:
//   npx convex run --prod internal:reviewerAccess.prepareReviewerAccount \
//     '{"confirm":"reviewer","clerkUserId":"...","fundCentavos":50000}'

const REVIEWER_CONFIRMATION = 'reviewer'
const DEFAULT_FUND_CENTAVOS = 50_000
const IDENTITY_VALIDITY_MS = 365 * 24 * 60 * 60 * 1_000

export const prepareReviewerAccount = internalMutation({
  args: {
    confirm: v.string(),
    clerkUserId: v.string(),
    fundCentavos: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== REVIEWER_CONFIRMATION) {
      throw new ConvexError('Pass confirm: "reviewer" to prepare a review account')
    }
    const fundCentavos = args.fundCentavos ?? DEFAULT_FUND_CENTAVOS
    if (!Number.isSafeInteger(fundCentavos) || fundCentavos <= 0) {
      throw new ConvexError('Fund amount must be a positive whole number of centavos')
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', args.clerkUserId))
      .unique()
    if (!user) throw new ConvexError('Sign the reviewer account in once before preparing it')
    if (user.deletedAt) throw new ConvexError('This account was deleted and cannot be used for review')

    const now = Date.now()
    await ctx.db.patch(user._id, {
      verificationStatus: 'approved',
      verificationSource: 'in_app',
      identityVerifiedAt: now,
      identityExpiresAt: now + IDENTITY_VALIDITY_MS,
      updatedAt: now,
    })

    const wallet = await getOrCreateUserWalletAccount(ctx, user._id, now)
    const applied = await applyWalletTransaction(ctx, {
      kind: 'test_member_credit',
      idempotencyKey: `reviewer:prepare:${String(user._id)}:${fundCentavos}`,
      actorUserId: user._id,
      amountCentavos: fundCentavos,
      note: args.note?.trim() || 'Play reviewer test balance',
      now,
      legs: [
        { accountId: wallet._id, bucket: 'available', direction: 'credit', amountCentavos: fundCentavos },
      ],
      allowExternalCredit: true,
    })

    if (applied) {
      await writeAudit(ctx, {
        actorUserId: user._id,
        action: 'reviewer.account_prepared',
        targetType: 'user',
        targetId: String(user._id),
        note: `Identity approved and ${fundCentavos} centavos credited for Play review`,
      })
    }

    const updatedWallet = await ctx.db.get(wallet._id)
    return {
      userId: user._id,
      clerkUserId: user.clerkUserId,
      displayName: user.displayName,
      identityApproved: true,
      fundApplied: applied,
      availableCentavos: updatedWallet?.availableCentavos ?? 0,
    }
  },
})

// Clears a test member's wallet so account deletion can be exercised. The
// deletion flow refuses while any bucket holds money, and editing a balance by
// hand would leave the ledger inconsistent. This debits every bucket to zero in
// one audited transaction. Internal only.
export const clearMemberBalance = internalMutation({
  args: {
    confirm: v.string(),
    clerkUserId: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== REVIEWER_CONFIRMATION) {
      throw new ConvexError('Pass confirm: "reviewer" to clear a test balance')
    }
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', args.clerkUserId))
      .unique()
    if (!user) throw new ConvexError('No member exists for that Clerk user ID')

    const wallet = await getOrCreateUserWalletAccount(ctx, user._id, Date.now())
    const buckets = [
      { bucket: 'available' as const, amount: wallet.availableCentavos ?? 0 },
      { bucket: 'reserved' as const, amount: wallet.reservedCentavos ?? 0 },
      { bucket: 'pending' as const, amount: wallet.pendingCentavos ?? 0 },
    ].filter((entry) => entry.amount > 0)

    const referralTotal = (wallet.referralPendingCentavos ?? 0) + (wallet.referralCreditCentavos ?? 0)
    if (buckets.length === 0 && referralTotal === 0) {
      return { userId: user._id, clearedCentavos: 0, cleared: false }
    }

    const total = buckets.reduce((sum, entry) => sum + entry.amount, 0)
    const now = Date.now()
    const applied = await applyWalletTransaction(ctx, {
      kind: 'wallet_consolidation',
      idempotencyKey: `test-clear:${String(user._id)}:${now}`,
      actorUserId: user._id,
      amountCentavos: total,
      note: args.note?.trim() || 'Test cleanup: cleared balance for account deletion check',
      now,
      legs: buckets.map((entry) => ({
        accountId: wallet._id,
        bucket: entry.bucket,
        direction: 'debit' as const,
        amountCentavos: entry.amount,
      })),
      allowExternalDebit: true,
    })

    if (applied) {
      await writeAudit(ctx, {
        actorUserId: user._id,
        action: 'test.balance_cleared',
        targetType: 'user',
        targetId: String(user._id),
        note: `Cleared ${total} centavos for an account deletion check`,
      })
    }

    const updated = await ctx.db.get(wallet._id)
    return {
      userId: user._id,
      clearedCentavos: total,
      cleared: applied,
      availableCentavos: updated?.availableCentavos ?? 0,
      reservedCentavos: updated?.reservedCentavos ?? 0,
      pendingCentavos: updated?.pendingCentavos ?? 0,
      referralPendingCentavos: updated?.referralPendingCentavos ?? 0,
      referralCreditCentavos: updated?.referralCreditCentavos ?? 0,
    }
  },
})
