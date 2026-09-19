export const feedCandidateSources = [
  'followed',
  'interest',
  'completed_experience',
  'trending',
  'recent',
  'exploration',
] as const

export type FeedCandidateSource = (typeof feedCandidateSources)[number]

export const feedInstrumentationSources = [
  ...feedCandidateSources,
  'review',
  'companion_fallback',
  'first_party_guidance',
] as const

export const feedInstrumentationActions = [
  'open_companion',
  'open_guidance',
  'open_review',
  'comment',
  'like',
  'save',
  'share',
  'follow',
  'report',
  'report_comment',
] as const

export type FeedInstrumentationSource = (typeof feedInstrumentationSources)[number]
export type FeedInstrumentationAction = (typeof feedInstrumentationActions)[number]

export type FeedScoreSignals = {
  relationship: number
  category: number
  freshness: number
  meaningfulEngagement: number
  trustQuality: number
  underexposure: number
}

export type FeedRankingCandidate = {
  id: string
  authorId: string
  category?: string
  source: FeedCandidateSource
  signals: FeedScoreSignals
  seen?: boolean
}

export type RankedFeedCandidate<T extends FeedRankingCandidate = FeedRankingCandidate> = T & {
  score: number
}

export type CommentThreadPosition = 'standalone' | 'root' | 'reply'

export type CommentThreadEntry<T> = {
  comment: T
  position: CommentThreadPosition
  isLastReply: boolean
}

type ThreadableComment = {
  _id: string
  parentCommentId?: string | null
  createdAt: number
}

/**
 * Keeps each conversation together while retaining a reverse-chronological
 * order between conversations and a chronological reading order within them.
 * Nested replies share one visual level because their explicit reply context
 * identifies the exact comment they answer.
 */
export function arrangeCommentThreads<T extends ThreadableComment>(comments: readonly T[]): CommentThreadEntry<T>[] {
  const byId = new Map(comments.map((comment) => [String(comment._id), comment]))
  const children = new Map<string, T[]>()
  const roots: T[] = []

  for (const comment of comments) {
    const commentId = String(comment._id)
    const parentId = comment.parentCommentId ? String(comment.parentCommentId) : ''
    if (!parentId || parentId === commentId || !byId.has(parentId)) {
      roots.push(comment)
      continue
    }
    const siblings = children.get(parentId) ?? []
    siblings.push(comment)
    children.set(parentId, siblings)
  }

  const newestFirst = (left: T, right: T) => right.createdAt - left.createdAt || String(left._id).localeCompare(String(right._id))
  const oldestFirst = (left: T, right: T) => left.createdAt - right.createdAt || String(left._id).localeCompare(String(right._id))
  roots.sort(newestFirst)
  for (const siblings of children.values()) siblings.sort(oldestFirst)

  const arranged: CommentThreadEntry<T>[] = []
  const visited = new Set<string>()

  function appendConversation(root: T) {
    const rootId = String(root._id)
    if (visited.has(rootId)) return
    visited.add(rootId)

    const replies: T[] = []
    function appendReplies(parentId: string) {
      for (const reply of children.get(parentId) ?? []) {
        const replyId = String(reply._id)
        if (visited.has(replyId)) continue
        visited.add(replyId)
        replies.push(reply)
        appendReplies(replyId)
      }
    }
    appendReplies(rootId)
    replies.sort(oldestFirst)

    arranged.push({ comment: root, position: replies.length > 0 ? 'root' : 'standalone', isLastReply: false })
    replies.forEach((comment, index) => {
      arranged.push({ comment, position: 'reply', isLastReply: index === replies.length - 1 })
    })
  }

  roots.forEach(appendConversation)

  // Malformed cycles have no natural root. Promote one item so every visible
  // comment still renders exactly once and the UI remains usable.
  comments.filter((comment) => !visited.has(String(comment._id))).sort(newestFirst).forEach(appendConversation)
  return arranged
}

export const FEATURED_COMMENT_MIN_INTERACTIONS = 3

export type FeaturedCommentCandidate = {
  _id: string
  parentCommentId?: string | null
  createdAt: number
  likeCount?: number | null
}

export type FeaturedCommentSelection<T> = {
  comment: T
  interactionCount: number
}

/**
 * Selects the single comment conversation to feature with a feed post.
 *
 * A conversation is a root comment plus every reply beneath it. Its
 * interaction count is every like on every comment in the conversation plus
 * the number of replies, so a comment becomes eligible once its whole thread
 * reaches the minimum. The busiest eligible conversation wins, with the most
 * liked root, newest root, and id as deterministic tie-breakers. Returns null
 * when no conversation reaches the minimum.
 *
 * Callers are responsible for filtering comments the viewer must not see. The
 * bounded scan that feeds this function is the second visibility guard.
 */
export function selectFeaturedComment<T extends FeaturedCommentCandidate>(
  comments: readonly T[],
  minimumInteractions = FEATURED_COMMENT_MIN_INTERACTIONS,
): FeaturedCommentSelection<T> | null {
  if (comments.length === 0) return null

  const byId = new Map(comments.map((comment) => [String(comment._id), comment]))
  const children = new Map<string, T[]>()
  const roots: T[] = []

  for (const comment of comments) {
    const commentId = String(comment._id)
    const parentId = comment.parentCommentId ? String(comment.parentCommentId) : ''
    if (!parentId || parentId === commentId || !byId.has(parentId)) {
      roots.push(comment)
      continue
    }
    const siblings = children.get(parentId) ?? []
    siblings.push(comment)
    children.set(parentId, siblings)
  }

  const newestFirst = (left: T, right: T) => right.createdAt - left.createdAt || String(left._id).localeCompare(String(right._id))
  roots.sort(newestFirst)

  const threads: Array<{ root: T; interactionCount: number }> = []
  const visited = new Set<string>()

  function collectThread(root: T) {
    const rootId = String(root._id)
    if (visited.has(rootId)) return
    visited.add(rootId)

    let likes = Math.max(0, root.likeCount ?? 0)
    let replies = 0
    const queue = [rootId]
    while (queue.length > 0) {
      const parentId = queue.shift() as string
      for (const child of children.get(parentId) ?? []) {
        const childId = String(child._id)
        if (visited.has(childId)) continue
        visited.add(childId)
        likes += Math.max(0, child.likeCount ?? 0)
        replies += 1
        queue.push(childId)
      }
    }
    threads.push({ root, interactionCount: likes + replies })
  }

  roots.forEach(collectThread)
  // Malformed cycles have no natural root. Promote one so every conversation
  // is still considered exactly once.
  comments
    .filter((comment) => !visited.has(String(comment._id)))
    .sort(newestFirst)
    .forEach(collectThread)

  const eligible = threads.filter((thread) => thread.interactionCount >= minimumInteractions)
  if (eligible.length === 0) return null
  eligible.sort((left, right) => (
    right.interactionCount - left.interactionCount
    || Math.max(0, right.root.likeCount ?? 0) - Math.max(0, left.root.likeCount ?? 0)
    || right.root.createdAt - left.root.createdAt
    || String(left.root._id).localeCompare(String(right.root._id))
  ))
  const best = eligible[0]
  return { comment: best.root, interactionCount: best.interactionCount }
}

export const feedScoreWeights = {
  relationship: 0.3,
  category: 0.25,
  freshness: 0.15,
  meaningfulEngagement: 0.15,
  trustQuality: 0.1,
  underexposure: 0.05,
} as const

export function boundedRatio(value: number, maximum = 1) {
  if (!Number.isFinite(value) || maximum <= 0) return 0
  return Math.min(1, Math.max(0, value / maximum))
}

export function freshnessScore(createdAt: number, now: number, freshWindowMs = 7 * 24 * 60 * 60 * 1000) {
  if (!Number.isFinite(createdAt) || !Number.isFinite(now) || freshWindowMs <= 0) return 0
  return boundedRatio(freshWindowMs - Math.max(0, now - createdAt), freshWindowMs)
}

export function engagementScore(comments: number, reactions: number, saves = 0) {
  const weighted = Math.max(0, comments) * 2 + Math.max(0, reactions) + Math.max(0, saves) * 1.5
  return boundedRatio(Math.log1p(weighted), Math.log1p(40))
}

export function scoreFeedCandidate(signals: FeedScoreSignals) {
  const score = Object.entries(feedScoreWeights).reduce((total, [key, weight]) => (
    total + boundedRatio(signals[key as keyof FeedScoreSignals]) * weight
  ), 0)
  return Math.round(score * 1_000_000) / 1_000_000
}

export function rankFeedCandidates<T extends FeedRankingCandidate>(candidates: T[]) {
  return candidates
    .map((candidate): RankedFeedCandidate<T> => ({
      ...candidate,
      score: scoreFeedCandidate(candidate.signals),
    }))
    .sort(compareRankedCandidates)
}

export function rerankFeedCandidates<T extends FeedRankingCandidate>(
  candidates: T[],
  options: { pageSize?: number; maxPerAuthor?: number; explorationShare?: number } = {},
) {
  const pageSize = Math.max(1, Math.min(50, Math.floor(options.pageSize ?? 20)))
  const maxPerAuthor = Math.max(1, Math.min(5, Math.floor(options.maxPerAuthor ?? 2)))
  const explorationLimit = Math.max(0, Math.floor(pageSize * Math.min(0.3, Math.max(0, options.explorationShare ?? 0.2))))
  const remaining = rankFeedCandidates(candidates)
  const selected: RankedFeedCandidate<T>[] = []
  const authorCounts = new Map<string, number>()
  const categoryCounts = new Map<string, number>()
  let explorationCount = 0

  while (selected.length < pageSize && remaining.length > 0) {
    const previousAuthor = selected.at(-1)?.authorId
    const authorEligible = remaining.filter((candidate) => (
      (authorCounts.get(candidate.authorId) ?? 0) < maxPerAuthor
    ))
    const withinExplorationLimit = authorEligible.filter((candidate) => (
      candidate.source !== 'exploration' || explorationCount < explorationLimit
    ))
    // The exploration share is a diversity preference, not a reason to leave
    // the feed short when new or underexposed posts are the only safe supply.
    const eligible = withinExplorationLimit.length > 0 ? withinExplorationLimit : authorEligible
    if (eligible.length === 0) break

    const hasDifferentAuthor = eligible.some((candidate) => candidate.authorId !== previousAuthor)
    if (previousAuthor !== undefined && !hasDifferentAuthor) break
    const pool = previousAuthor === undefined
      ? eligible
      : eligible.filter((candidate) => candidate.authorId !== previousAuthor)
    pool.sort((left, right) => {
      const unseenDifference = Number(Boolean(left.seen)) - Number(Boolean(right.seen))
      if (unseenDifference !== 0) return unseenDifference
      const leftCategoryCount = left.category ? categoryCounts.get(left.category) ?? 0 : 0
      const rightCategoryCount = right.category ? categoryCounts.get(right.category) ?? 0 : 0
      if (leftCategoryCount !== rightCategoryCount && Math.abs(left.score - right.score) <= 0.08) {
        return leftCategoryCount - rightCategoryCount
      }
      return compareRankedCandidates(left, right)
    })

    const next = pool[0]
    selected.push(next)
    authorCounts.set(next.authorId, (authorCounts.get(next.authorId) ?? 0) + 1)
    if (next.category) categoryCounts.set(next.category, (categoryCounts.get(next.category) ?? 0) + 1)
    if (next.source === 'exploration') explorationCount += 1
    remaining.splice(remaining.findIndex((candidate) => candidate.id === next.id), 1)
  }

  return selected
}

function compareRankedCandidates<T extends FeedRankingCandidate>(left: RankedFeedCandidate<T>, right: RankedFeedCandidate<T>) {
  if (left.score !== right.score) return right.score - left.score
  return left.id.localeCompare(right.id)
}

export const FEED_V2_ALGORITHM_VERSION = 'feed_v2'
export const FEED_V2_MAX_DIRECT_REVIEWS = 2
export const FEED_V2_REVIEW_SUPPRESSION_MS = 7 * 24 * 60 * 60 * 1000
// Insertion milestones count original posts, not final positions. The first
// direct review lands after the third post and the second after the eighth,
// which keeps reviews spaced, deterministic, and never adjacent on a 20-ish
// first page while degrading gracefully on sparse feeds.
export const FEED_V2_REVIEW_INSERT_AFTER_COUNTS = [3, 8] as const

export type ReviewFeedCandidate = FeedRankingCandidate & {
  reviewerId: string
  companionId: string
}

/**
 * Trust-first review scoring uses the same six interpretable signals as posts.
 * The review star rating is intentionally not an input: callers build signals
 * from relationship, category, freshness, engagement, trust quality, and
 * underexposure only, so a 1-star substantive review scores like a 5-star one
 * with the same signals.
 */
export function scoreReviewCandidate(signals: FeedScoreSignals) {
  return scoreFeedCandidate(signals)
}

/**
 * Keeps the highest-ranked candidate per reviewer and per Companion profile.
 * Input must already be ranked (score desc, id asc); output preserves that
 * order and is capped, so selection stays deterministic.
 */
export function dedupeReviewCandidates<T extends ReviewFeedCandidate>(
  ranked: RankedFeedCandidate<T>[],
  limit = FEED_V2_MAX_DIRECT_REVIEWS,
) {
  const cap = Math.max(0, Math.min(FEED_V2_MAX_DIRECT_REVIEWS, Math.floor(limit)))
  const selected: RankedFeedCandidate<T>[] = []
  const seenReviewers = new Set<string>()
  const seenCompanions = new Set<string>()
  for (const candidate of ranked) {
    if (selected.length >= cap) break
    if (seenReviewers.has(candidate.reviewerId) || seenCompanions.has(candidate.companionId)) continue
    seenReviewers.add(candidate.reviewerId)
    seenCompanions.add(candidate.companionId)
    selected.push(candidate)
  }
  return selected
}

/**
 * Suppresses reviews already shown to the viewer when alternatives exist.
 * Candidates carry a raw id while impression history stores itemKeys such as
 * `review:<id>`; toItemKey bridges the two. Returns the unsuppressed subset,
 * or the original list when every candidate was recently shown (fallback so a
 * sparse feed never goes empty because of suppression alone).
 */
export function suppressRecentlyShownReviews<T extends FeedRankingCandidate>(
  candidates: T[],
  shownItemKeys: ReadonlySet<string> | readonly string[],
  toItemKey: (candidate: T) => string = (candidate) => `review:${candidate.id}`,
) {
  if (candidates.length === 0) return candidates
  const shown = shownItemKeys instanceof Set ? shownItemKeys : new Set(shownItemKeys)
  if (shown.size === 0) return [...candidates]
  const unsuppressed = candidates.filter((candidate) => !shown.has(toItemKey(candidate)))
  return unsuppressed.length > 0 ? unsuppressed : [...candidates]
}

/**
 * Blends at most maxDirectReviews review cards into a post list. Reviews are
 * inserted after fixed post counts, never adjacent, at most one trailing
 * review when the post list is too short to space two, and input order is
 * preserved for determinism.
 */
export function blendReviewsIntoFeed<T, U>(
  postItems: readonly T[],
  reviewItems: readonly U[],
  maxDirectReviews = FEED_V2_MAX_DIRECT_REVIEWS,
) {
  const cap = Math.max(0, Math.min(FEED_V2_MAX_DIRECT_REVIEWS, Math.floor(maxDirectReviews)))
  const reviews = reviewItems.slice(0, cap)
  if (reviews.length === 0) return [...postItems]
  const milestones = FEED_V2_REVIEW_INSERT_AFTER_COUNTS.slice(0, cap)
  const blended: Array<T | U> = []
  let reviewIndex = 0
  postItems.forEach((post, index) => {
    blended.push(post)
    if (reviewIndex < reviews.length && index + 1 === milestones[reviewIndex]) {
      blended.push(reviews[reviewIndex])
      reviewIndex += 1
    }
  })
  // Sparse feeds may never reach a milestone. Append at most one trailing
  // review so two reviews can never end up adjacent.
  if (reviewIndex < reviews.length && blended.length > 0) {
    const lastIsReview = reviewIndex > 0 && blended.length > 0 && blended[blended.length - 1] === reviews[reviewIndex - 1]
    if (!lastIsReview) {
      blended.push(reviews[reviewIndex])
      reviewIndex += 1
    }
  } else if (reviewIndex < reviews.length && blended.length === 0) {
    blended.push(reviews[reviewIndex])
  }
  return blended
}
