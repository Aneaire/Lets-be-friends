import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireViewer, writeAudit } from './lib'

export const relationship = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const own = await preference(ctx, viewer._id, args.userId)
    const other = await preference(ctx, args.userId, viewer._id)
    return { blocked: Boolean(own?.blockedAt), muted: Boolean(own?.mutedAt), blockedByOther: Boolean(other?.blockedAt) }
  },
})

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    const rows = await ctx.db.query('memberSafetyPreferences').withIndex('by_owner', (q) => q.eq('ownerUserId', viewer._id)).collect()
    return await Promise.all(rows.filter((row) => row.blockedAt || row.mutedAt).map(async (row) => {
      const target = await ctx.db.get(row.targetUserId)
      return { userId: row.targetUserId, displayName: target?.displayName ?? 'Member', profileImageUrl: target?.profileImageStorageId ? await ctx.storage.getUrl(target.profileImageStorageId) : target?.profileImageUrl, blockedAt: row.blockedAt, mutedAt: row.mutedAt }
    }))
  },
})

export const setBlocked = mutation({
  args: { userId: v.id('users'), blocked: v.boolean() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    await requireTarget(ctx, viewer._id, args.userId)
    const row = await preference(ctx, viewer._id, args.userId)
    const now = Date.now()
    if (args.blocked) {
      if (row) await ctx.db.patch(row._id, { blockedAt: row.blockedAt ?? now, updatedAt: now })
      else await ctx.db.insert('memberSafetyPreferences', { ownerUserId: viewer._id, targetUserId: args.userId, pairKey: directedPairKey(viewer._id, args.userId), blockedAt: now, createdAt: now, updatedAt: now })
      const follows = await Promise.all([
        ctx.db.query('follows').withIndex('by_pair', (q) => q.eq('followerId', viewer._id).eq('followingId', args.userId)).first(),
        ctx.db.query('follows').withIndex('by_pair', (q) => q.eq('followerId', args.userId).eq('followingId', viewer._id)).first(),
      ])
      await Promise.all(follows.filter(Boolean).map((follow) => ctx.db.delete(follow!._id)))
    } else if (row) {
      if (row.mutedAt) await ctx.db.patch(row._id, { blockedAt: undefined, updatedAt: now })
      else await ctx.db.delete(row._id)
    }
    await writeAudit(ctx, { actorUserId: viewer._id, action: args.blocked ? 'member.blocked' : 'member.unblocked', targetType: 'user', targetId: String(args.userId) })
    return args.blocked
  },
})

export const setMuted = mutation({
  args: { userId: v.id('users'), muted: v.boolean() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    await requireTarget(ctx, viewer._id, args.userId)
    const row = await preference(ctx, viewer._id, args.userId)
    const now = Date.now()
    if (args.muted) {
      if (row) await ctx.db.patch(row._id, { mutedAt: row.mutedAt ?? now, updatedAt: now })
      else await ctx.db.insert('memberSafetyPreferences', { ownerUserId: viewer._id, targetUserId: args.userId, pairKey: directedPairKey(viewer._id, args.userId), mutedAt: now, createdAt: now, updatedAt: now })
    } else if (row) {
      if (row.blockedAt) await ctx.db.patch(row._id, { mutedAt: undefined, updatedAt: now })
      else await ctx.db.delete(row._id)
    }
    await writeAudit(ctx, { actorUserId: viewer._id, action: args.muted ? 'member.muted' : 'member.unmuted', targetType: 'user', targetId: String(args.userId) })
    return args.muted
  },
})

export async function areUsersBlocked(ctx: { db: any }, first: Id<'users'>, second: Id<'users'>) {
  const [forward, reverse] = await Promise.all([preference(ctx, first, second), preference(ctx, second, first)])
  return Boolean(forward?.blockedAt || reverse?.blockedAt)
}

export async function isHiddenByPreference(ctx: { db: any }, viewerId: Id<'users'>, authorId: Id<'users'>) {
  const [own, reverse] = await Promise.all([preference(ctx, viewerId, authorId), preference(ctx, authorId, viewerId)])
  return Boolean(own?.blockedAt || own?.mutedAt || reverse?.blockedAt)
}

export async function requireNotBlocked(ctx: { db: any }, first: Id<'users'>, second: Id<'users'>) {
  if (await areUsersBlocked(ctx, first, second)) throw new Error('Contact is unavailable because one member has blocked the other')
}

export async function preference(ctx: { db: any }, ownerUserId: Id<'users'>, targetUserId: Id<'users'>) {
  return await ctx.db.query('memberSafetyPreferences').withIndex('by_pair', (q: any) => q.eq('pairKey', directedPairKey(ownerUserId, targetUserId))).unique()
}

function directedPairKey(ownerUserId: Id<'users'>, targetUserId: Id<'users'>) {
  return `${ownerUserId}:${targetUserId}`
}

async function requireTarget(ctx: { db: any }, viewerId: Id<'users'>, targetUserId: Id<'users'>) {
  if (viewerId === targetUserId) throw new Error('You cannot block or mute yourself')
  const target = await ctx.db.get(targetUserId)
  if (!target) throw new Error('Member not found')
  return target
}
