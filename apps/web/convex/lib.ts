import { canBookingChat } from '@lets-be-friends/shared'
import { ConvexError } from 'convex/values'
import type { Id } from './_generated/dataModel'

export async function getViewer(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> }; db: any }) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return await ctx.db.query('users').withIndex('by_clerk_user_id', (q: any) => q.eq('clerkUserId', identity.subject)).unique()
}

export async function requireViewer(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> }; db: any }) {
  const viewer = await getViewer(ctx)
  // ConvexError is required for the client to receive the message: Convex redacts
  // a plain Error's text in production and sends only the envelope.
  if (!viewer) throw new ConvexError('Profile sync required')
  if (viewer.suspended) throw new ConvexError('Account is suspended')
  return viewer
}

export function canChatForStatus(status: Parameters<typeof canBookingChat>[0]) {
  return canBookingChat(status)
}

export async function writeAudit(
  ctx: { db: any },
  input: {
    actorUserId?: Id<'users'>
    action: string
    targetType: string
    targetId?: string
    before?: unknown
    after?: unknown
    note?: string
  },
) {
  await ctx.db.insert('auditLogs', { ...input, createdAt: Date.now() })
}
