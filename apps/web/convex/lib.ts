import type { Id } from './_generated/dataModel'

export async function getViewer(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> }; db: any }) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return await ctx.db.query('users').withIndex('by_clerk_user_id', (q: any) => q.eq('clerkUserId', identity.subject)).unique()
}

export async function requireViewer(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> }; db: any }) {
  const viewer = await getViewer(ctx)
  if (!viewer) throw new Error('Profile sync required')
  if (viewer.suspended) throw new Error('Account is suspended')
  return viewer
}

export function canChatForStatus(status: string) {
  return ['request_sent', 'accepted', 'completed', 'review_window'].includes(status)
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
