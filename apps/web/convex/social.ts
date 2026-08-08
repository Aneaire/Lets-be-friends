import {
  boundedRatio,
  engagementScore,
  freshnessScore,
  isModerationVisible,
  rerankFeedCandidates,
  type FeedCandidateSource,
  type FeedInstrumentationAction,
  type FeedInstrumentationSource,
  type FeedRankingCandidate,
} from '@lets-be-friends/shared'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { hasCurrentIdentityApproval } from './identityVerification'
import { getViewer, requireViewer, writeAudit } from './lib'

const MAX_MEDIA_UPLOADS_PER_DAY = 5
const MEDIA_UPLOAD_WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 50 * 1024 * 1024
const FEED_LIMIT = 50
const FOR_YOU_PAGE_SIZE = 20
const FOR_YOU_CANDIDATE_LIMIT = 120
const MAX_INSTRUMENTATION_BATCH = 20
const FEED_ALGORITHM_VERSION = 'feed_v1'

const feedItemType = v.union(v.literal('post'), v.literal('host'), v.literal('guidance'))
const feedSource = v.union(
  v.literal('followed'),
  v.literal('interest'),
  v.literal('completed_experience'),
  v.literal('trending'),
  v.literal('recent'),
  v.literal('exploration'),
  v.literal('host_fallback'),
  v.literal('first_party_guidance'),
)
const feedAction = v.union(
  v.literal('open_host'),
  v.literal('open_guidance'),
  v.literal('comment'),
  v.literal('like'),
  v.literal('save'),
  v.literal('follow'),
  v.literal('report'),
  v.literal('report_comment'),
)
const feedSurface = v.union(v.literal('for_you'), v.literal('following'), v.literal('saved'))

type PostRankingCandidate = FeedRankingCandidate & {
  post: Doc<'posts'>
  reason: string
}

export const feed = query({
  args: {
    filter: v.optional(v.union(v.literal('for_you'), v.literal('following'), v.literal('saved'))),
    seenItemKeys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    if (viewer?.suspended) throw new Error('Account is suspended')
    const filter = args.filter ?? 'for_you'
    if (filter !== 'for_you' && !viewer) throw new Error('Sign in to use this feed')
    validateSeenItemKeys(args.seenItemKeys)

    if (filter === 'saved' && viewer) {
      const saves = await ctx.db.query('savedPosts').withIndex('by_user', (q) => q.eq('userId', viewer._id)).order('desc').take(FEED_LIMIT)
      const ordered = saves.sort((a, b) => b.createdAt - a.createdAt)
      const posts = (await Promise.all(ordered.map((save) => ctx.db.get(save.postId))))
        .filter((post): post is Doc<'posts'> => post !== null)
      return await postOnlyFeed(ctx, posts, viewer, 'recent', 'You saved this post')
    }

    if (filter === 'following' && viewer) {
      const follows = await ctx.db.query('follows').withIndex('by_follower', (q) => q.eq('followerId', viewer._id)).take(50)
      const followedPosts = await Promise.all(follows.map((follow) => (
        ctx.db.query('posts').withIndex('by_author_hidden_created_at', (q) => q.eq('authorId', follow.followingId).eq('hidden', false)).order('desc').take(FEED_LIMIT)
      )))
      const posts = followedPosts.flat().sort((a, b) => b.createdAt - a.createdAt).slice(0, FEED_LIMIT)
      return await postOnlyFeed(ctx, posts, viewer, 'followed', 'From someone you follow')
    }

    const rankedPosts = await forYouPosts(ctx, viewer, new Set(args.seenItemKeys ?? []))
    const postItems = await Promise.all(rankedPosts.map(async (candidate) => ({
      kind: 'post' as const,
      itemKey: `post:${candidate.post._id}`,
      source: candidate.source,
      reason: candidate.reason,
      post: await enrichPost(ctx, candidate.post, viewer),
    })))
    if (postItems.length >= 8) return postItems
    const hostItems = await approvedHostFallback(ctx, viewer, 3)
    return [
      ...postItems,
      ...hostItems,
      {
        kind: 'guidance' as const,
        itemKey: 'guidance:feed-basics',
        source: 'first_party_guidance' as const,
        reason: 'A quick way to shape your recommendations',
        title: 'Make For You feel more like you',
        body: 'Follow members, save useful posts, and book categories you enjoy. These signals help tune your feed without using exact location data.',
        actionLabel: 'Find Friend Hosts',
        actionHref: '/discover' as const,
      },
    ]
  },
})

export const recordFeedImpressions = mutation({
  args: {
    sessionId: v.string(),
    surface: feedSurface,
    items: v.array(v.object({
      itemKey: v.string(),
      itemType: feedItemType,
      source: feedSource,
      position: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    validateInstrumentationInput(args.sessionId, args.items, true)
    const uniqueItems = [...new Map(args.items.map((item) => [item.itemKey, item])).values()]
    let inserted = 0
    for (const item of uniqueItems) {
      const dedupeKey = instrumentationKey(viewer._id, args.sessionId, args.surface, 'impression', item.itemKey)
      const existing = await ctx.db.query('feedEvents').withIndex('by_dedupe_key', (q) => q.eq('dedupeKey', dedupeKey)).first()
      if (existing) continue
      await ctx.db.insert('feedEvents', {
        userId: viewer._id,
        sessionId: args.sessionId,
        surface: args.surface,
        algorithmVersion: FEED_ALGORITHM_VERSION,
        ...item,
        eventType: 'impression',
        dedupeKey,
        createdAt: Date.now(),
      })
      inserted += 1
    }
    return { inserted }
  },
})

export const recordFeedAction = mutation({
  args: {
    sessionId: v.string(),
    surface: feedSurface,
    itemKey: v.string(),
    itemType: feedItemType,
    source: feedSource,
    action: feedAction,
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    validateInstrumentationInput(args.sessionId, [args], false)
    const dedupeKey = instrumentationKey(viewer._id, args.sessionId, args.surface, 'action', args.itemKey, args.action)
    const existing = await ctx.db.query('feedEvents').withIndex('by_dedupe_key', (q) => q.eq('dedupeKey', dedupeKey)).first()
    if (existing) return { inserted: false }
    await ctx.db.insert('feedEvents', {
      userId: viewer._id,
      sessionId: args.sessionId,
      surface: args.surface,
      algorithmVersion: FEED_ALGORITHM_VERSION,
      itemKey: args.itemKey,
      itemType: args.itemType,
      source: args.source,
      eventType: 'action',
      action: args.action,
      dedupeKey,
      createdAt: Date.now(),
    })
    return { inserted: true }
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

async function postOnlyFeed(
  ctx: any,
  posts: Doc<'posts'>[],
  viewer: Doc<'users'>,
  source: FeedCandidateSource,
  reason: string,
) {
  const safePosts = await safeVisiblePosts(ctx, posts)
  return await Promise.all(safePosts.map(async (post) => ({
    kind: 'post' as const,
    itemKey: `post:${post._id}`,
    source,
    reason,
    post: await enrichPost(ctx, post, viewer),
  })))
}

async function safeVisiblePosts(ctx: any, posts: Doc<'posts'>[]) {
  const checked = await Promise.all(posts.map(async (post) => {
    if (!isModerationVisible(post) || post.deletedAt) return null
    const author = await ctx.db.get(post.authorId)
    return author && !author.suspended ? post : null
  }))
  return checked.filter((post): post is Doc<'posts'> => post !== null)
}

async function forYouPosts(ctx: any, viewer: Doc<'users'> | null, seenItemKeys: Set<string>) {
  const now = Date.now()
  const recentPosts = await ctx.db.query('posts').withIndex('by_created_at').order('desc').take(80)
  const follows = viewer
    ? await ctx.db.query('follows').withIndex('by_follower', (q: any) => q.eq('followerId', viewer._id)).order('desc').take(30)
    : []
  const followedPosts = await Promise.all(follows.map((follow: Doc<'follows'>) => (
    ctx.db.query('posts').withIndex('by_author_hidden_created_at', (q: any) => q.eq('authorId', follow.followingId).eq('hidden', false)).order('desc').take(4)
  )))
  const candidatePosts = [...new Map(
    [...followedPosts.flat(), ...recentPosts].map((post: Doc<'posts'>) => [String(post._id), post]),
  ).values()].slice(0, FOR_YOU_CANDIDATE_LIMIT) as Doc<'posts'>[]
  const safePosts = await safeVisiblePosts(ctx, candidatePosts)
  const followedAuthorIds = new Set(follows.map((follow: Doc<'follows'>) => String(follow.followingId)))
  const interests = await viewerInterests(ctx, viewer)
  const hostProfileCache = new Map<string, Doc<'hostProfiles'> | null>()

  const candidates = (await Promise.all(safePosts.map(async (post): Promise<PostRankingCandidate | null> => {
    const author = await ctx.db.get(post.authorId)
    if (!author || author.suspended) return null
    const [comments, reactions, saves, experienceBooking, authorHost] = await Promise.all([
      ctx.db.query('postComments').withIndex('by_post', (q: any) => q.eq('postId', post._id)).take(50),
      ctx.db.query('postReactions').withIndex('by_post', (q: any) => q.eq('postId', post._id)).take(100),
      ctx.db.query('savedPosts').withIndex('by_post', (q: any) => q.eq('postId', post._id)).take(50),
      post.experienceBookingId ? ctx.db.get(post.experienceBookingId) : null,
      hostProfileForUser(ctx, post.authorId, hostProfileCache),
    ])
    const completedExperience = Boolean(experienceBooking && ['completed', 'review_window', 'closed'].includes(experienceBooking.status))
    const topics = [
      ...(completedExperience ? [experienceBooking!.category] : []),
      ...(authorHost?.categories ?? []),
      ...(authorHost?.strengths ?? []),
    ]
    const topicMatch = bestTopicMatch(topics, interests.categoryWeights, interests.maximumCategoryWeight)
    const category = topicMatch.topic ?? topics[0]
    const categorySignal = topicMatch.score
    const engagement = engagementScore(
      comments.filter(isModerationVisible).length,
      reactions.length,
      saves.length,
    )
    const followed = followedAuthorIds.has(String(post.authorId))
    const relationship = followed
      ? 1
      : interests.bookedHostUserIds.has(String(post.authorId))
        ? 0.85
        : interests.savedHostUserIds.has(String(post.authorId))
          ? 0.7
          : interests.interactedAuthorIds.has(String(post.authorId))
            ? 0.55
            : 0
    const approvedHost = Boolean(
      authorHost?.status === 'approved'
      && hasCurrentIdentityApproval(author, now),
    )
    const trustQuality = completedExperience
      ? 0.9
      : approvedHost && authorHost
        ? 0.5 + boundedRatio(authorHost.rating, 5) * 0.25 + boundedRatio(authorHost.reviewCount, 20) * 0.25
        : 0.25
    const newAuthor = now - author.createdAt <= 30 * 24 * 60 * 60 * 1000
    const underexposure = Math.max(newAuthor ? 0.8 : 0.35, 1 - engagement)
    const source = candidateSource({ followed, categorySignal, completedExperience, engagement, underexposure })

    return {
      id: String(post._id),
      authorId: String(post.authorId),
      category,
      source,
      reason: reasonForSource(source, topicMatch.topic),
      seen: seenItemKeys.has(`post:${post._id}`),
      signals: {
        relationship,
        category: categorySignal,
        freshness: freshnessScore(post.createdAt, now),
        meaningfulEngagement: engagement,
        trustQuality,
        underexposure,
      },
      post,
    }
  }))).filter((candidate): candidate is PostRankingCandidate => candidate !== null)

  return rerankFeedCandidates(candidates, {
    pageSize: FOR_YOU_PAGE_SIZE,
    maxPerAuthor: 2,
    explorationShare: 0.2,
  })
}

async function viewerInterests(ctx: any, viewer: Doc<'users'> | null) {
  const categoryWeights = new Map<string, number>()
  const bookedHostUserIds = new Set<string>()
  const savedHostUserIds = new Set<string>()
  const interactedAuthorIds = new Set<string>()
  if (!viewer) return { categoryWeights, maximumCategoryWeight: 1, bookedHostUserIds, savedHostUserIds, interactedAuthorIds }

  const [bookings, savedProfiles, savedPosts, reactions] = await Promise.all([
    ctx.db.query('bookings').withIndex('by_member', (q: any) => q.eq('memberId', viewer._id)).order('desc').take(50),
    ctx.db.query('savedProfiles').withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).order('desc').take(50),
    ctx.db.query('savedPosts').withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).order('desc').take(50),
    ctx.db.query('postReactions').withIndex('by_user', (q: any) => q.eq('userId', viewer._id)).order('desc').take(50),
  ])
  const bookingHosts = await Promise.all(bookings.map((booking: Doc<'bookings'>) => ctx.db.get(booking.hostProfileId)))
  bookingHosts.forEach((host, index) => {
    if (!host) return
    bookedHostUserIds.add(String(host.userId))
    addCategoryWeight(categoryWeights, bookings[index].category, 3)
    host.strengths.forEach((strength: string) => addCategoryWeight(categoryWeights, strength, 0.5))
  })
  const savedHosts = await Promise.all(savedProfiles.map((saved: Doc<'savedProfiles'>) => ctx.db.get(saved.hostProfileId)))
  savedHosts.forEach((host) => {
    if (!host) return
    savedHostUserIds.add(String(host.userId))
    host.categories.forEach((category: string) => addCategoryWeight(categoryWeights, category, 2))
    host.strengths.forEach((strength: string) => addCategoryWeight(categoryWeights, strength, 0.5))
  })
  const interactedPosts = await Promise.all([
    ...savedPosts.map((saved: Doc<'savedPosts'>) => ctx.db.get(saved.postId)),
    ...reactions.map((reaction: Doc<'postReactions'>) => ctx.db.get(reaction.postId)),
  ])
  const interactionHostCache = new Map<string, Doc<'hostProfiles'> | null>()
  for (const post of interactedPosts) {
    if (!post) continue
    interactedAuthorIds.add(String(post.authorId))
    const host = await hostProfileForUser(ctx, post.authorId, interactionHostCache)
    host?.categories.forEach((category: string) => addCategoryWeight(categoryWeights, category, 1))
    host?.strengths.forEach((strength: string) => addCategoryWeight(categoryWeights, strength, 0.25))
  }
  return {
    categoryWeights,
    maximumCategoryWeight: Math.max(1, ...categoryWeights.values()),
    bookedHostUserIds,
    savedHostUserIds,
    interactedAuthorIds,
  }
}

async function hostProfileForUser(ctx: any, userId: Id<'users'>, cache: Map<string, Doc<'hostProfiles'> | null>) {
  const key = String(userId)
  if (cache.has(key)) return cache.get(key) ?? null
  const host = await ctx.db.query('hostProfiles').withIndex('by_user', (q: any) => q.eq('userId', userId)).first()
  cache.set(key, host)
  return host
}

function addCategoryWeight(weights: Map<string, number>, category: string, amount: number) {
  weights.set(category, Math.min(10, (weights.get(category) ?? 0) + amount))
}

function bestTopicMatch(topics: string[], weights: Map<string, number>, maximumWeight: number) {
  const rankedTopics = [...new Set(topics)].map((topic) => ({
    topic,
    weight: weights.get(topic) ?? 0,
  })).sort((left, right) => right.weight - left.weight || left.topic.localeCompare(right.topic))
  const best = rankedTopics[0]
  if (!best || best.weight <= 0) return { topic: undefined, score: 0 }
  return { topic: best.topic, score: boundedRatio(best.weight, maximumWeight) }
}

function candidateSource(input: {
  followed: boolean
  categorySignal: number
  completedExperience: boolean
  engagement: number
  underexposure: number
}): FeedCandidateSource {
  if (input.followed) return 'followed'
  if (input.categorySignal > 0) return 'interest'
  if (input.completedExperience) return 'completed_experience'
  if (input.engagement >= 0.45) return 'trending'
  if (input.underexposure >= 0.72) return 'exploration'
  return 'recent'
}

function reasonForSource(source: FeedCandidateSource, category?: string) {
  if (source === 'followed') return 'From someone you follow'
  if (source === 'interest') return category ? `Matches your interest in ${category}` : 'Matches your activity interests'
  if (source === 'completed_experience') return 'A recent completed experience'
  if (source === 'trending') return 'A conversation members are joining'
  if (source === 'exploration') return 'A newer voice to discover'
  return 'Fresh from the community'
}

async function approvedHostFallback(ctx: any, viewer: Doc<'users'> | null, limit: number) {
  const interests = await viewerInterests(ctx, viewer)
  const hosts = await ctx.db.query('hostProfiles').withIndex('by_status', (q: any) => q.eq('status', 'approved')).take(20)
  const safeHosts = (await Promise.all(hosts.map(async (host: Doc<'hostProfiles'>) => {
    const user = await ctx.db.get(host.userId)
    if (!user || user.suspended || !hasCurrentIdentityApproval(user) || user._id === viewer?._id) return null
    const topicMatch = bestTopicMatch([...host.categories, ...host.strengths], interests.categoryWeights, interests.maximumCategoryWeight)
    return {
      overlap: topicMatch.score,
      evidence: boundedRatio(host.rating, 5) * 0.7 + boundedRatio(host.reviewCount, 20) * 0.3,
      item: {
        kind: 'host' as const,
        itemKey: `host:${host._id}`,
        source: 'host_fallback' as const,
        reason: topicMatch.topic ? `Matches your interest in ${topicMatch.topic}` : 'An approved Friend Host to explore',
        host: {
          _id: host._id,
          displayName: user.displayName,
          intro: host.intro,
          strengths: host.strengths.slice(0, 3),
          categories: host.categories.slice(0, 3),
          mode: host.mode,
          rating: host.rating,
          reviewCount: host.reviewCount,
        },
      },
    }
  }))).filter((host) => host !== null)
  return safeHosts
    .sort((left, right) => (
      right.overlap - left.overlap
      || right.evidence - left.evidence
      || String(left.item.host._id).localeCompare(String(right.item.host._id))
    ))
    .slice(0, limit)
    .map(({ item }) => item)
}

function validateSeenItemKeys(itemKeys: string[] | undefined) {
  if (!itemKeys) return
  if (itemKeys.length > 100) throw new Error('Too many seen feed items')
  if (itemKeys.some((key) => key.length < 1 || key.length > 96)) throw new Error('Invalid seen feed item key')
}

function validateInstrumentationInput(
  sessionId: string,
  items: Array<{ itemKey: string; source: FeedInstrumentationSource; position?: number }>,
  requirePosition: boolean,
) {
  if (sessionId.length < 8 || sessionId.length > 64) throw new Error('Feed session ID must be between 8 and 64 characters')
  if (items.length < 1 || items.length > MAX_INSTRUMENTATION_BATCH) throw new Error(`Feed events must include 1 to ${MAX_INSTRUMENTATION_BATCH} items`)
  for (const item of items) {
    if (item.itemKey.length < 1 || item.itemKey.length > 96) throw new Error('Feed item key must be between 1 and 96 characters')
    if (requirePosition && (!Number.isInteger(item.position) || item.position! < 0 || item.position! > 99)) {
      throw new Error('Feed impression position must be an integer from 0 to 99')
    }
  }
}

function instrumentationKey(
  userId: Id<'users'>,
  sessionId: string,
  surface: 'for_you' | 'following' | 'saved',
  eventType: 'impression' | 'action',
  itemKey: string,
  action: FeedInstrumentationAction | '' = '',
) {
  return `${userId}|${sessionId}|${surface}|${eventType}|${itemKey}|${action}`
}

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
