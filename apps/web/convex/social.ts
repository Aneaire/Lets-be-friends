import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getViewer, requireViewer, writeAudit } from './lib'

export const feed = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    const posts = await ctx.db.query('posts').withIndex('by_created_at').order('desc').take(50)
    return await Promise.all(posts.filter((post) => !post.hidden).map(async (post) => {
      const author = await ctx.db.get(post.authorId)
      return {
        ...post,
        authorDisplayName: author?.displayName ?? 'Member',
        saved: viewer ? Boolean(await ctx.db.query('savedPosts').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('postId', post._id)).first()) : false,
        followingAuthor: viewer ? Boolean(await ctx.db.query('follows').withIndex('by_pair', (q) => q.eq('followerId', viewer._id).eq('followingId', post.authorId)).first()) : false,
        ownPost: viewer?._id === post.authorId,
      }
    }))
  },
})

export const byUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    const posts = await ctx.db.query('posts').withIndex('by_author', (q) => q.eq('authorId', args.userId)).order('desc').take(30)
    const author = await ctx.db.get(args.userId)
    return await Promise.all(posts.filter((post) => !post.hidden).map(async (post) => ({
      ...post,
      authorDisplayName: author?.displayName ?? 'Member',
      saved: viewer ? Boolean(await ctx.db.query('savedPosts').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('postId', post._id)).first()) : false,
      ownPost: viewer?._id === post.authorId,
    })))
  },
})

export const createPost = mutation({
  args: {
    body: v.string(),
    experienceBookingId: v.optional(v.id('bookings')),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const body = args.body.trim()
    if (body.length < 1) throw new Error('Post cannot be empty')
    if (body.length > 1000) throw new Error('Post is too long')
    if (args.experienceBookingId) {
      const booking = await ctx.db.get(args.experienceBookingId)
      if (!booking) throw new Error('Booking not found')
      const host = await ctx.db.get(booking.hostProfileId)
      if (booking.memberId !== viewer._id && host?.userId !== viewer._id) throw new Error('Not your booking')
      if (!['completed', 'review_window', 'closed'].includes(booking.status)) throw new Error('Experience posts need a completed booking')
    }
    const now = Date.now()
    const postId = await ctx.db.insert('posts', {
      authorId: viewer._id,
      body,
      experienceBookingId: args.experienceBookingId,
      reportable: true,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'post.created', targetType: 'post', targetId: String(postId) })
    return postId
  },
})

export const toggleSavePost = mutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post || post.hidden) throw new Error('Post not found')
    const existing = await ctx.db.query('savedPosts').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('postId', args.postId)).first()
    if (existing) {
      await ctx.db.delete(existing._id)
      await writeAudit(ctx, { actorUserId: viewer._id, action: 'post.unsaved', targetType: 'post', targetId: String(args.postId) })
      return false
    }
    await ctx.db.insert('savedPosts', { userId: viewer._id, postId: args.postId, createdAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'post.saved', targetType: 'post', targetId: String(args.postId) })
    return true
  },
})

export const toggleFollow = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (viewer._id === args.userId) throw new Error('You cannot follow yourself')
    const target = await ctx.db.get(args.userId)
    if (!target || target.suspended) throw new Error('User not found')
    const existing = await ctx.db.query('follows').withIndex('by_pair', (q) => q.eq('followerId', viewer._id).eq('followingId', args.userId)).first()
    if (existing) {
      await ctx.db.delete(existing._id)
      await writeAudit(ctx, { actorUserId: viewer._id, action: 'user.unfollowed', targetType: 'user', targetId: String(args.userId) })
      return false
    }
    await ctx.db.insert('follows', { followerId: viewer._id, followingId: args.userId, createdAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'user.followed', targetType: 'user', targetId: String(args.userId) })
    return true
  },
})
