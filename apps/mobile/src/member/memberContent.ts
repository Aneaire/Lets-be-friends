export type MemberPost = {
  _id: string
  authorId: string
  body?: string
  createdAt: number
  circleId?: string | null
  deletedAt?: number | null
  likeCount?: number
  commentCount?: number
  liked?: boolean
  saved?: boolean
  followingAuthor?: boolean
  ownPost?: boolean
  [key: string]: unknown
}

export type MemberPostsUiStatus = 'loading' | 'empty' | 'ready'

export function memberPostsStatus(posts: MemberPost[] | undefined | null): MemberPostsUiStatus {
  if (posts === undefined) return 'loading'
  const visible = (posts ?? []).filter(isMemberPostVisible)
  return visible.length ? 'ready' : 'empty'
}

export function isMemberPostVisible(post: MemberPost): boolean {
  if (!post || typeof post._id !== 'string') return false
  if (post.circleId) return false
  if (post.deletedAt) return false
  return true
}

export function visibleMemberPosts(posts: MemberPost[] | undefined | null): MemberPost[] {
  return (posts ?? []).filter(isMemberPostVisible)
}

export type ProfileFeedItem = {
  kind: 'post'
  itemKey: string
  source: 'profile'
  reason: string
  post: MemberPost
}

export function toProfileFeedItem(post: MemberPost, ownerName: string): ProfileFeedItem {
  return {
    kind: 'post',
    itemKey: `post:${String(post._id)}`,
    source: 'profile',
    reason: `${ownerName} shared this post`,
    post,
  }
}

export function ownContentRouteFor(viewerId: string | undefined) {
  if (!viewerId) return null
  return { pathname: '/my-posts' as const }
}

export function memberContentTabLabel(tab: 'posts' | 'reviews') {
  return tab === 'posts' ? 'Posts' : 'Reviews'
}

export type OwnCompanionApplication = {
  _id: string
  status?: string | null
} | null

export type OwnReviewsUiStatus = 'loading' | 'needs_companion' | 'empty' | 'ready'

/**
 * Production decision for the My posts reviews tab. The reviews query is
 * skipped until the Companion application is approved, so the loading check
 * must settle the application first. Otherwise a member without an approved
 * profile would wait on a skipped (perpetually undefined) reviews query.
 */
export function ownReviewsUiStatus(
  application: OwnCompanionApplication | undefined,
  reviews: ReadonlyArray<unknown> | undefined,
): OwnReviewsUiStatus {
  if (application === undefined) return 'loading'
  if (!application || application.status !== 'approved') return 'needs_companion'
  if (reviews === undefined) return 'loading'
  return reviews.length ? 'ready' : 'empty'
}

/**
 * Production query args for the My posts reviews tab. Mirrors
 * ownReviewsUiStatus so the query stays skipped until an approved Companion
 * profile id is available. Generic over the id so Convex Id types flow
 * through without assertions at the call site.
 */
export function ownReviewsQueryArgs<TId>(
  application: { _id: TId; status?: string | null } | null | undefined,
): 'skip' | { companionProfileId: TId } {
  if (!application || application.status !== 'approved') return 'skip'
  return { companionProfileId: application._id }
}

export type OwnReviewFeedItem<TReview> = {
  kind: 'review'
  itemKey: string
  source: 'review'
  reason: string
  review: TReview & { companionDisplayName: string }
}

/**
 * Adapts an owned Companion review for the shared ReviewFeedCard so My posts
 * keeps like, save, share, comment, and profile-navigation parity with the
 * feed instead of rendering inert cards.
 */
export function toOwnReviewFeedItem<TReview extends { _id: string }>(
  review: TReview,
  companionDisplayName: string,
): OwnReviewFeedItem<TReview> {
  return {
    kind: 'review',
    itemKey: `review:${String(review._id)}`,
    source: 'review',
    reason: 'Review of your Companion profile',
    review: { ...review, companionDisplayName },
  }
}
