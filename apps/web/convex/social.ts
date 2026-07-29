import { isModerationVisible } from '@lets-be-friends/shared'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { getViewer, requireViewer, writeAudit } from './lib'

const MAX_MEDIA_UPLOADS_PER_DAY = 5
const MEDIA_UPLOAD_WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 50 * 1024 * 1024
const FEED_LIMIT = 50

export const feed = query({
  args: { filter: v.optional(v.union(v.literal('all'), v.literal('following'), v.literal('saved'))) },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    if (viewer?.suspended) throw new Error('Account is suspended')
    const filter = args.filter ?? 'all'
    if (filter !== 'all' && !viewer) throw new Error('Sign in to use this feed')

    let posts: Doc<'posts'>[]
    if (filter === 'saved' && viewer) {
      const saves = await ctx.db.query('savedPosts').withIndex('by_user', (q) => q.eq('userId', viewer._id)).collect()
      posts = (await Promise.all(saves.map((save) => ctx.db.get(save.postId))))
        .filter((post): post is Doc<'posts'> => post !== null)
    } else if (filter === 'following' && viewer) {
      const follows = await ctx.db.query('follows').withIndex('by_follower', (q) => q.eq('followerId', viewer._id)).collect()
      const followedPosts = await Promise.all(follows.map((follow) => (
        ctx.db.query('posts').withIndex('by_author_hidden_created_at', (q) => q.eq('authorId', follow.followingId).eq('hidden', false)).order('desc').take(FEED_LIMIT)
      )))
      posts = followedPosts.flat().sort((a, b) => b.createdAt - a.createdAt).slice(0, FEED_LIMIT)
    } else {
      posts = await ctx.db.query('posts').withIndex('by_created_at').order('desc').take(FEED_LIMIT)
    }

    return await Promise.all(posts.filter(isModerationVisible).map((post) => enrichPost(ctx, post, viewer)))
  },
})

export const byUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    const posts = await ctx.db.query('posts').withIndex('by_author', (q) => q.eq('authorId', args.userId)).order('desc').take(30)
    return await Promise.all(posts.filter(isModerationVisible).map((post) => enrichPost(ctx, post, viewer)))
  },
})

export const commentsForPost = query({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post || !isModerationVisible(post)) return []
    const comments = await ctx.db.query('postComments').withIndex('by_post', (q) => q.eq('postId', args.postId)).collect()
    return await Promise.all(comments
      .filter(isModerationVisible)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(async (comment) => {
        const author = await ctx.db.get(comment.authorId)
        return {
          ...comment,
          authorDisplayName: author?.displayName ?? 'Member',
          ownComment: viewer?._id === comment.authorId,
        }
      }))
  },
})

export const mediaUploadUsage = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx)
    if (!viewer) return { used: 0, remaining: 0, limit: MAX_MEDIA_UPLOADS_PER_DAY }
    if (viewer.suspended) throw new Error('Account is suspended')
    const used = await mediaUploadGrantsInWindow(ctx, viewer._id, Date.now())
    return {
      used,
      remaining: Math.max(0, MAX_MEDIA_UPLOADS_PER_DAY - used),
      limit: MAX_MEDIA_UPLOADS_PER_DAY,
    }
  },
})

export const createPost = mutation({
  args: {
    body: v.string(),
    mediaUploadIds: v.optional(v.array(v.id('postMediaUploads'))),
    experienceBookingId: v.optional(v.id('bookings')),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const body = args.body.trim()
    const mediaUploadIds = args.mediaUploadIds ?? []
    if (body.length < 1 && mediaUploadIds.length === 0) throw new Error('Post cannot be empty')
    if (body.length > 1000) throw new Error('Post is too long')
    if (mediaUploadIds.length > MAX_MEDIA_UPLOADS_PER_DAY) throw new Error('Posts can include up to 5 media uploads')
    if (new Set(mediaUploadIds.map(String)).size !== mediaUploadIds.length) throw new Error('Each media upload can be attached only once')

    const uploads = await Promise.all(mediaUploadIds.map((uploadId) => ctx.db.get(uploadId)))
    for (const upload of uploads) {
      if (!upload || upload.userId !== viewer._id) throw new Error('Media upload is not owned by this account')
      if (!upload.storageId || !upload.kind || !upload.contentType || typeof upload.size !== 'number' || !upload.registeredAt) throw new Error('Media upload is not registered')
      if (upload.postId || upload.discardedAt) throw new Error('Media upload has already been claimed')
    }

    if (args.experienceBookingId) {
      const booking = await ctx.db.get(args.experienceBookingId)
      if (!booking) throw new Error('Booking not found')
      const host = await ctx.db.get(booking.hostProfileId)
      if (booking.memberId !== viewer._id && host?.userId !== viewer._id) throw new Error('Not your booking')
      if (!['completed', 'review_window', 'closed'].includes(booking.status)) throw new Error('Experience posts need a completed booking')
    }

    const now = Date.now()
    const media = uploads.map((upload) => ({
      storageId: upload!.storageId!,
      kind: upload!.kind!,
      contentType: upload!.contentType!,
      size: upload!.size!,
    }))
    const postId = await ctx.db.insert('posts', {
      authorId: viewer._id,
      body,
      media,
      experienceBookingId: args.experienceBookingId,
      reportable: true,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    })
    await Promise.all(mediaUploadIds.map((uploadId) => ctx.db.patch(uploadId, { postId })))
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'post.created', targetType: 'post', targetId: String(postId) })
    return postId
  },
})

export const editPost = mutation({
  args: { postId: v.id('posts'), body: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post || post.authorId !== viewer._id || post.deletedAt) throw new Error('Only the author can edit this post')
    const body = args.body.trim()
    if (!body && (post.media?.length ?? 0) === 0) throw new Error('Post cannot be empty')
    if (body.length > 1000) throw new Error('Post is too long')
    await ctx.db.patch(args.postId, { body, updatedAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'post.edited', targetType: 'post', targetId: String(args.postId) })
  },
})

export const deletePost = mutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post || post.authorId !== viewer._id) throw new Error('Only the author can delete this post')
    if (post.deletedAt) return
    const now = Date.now()
    await ctx.db.patch(args.postId, { hidden: true, deletedAt: now, updatedAt: now })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'post.deleted', targetType: 'post', targetId: String(args.postId) })
  },
})

export const createComment = mutation({
  args: { postId: v.id('posts'), body: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post || post.hidden) throw new Error('Post not found')
    const body = args.body.trim()
    if (body.length < 1) throw new Error('Comment cannot be empty')
    if (body.length > 500) throw new Error('Comment is too long')
    const now = Date.now()
    const commentId = await ctx.db.insert('postComments', {
      postId: args.postId,
      authorId: viewer._id,
      body,
      reportable: true,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'post.comment.created', targetType: 'post', targetId: String(args.postId) })
    return commentId
  },
})

export const generatePostMediaUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    const now = Date.now()
    const used = await mediaUploadGrantsInWindow(ctx, viewer._id, now)
    if (used >= MAX_MEDIA_UPLOADS_PER_DAY) throw new Error('Daily media upload limit reached')
    const uploadId = await ctx.db.insert('postMediaUploads', { userId: viewer._id, createdAt: now })
    const uploadUrl = await ctx.storage.generateUploadUrl()
    return { uploadUrl, uploadId }
  },
})

export const registerPostMediaUpload = mutation({
  args: { uploadId: v.id('postMediaUploads'), storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const upload = await ctx.db.get(args.uploadId)
    if (!upload || upload.userId !== viewer._id) throw new Error('Media upload grant not found')
    if (upload.storageId || upload.registeredAt || upload.postId || upload.discardedAt) throw new Error('Media upload grant has already been used')
    const existingClaim = await ctx.db.query('postMediaUploads').withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId)).first()
    if (existingClaim) throw new Error('Uploaded media has already been claimed')
    await requireStorageCreatedForGrant(ctx, args.storageId, upload.createdAt)
    if (await isStorageReferencedByPost(ctx, args.storageId)) throw new Error('Uploaded media is already attached to a post')
    const media = await validatedMediaStorage(ctx, args.storageId)
    const now = Date.now()
    await ctx.db.patch(args.uploadId, { storageId: args.storageId, ...media, registeredAt: now })
    return { uploadId: args.uploadId, storageId: args.storageId, ...media }
  },
})

export const discardPostMediaUpload = mutation({
  args: { uploadId: v.id('postMediaUploads'), storageId: v.optional(v.id('_storage')) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const upload = await ctx.db.get(args.uploadId)
    if (!upload || upload.userId !== viewer._id) throw new Error('Media upload grant not found')
    if (upload.postId) throw new Error('Claimed post media cannot be discarded')
    if (upload.discardedAt) return

    if (upload.storageId) {
      if (args.storageId && args.storageId !== upload.storageId) throw new Error('Storage object does not match this media grant')
      await ctx.storage.delete(upload.storageId)
    } else if (args.storageId) {
      if (upload.registeredAt) throw new Error('Registered media grant is missing its storage object')
      const existingClaim = await ctx.db.query('postMediaUploads').withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId)).first()
      if (existingClaim) throw new Error('Uploaded media has already been claimed')
      await requireStorageCreatedForGrant(ctx, args.storageId, upload.createdAt)
      if (await isStorageReferencedByPost(ctx, args.storageId)) throw new Error('Uploaded media is already attached to a post')
      await ctx.storage.delete(args.storageId)
    }

    await ctx.db.patch(args.uploadId, { discardedAt: Date.now() })
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

export const toggleLike = mutation({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post || post.hidden) throw new Error('Post not found')
    const existing = await ctx.db.query('postReactions').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('postId', args.postId)).first()
    if (existing) {
      await ctx.db.delete(existing._id)
      return false
    }
    await ctx.db.insert('postReactions', { userId: viewer._id, postId: args.postId, reaction: 'like', createdAt: Date.now() })
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

async function enrichPost(ctx: any, post: Doc<'posts'>, viewer: Doc<'users'> | null) {
  const [author, comments, reactions, saved, following] = await Promise.all([
    ctx.db.get(post.authorId),
    ctx.db.query('postComments').withIndex('by_post', (q: any) => q.eq('postId', post._id)).collect(),
    ctx.db.query('postReactions').withIndex('by_post', (q: any) => q.eq('postId', post._id)).collect(),
    viewer ? ctx.db.query('savedPosts').withIndex('by_pair', (q: any) => q.eq('userId', viewer._id).eq('postId', post._id)).first() : null,
    viewer ? ctx.db.query('follows').withIndex('by_pair', (q: any) => q.eq('followerId', viewer._id).eq('followingId', post.authorId)).first() : null,
  ])
  return {
    ...post,
    media: await mediaWithUrls(ctx, post.media),
    commentCount: comments.filter(isModerationVisible).length,
    likeCount: reactions.length,
    liked: viewer ? reactions.some((reaction: Doc<'postReactions'>) => reaction.userId === viewer._id) : false,
    authorDisplayName: author?.displayName ?? 'Member',
    saved: Boolean(saved),
    followingAuthor: Boolean(following),
    ownPost: viewer?._id === post.authorId,
  }
}

async function mediaWithUrls(ctx: any, media: Doc<'posts'>['media']) {
  return await Promise.all((media ?? []).map(async (item) => ({
    ...item,
    url: await ctx.storage.getUrl(item.storageId),
  })))
}

async function mediaUploadGrantsInWindow(ctx: any, userId: Id<'users'>, now: number) {
  const grants = await ctx.db.query('postMediaUploads').withIndex('by_user_created_at', (q: any) => (
    q.eq('userId', userId).gte('createdAt', now - MEDIA_UPLOAD_WINDOW_MS)
  )).collect()
  return grants.length
}

async function requireStorageCreatedForGrant(ctx: any, storageId: Id<'_storage'>, grantCreatedAt: number) {
  const metadata = await ctx.db.system.get('_storage', storageId)
  if (!metadata) throw new Error('Uploaded media was not found')
  if (metadata._creationTime < grantCreatedAt) throw new Error('Uploaded media predates this grant')
  return metadata
}

async function isStorageReferencedByPost(ctx: any, storageId: Id<'_storage'>) {
  const posts = await ctx.db.query('posts').collect()
  return posts.some((post: Doc<'posts'>) => post.media?.some((item) => item.storageId === storageId))
}

async function validatedMediaStorage(ctx: any, storageId: Id<'_storage'>): Promise<{ kind: 'image' | 'video'; contentType: string; size: number }> {
  const metadata = await ctx.db.system.get('_storage', storageId)
  if (!metadata) throw new Error('Uploaded media was not found')
  const contentType = metadata.contentType
  const kind = contentType?.startsWith('image/') ? 'image' : contentType?.startsWith('video/') ? 'video' : null
  if (!kind || !contentType) throw new Error('Posts can include photos and video only')
  const maxSize = kind === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
  if (metadata.size > maxSize) {
    throw new Error(kind === 'image' ? 'Photos must be 10 MB or smaller' : 'Videos must be 50 MB or smaller')
  }
  return { kind, contentType, size: metadata.size }
}
