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
