import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

async function getClerkUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.subject ?? null
}

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const clerkUserId = await getClerkUserId(ctx)
    if (!clerkUserId) return null
    return await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId)).unique()
  },
})

export const ensureViewer = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const clerkUserId = await getClerkUserId(ctx)
    if (!clerkUserId) throw new Error('Authentication required')
    const now = Date.now()
    const existing = await ctx.db.query('users').withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId)).unique()
    if (existing) {
      await ctx.db.patch(existing._id, { displayName: args.displayName, updatedAt: now })
      return existing._id
    }
    return await ctx.db.insert('users', { clerkUserId, displayName: args.displayName, role: 'member', verificationStatus: 'not_started', suspended: false, createdAt: now, updatedAt: now })
  },
})
