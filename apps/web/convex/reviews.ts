import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { bookingStatusAfterReview, canReviewBooking, isModerationVisible } from '@lets-be-friends/shared'
import type { Doc, Id } from './_generated/dataModel'
import { adjustCounter } from './counters'
import { getViewer, requireViewer, writeAudit } from './lib'
import { createNotification } from './notifications'
import { consumeRateLimit } from './rateLimit'
import { requireNotBlocked } from './safety'

const MAX_REVIEW_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_REVIEW_IMAGES = 4
const MAX_REVIEW_UPLOADS_PER_DAY = 12
const REVIEW_UPLOAD_WINDOW_MS = 24 * 60 * 60 * 1_000
const MAX_REVIEW_COMMENTS = 20

export const forCompanion = query({
  args: { companionProfileId: v.id('companionProfiles') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx).catch(() => null)
    const reviews = await ctx.db.query('reviews').withIndex('by_companion_profile', (q) => q.eq('companionProfileId', args.companionProfileId)).order('desc').take(20)
    return await Promise.all(reviews.filter(isModerationVisible).map((review) => enrichReview(ctx, review, viewer, { includeComments: true })))
  },
})

export const requested = query({
  args: { reviewId: v.id('reviews') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx).catch(() => null)
    const review = await ctx.db.get(args.reviewId)
    if (!review || !isModerationVisible(review) || !review.companionProfileId) return null
    const companion = await ctx.db.get(review.companionProfileId)
    if (!companion || companion.status !== 'approved') return null
    return await enrichReview(ctx, review, viewer, { includeComments: true })
  },
})

/**
 * The signed-in reviewer's own submission, used by the review permalink. This
 * stays private to the reviewer so a Companion's review of a member is never
 * exposed through the public Companion profile surfaces.
 */
export const viewerSubmission = query({
  args: { reviewId: v.id('reviews') },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx)
    if (!viewer || viewer.suspended) return null
    const review = await ctx.db.get(args.reviewId)
    if (!review || review.reviewerId !== viewer._id || !isModerationVisible(review)) return null
    const [companion, reviewee] = await Promise.all([
      review.companionProfileId ? ctx.db.get(review.companionProfileId) : null,
      ctx.db.get(review.revieweeId),
    ])
    const companionUser = companion ? await ctx.db.get(companion.userId) : null
    return {
      ...await enrichReview(ctx, review, viewer, { includeComments: true }),
      companionDisplayName: companionUser?.displayName ?? companion?.displayName,
      revieweeDisplayName: reviewee ? fullName(reviewee) : undefined,
    }
  },
})

/**
 * Flattens a review into the shape web and mobile render. Comments are only
 * loaded when a detail surface needs them; feed cards leave them empty so the
 * feed does not pay for a thread it does not show.
 */
export async function enrichReview(
  ctx: any,
  review: Doc<'reviews'>,
  viewer: Doc<'users'> | null,
  options: { includeComments?: boolean } = {},
) {
  const includeComments = options.includeComments ?? false
  const reviewer = await ctx.db.get(review.reviewerId)
  const storageIds = review.imageStorageIds?.length
    ? review.imageStorageIds
    : review.imageStorageId
      ? [review.imageStorageId]
      : []
  const [likedReaction, savedRow, imageUrls, reviewerProfileImageUrl] = await Promise.all([
    viewer ? ctx.db.query('reviewReactions').withIndex('by_pair', (q: any) => q.eq('userId', viewer._id).eq('reviewId', review._id)).first() : null,
    viewer ? ctx.db.query('savedReviews').withIndex('by_pair', (q: any) => q.eq('userId', viewer._id).eq('reviewId', review._id)).first() : null,
    Promise.all(storageIds.map((storageId) => ctx.storage.getUrl(storageId))),
    reviewer ? profileImageUrl(ctx, reviewer) : undefined,
  ])
  const images = imageUrls.filter((url: string | null): url is string => Boolean(url))
  // Take the newest 20, then render that bounded set chronologically so a
  // freshly submitted comment is never hidden behind older ones.
  let visibleComments: Doc<'reviewComments'>[] = []
  if (includeComments) {
    const comments = await ctx.db.query('reviewComments').withIndex('by_review', (q: any) => q.eq('reviewId', review._id)).order('desc').take(MAX_REVIEW_COMMENTS)
    visibleComments = comments.filter(isModerationVisible).sort((a: Doc<'reviewComments'>, b: Doc<'reviewComments'>) => a.createdAt - b.createdAt)
  }
  return {
    ...review,
    imageUrl: images[0] ?? null,
    imageUrls: images,
    reviewerDisplayName: reviewer ? fullName(reviewer) : 'Member',
    reviewerProfileImageUrl,
    likeCount: review.likeCount ?? 0,
    liked: Boolean(likedReaction),
    commentCount: review.commentCount ?? 0,
    comments: await Promise.all(visibleComments.map(async (comment) => {
      const author = await ctx.db.get(comment.authorId)
      return {
        ...comment,
        authorDisplayName: author ? fullName(author) : 'Member',
        authorProfileImageUrl: author ? await profileImageUrl(ctx, author) : undefined,
        ownComment: viewer?._id === comment.authorId,
      }
    })),
    saved: Boolean(savedRow),
  }
}

export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx)
    const now = Date.now()
    const recentUploads = await ctx.db.query('reviewMediaUploads')
      .withIndex('by_user_created_at', (q) => q.eq('userId', viewer._id).gte('createdAt', now - REVIEW_UPLOAD_WINDOW_MS))
      .collect()
    if (recentUploads.length >= MAX_REVIEW_UPLOADS_PER_DAY) throw new ConvexError('Daily review photo limit reached')
    const uploadId = await ctx.db.insert('reviewMediaUploads', { userId: viewer._id, createdAt: now })
    return { uploadId, uploadUrl: await ctx.storage.generateUploadUrl() }
  },
})

export const registerImageUpload = mutation({
  args: { uploadId: v.id('reviewMediaUploads'), storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const upload = await ctx.db.get(args.uploadId)
    if (!upload || upload.userId !== viewer._id) throw new ConvexError('Review photo upload not found')
    if (upload.storageId || upload.registeredAt || upload.reviewId || upload.discardedAt) throw new ConvexError('Review photo upload has already been used')
    const claimed = await ctx.db.query('reviewMediaUploads').withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId)).first()
    if (claimed) throw new ConvexError('Review photo has already been claimed')
    const metadata = await ctx.db.system.get('_storage', args.storageId)
    if (!metadata) throw new ConvexError('Review photo was not found')
    if (metadata._creationTime < upload.createdAt) throw new ConvexError('Review photo predates this upload')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(metadata.contentType ?? '')) throw new ConvexError('Review photos must be JPEG, PNG, or WebP')
    if (metadata.size > MAX_REVIEW_IMAGE_SIZE) throw new ConvexError('Review photos must be 10 MB or smaller')
    const now = Date.now()
    await ctx.db.patch(upload._id, { storageId: args.storageId, contentType: metadata.contentType, size: metadata.size, registeredAt: now })
    return { uploadId: upload._id, storageId: args.storageId }
  },
})

export const discardImageUpload = mutation({
  args: { uploadId: v.id('reviewMediaUploads'), storageId: v.optional(v.id('_storage')) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const upload = await ctx.db.get(args.uploadId)
    if (!upload || upload.userId !== viewer._id) throw new ConvexError('Review photo upload not found')
    if (upload.reviewId) throw new ConvexError('A published review photo cannot be discarded')
    if (upload.discardedAt) return
    const storageId = upload.storageId ?? args.storageId
    if (upload.storageId && args.storageId && upload.storageId !== args.storageId) throw new ConvexError('Storage object does not match this review photo')
    if (storageId) await ctx.storage.delete(storageId)
    await ctx.db.patch(upload._id, { discardedAt: Date.now() })
  },
})

export const toggleSave = mutation({
  args: { reviewId: v.id('reviews') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const review = await ctx.db.get(args.reviewId)
    if (!review || !isModerationVisible(review)) throw new ConvexError('Review not found')
    const existing = await ctx.db.query('savedReviews').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('reviewId', args.reviewId)).first()
    if (existing) {
      await ctx.db.delete(existing._id)
      await writeAudit(ctx, { actorUserId: viewer._id, action: 'review.unsaved', targetType: 'review', targetId: String(args.reviewId) })
      return false
    }
    await ctx.db.insert('savedReviews', { userId: viewer._id, reviewId: args.reviewId, createdAt: Date.now() })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'review.saved', targetType: 'review', targetId: String(args.reviewId) })
    return true
  },
})

export const toggleLike = mutation({
  args: { reviewId: v.id('reviews') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const review = await ctx.db.get(args.reviewId)
    if (!review || !isModerationVisible(review)) throw new ConvexError('Review not found')
    await requireNotBlocked(ctx, viewer._id, review.reviewerId)
    await consumeRateLimit(ctx, viewer._id, 'toggle_reaction')
    const existing = await ctx.db.query('reviewReactions').withIndex('by_pair', (q) => q.eq('userId', viewer._id).eq('reviewId', args.reviewId)).first()
    if (existing) {
      await ctx.db.delete(existing._id)
      await ctx.db.patch(review._id, { likeCount: adjustCounter(review.likeCount, -1) })
      return false
    }
    await ctx.db.insert('reviewReactions', { userId: viewer._id, reviewId: args.reviewId, reaction: 'like', createdAt: Date.now() })
    await ctx.db.patch(review._id, { likeCount: adjustCounter(review.likeCount, 1) })
    return true
  },
})

export const createComment = mutation({
  args: { reviewId: v.id('reviews'), body: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const review = await ctx.db.get(args.reviewId)
    if (!review || !isModerationVisible(review)) throw new ConvexError('Review not found')
    await requireNotBlocked(ctx, viewer._id, review.reviewerId)
    const body = args.body.trim()
    if (!body) throw new ConvexError('Comment cannot be empty')
    if (body.length > 500) throw new ConvexError('Comment is too long')
    await consumeRateLimit(ctx, viewer._id, 'create_comment')
    const now = Date.now()
    const commentId = await ctx.db.insert('reviewComments', {
      reviewId: args.reviewId,
      authorId: viewer._id,
      body,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(review._id, { commentCount: adjustCounter(review.commentCount, 1) })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'review.comment.created', targetType: 'review', targetId: String(args.reviewId) })
    return commentId
  },
})

export const deleteComment = mutation({
  args: { commentId: v.id('reviewComments') },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    const comment = await ctx.db.get(args.commentId)
    if (!comment || comment.authorId !== viewer._id) throw new ConvexError('Only the author can delete this comment')
    if (comment.hidden) return
    const review = await ctx.db.get(comment.reviewId)
    if (!review || !isModerationVisible(review)) throw new ConvexError('Review not found')
    await ctx.db.patch(args.commentId, { hidden: true, updatedAt: Date.now() })
    await ctx.db.patch(review._id, { commentCount: adjustCounter(review.commentCount, -1) })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'review.comment.deleted', targetType: 'comment', targetId: String(args.commentId) })
  },
})

export const submit = mutation({
  args: {
    bookingId: v.id('bookings'),
    rating: v.number(),
    body: v.optional(v.string()),
    imageUploadId: v.optional(v.id('reviewMediaUploads')),
    imageUploadIds: v.optional(v.array(v.id('reviewMediaUploads'))),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx)
    if (args.rating < 1 || args.rating > 5) throw new ConvexError('Rating must be between 1 and 5')
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) throw new ConvexError('Booking not found')
    if (!canReviewBooking(booking.status)) throw new ConvexError('Reviews require a completed booking')
    const companion = await ctx.db.get(booking.companionProfileId)
    if (!companion) throw new ConvexError('Companion profile not found')
    const isMember = booking.memberId === viewer._id
    const isCompanion = companion.userId === viewer._id
    if (!isMember && !isCompanion) throw new ConvexError('Not your booking')
    const existing = await ctx.db.query('reviews').withIndex('by_booking_reviewer', (q) => q.eq('bookingId', args.bookingId).eq('reviewerId', viewer._id)).first()
    if (existing) throw new ConvexError('You have already reviewed this booking')
    const otherParticipantId = isMember ? companion.userId : booking.memberId
    const otherReview = await ctx.db.query('reviews').withIndex('by_booking_reviewer', (q) => q.eq('bookingId', args.bookingId).eq('reviewerId', otherParticipantId)).first()
    const body = args.body?.trim() || undefined
    if (body && body.length > 1000) throw new ConvexError('Review is too long')
    // The single-image argument stays for mobile; the array serves the web
    // composer, which can attach several photos.
    const requestedUploadIds = [...(args.imageUploadIds ?? [])]
    if (args.imageUploadId) requestedUploadIds.push(args.imageUploadId)
    const uniqueUploadIds = [...new Set(requestedUploadIds)]
    if (uniqueUploadIds.length > MAX_REVIEW_IMAGES) {
      throw new ConvexError(`Reviews can include up to ${MAX_REVIEW_IMAGES} photos`)
    }
    const uploads = await Promise.all(uniqueUploadIds.map(async (uploadId) => {
      const upload = await ctx.db.get(uploadId)
      if (!upload || upload.userId !== viewer._id || !upload.storageId || !upload.registeredAt || upload.reviewId || upload.discardedAt) {
        throw new ConvexError('Review photo upload is not ready')
      }
      return upload
    }))
    const imageStorageIds = uploads.map((upload) => upload.storageId as Id<'_storage'>)
    const now = Date.now()
    const reviewId = await ctx.db.insert('reviews', {
      bookingId: args.bookingId,
      reviewerId: viewer._id,
      revieweeId: otherParticipantId,
      companionProfileId: isMember ? booking.companionProfileId : undefined,
      rating: args.rating,
      body,
      imageStorageId: imageStorageIds[0],
      imageStorageIds: imageStorageIds.length > 0 ? imageStorageIds : undefined,
      likeCount: 0,
      commentCount: 0,
      createdAt: now,
    })
    for (const upload of uploads) await ctx.db.patch(upload._id, { reviewId })
    if (isMember) {
      const nextCount = companion.reviewCount + 1
      const nextRating = (companion.rating * companion.reviewCount + args.rating) / nextCount
      await ctx.db.patch(booking.companionProfileId, { rating: nextRating, reviewCount: nextCount, updatedAt: now })
    }
    await ctx.db.patch(args.bookingId, { status: bookingStatusAfterReview(Boolean(otherReview)), updatedAt: now })
    await writeAudit(ctx, { actorUserId: viewer._id, action: 'review.submitted', targetType: 'review', targetId: String(reviewId) })
    await createNotification(ctx, {
      recipientUserId: otherParticipantId,
      actorUserId: viewer._id,
      kind: 'review_received',
      priority: 'standard',
      bookingId: args.bookingId,
      reviewId,
      dedupeKey: `review:${reviewId}:received`,
    })
    return reviewId
  },
})

function fullName(user: Pick<Doc<'users'>, 'displayName' | 'firstName' | 'lastName'>) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.displayName
}

async function profileImageUrl(ctx: any, user: Pick<Doc<'users'>, 'profileImageStorageId' | 'profileImageUrl'>) {
  if (!user.profileImageStorageId) return user.profileImageUrl
  return await ctx.storage.getUrl(user.profileImageStorageId) ?? user.profileImageUrl
}
