import { describe, expect, it } from 'vitest'
import {
  blendReviewsIntoFeed,
  boundedRatio,
  dedupeReviewCandidates,
  engagementScore,
  freshnessScore,
  arrangeCommentThreads,
  rankFeedCandidates,
  rerankFeedCandidates,
  scoreFeedCandidate,
  scoreReviewCandidate,
  selectFeaturedComment,
  suppressRecentlyShownReviews,
  FEED_V2_MAX_DIRECT_REVIEWS,
  type FeedRankingCandidate,
  type ReviewFeedCandidate,
} from '../../src/feed'

describe('feed ranking', () => {
  it('bounds invalid and out-of-range signals', () => {
    expect(boundedRatio(Number.NaN)).toBe(0)
    expect(boundedRatio(2)).toBe(1)
    expect(boundedRatio(-1)).toBe(0)
    expect(freshnessScore(1_000, 1_000, 0)).toBe(0)
    expect(engagementScore(-2, -1)).toBe(0)
  })

  it('scores and re-ranks deterministically while preserving diversity', () => {
    const candidates: FeedRankingCandidate[] = Array.from({ length: 12 }, (_, index) => ({
      id: `post-${String(index).padStart(2, '0')}`,
      authorId: index < 4 ? 'author-a' : `author-${Math.floor(index / 2)}`,
      category: index % 2 === 0 ? 'Coffee' : 'Walking',
      source: index >= 8 ? 'exploration' : 'interest',
      seen: index === 0,
      signals: {
        relationship: index < 4 ? 1 : 0.4,
        category: 0.8,
        freshness: 0.9 - index * 0.02,
        meaningfulEngagement: 0.4,
        trustQuality: 0.7,
        underexposure: index >= 8 ? 1 : 0.3,
      },
    }))

    expect(scoreFeedCandidate(candidates[0].signals)).toBeCloseTo(0.78)
    const first = rerankFeedCandidates(candidates, { pageSize: 10, maxPerAuthor: 2, explorationShare: 0.2 })
    const second = rerankFeedCandidates([...candidates].reverse(), { pageSize: 10, maxPerAuthor: 2, explorationShare: 0.2 })

    expect(first.map((candidate) => candidate.id)).toEqual(second.map((candidate) => candidate.id))
    expect(first.filter((candidate) => candidate.authorId === 'author-a')).toHaveLength(2)
    expect(first.length).toBeGreaterThanOrEqual(8)
    expect(first.slice(0, 8).filter((candidate) => candidate.source === 'exploration')).toHaveLength(2)
    expect(first.every((candidate, index) => index === 0 || candidate.authorId !== first[index - 1].authorId)).toBe(true)
    expect(first[0].seen).not.toBe(true)
  })
})

describe('comment thread arrangement', () => {
  it('keeps parents above chronological replies while ordering conversations newest first', () => {
    const entries = arrangeCommentThreads([
      { _id: 'reply-new', parentCommentId: 'parent-old', createdAt: 40 },
      { _id: 'standalone-new', createdAt: 50 },
      { _id: 'parent-old', createdAt: 10 },
      { _id: 'reply-old', parentCommentId: 'parent-old', createdAt: 20 },
      { _id: 'nested', parentCommentId: 'reply-old', createdAt: 30 },
    ])

    expect(entries.map(({ comment }) => comment._id)).toEqual([
      'standalone-new',
      'parent-old',
      'reply-old',
      'nested',
      'reply-new',
    ])
    expect(entries.map(({ position, isLastReply }) => ({ position, isLastReply }))).toEqual([
      { position: 'standalone', isLastReply: false },
      { position: 'root', isLastReply: false },
      { position: 'reply', isLastReply: false },
      { position: 'reply', isLastReply: false },
      { position: 'reply', isLastReply: true },
    ])
  })

  it('renders an unloaded parent reply as a standalone conversation', () => {
    expect(arrangeCommentThreads([
      { _id: 'orphan', parentCommentId: 'not-loaded', createdAt: 20 },
    ])).toEqual([
      { comment: { _id: 'orphan', parentCommentId: 'not-loaded', createdAt: 20 }, position: 'standalone', isLastReply: false },
    ])
  })
})

describe('featured comment selection', () => {
  it('returns null when every conversation is below the interaction minimum', () => {
    expect(selectFeaturedComment([])).toBeNull()
    expect(selectFeaturedComment([
      { _id: 'quiet', createdAt: 10, likeCount: 1 },
      { _id: 'reply', parentCommentId: 'quiet', createdAt: 11, likeCount: 0 },
    ])).toBeNull()
  })

  it('counts likes on every comment in a thread plus its replies', () => {
    const selection = selectFeaturedComment([
      { _id: 'root', createdAt: 10, likeCount: 0 },
      { _id: 'reply-a', parentCommentId: 'root', createdAt: 11, likeCount: 2 },
      { _id: 'reply-b', parentCommentId: 'root', createdAt: 12, likeCount: 0 },
    ])

    expect(selection).toMatchObject({ comment: { _id: 'root' }, interactionCount: 4 })
  })

  it('features the busiest conversation and ignores likes on hidden rows', () => {
    const selection = selectFeaturedComment([
      { _id: 'small', createdAt: 10, likeCount: 3 },
      { _id: 'big-root', createdAt: 5, likeCount: 1 },
      { _id: 'big-reply-a', parentCommentId: 'big-root', createdAt: 6, likeCount: 4 },
      { _id: 'big-reply-b', parentCommentId: 'big-reply-a', createdAt: 7, likeCount: 1 },
    ])

    expect(selection).toMatchObject({ comment: { _id: 'big-root' }, interactionCount: 8 })
  })

  it('treats an orphaned reply as its own conversation and never double counts a cycle', () => {
    expect(selectFeaturedComment([
      { _id: 'orphan', parentCommentId: 'not-loaded', createdAt: 20, likeCount: 3 },
    ])).toMatchObject({ comment: { _id: 'orphan' }, interactionCount: 3 })

    const cycle = selectFeaturedComment([
      { _id: 'a', parentCommentId: 'b', createdAt: 1, likeCount: 2 },
      { _id: 'b', parentCommentId: 'a', createdAt: 2, likeCount: 2 },
    ])
    expect(cycle).toMatchObject({ interactionCount: 5 })
  })

  it('is deterministic when interaction counts tie', () => {
    const comments = [
      { _id: 'older', createdAt: 10, likeCount: 3 },
      { _id: 'newer', createdAt: 20, likeCount: 3 },
    ]

    expect(selectFeaturedComment(comments)?.comment._id).toBe('newer')
    expect(selectFeaturedComment([...comments].reverse())?.comment._id).toBe('newer')
  })
})

describe('review feed v2', () => {
  const signals = {
    relationship: 0.5,
    category: 0.6,
    freshness: 0.7,
    meaningfulEngagement: 0.4,
    trustQuality: 0.7,
    underexposure: 0.5,
  }

  function reviewCandidate(id: string, reviewerId: string, companionId: string): ReviewFeedCandidate {
    return {
      id,
      authorId: reviewerId,
      category: 'Coffee',
      source: 'recent',
      reviewerId,
      companionId,
      signals: { ...signals },
    }
  }

  it('keeps the star rating out of the feed score', () => {
    // The rating is not part of FeedScoreSignals, so a 1-star and a 5-star
    // review with identical signals score identically.
    expect(scoreReviewCandidate({ ...signals })).toBe(scoreFeedCandidate({ ...signals }))
    // The score still reads the signals, so different substance scores differently.
    expect(scoreReviewCandidate({ ...signals, trustQuality: 1 })).not.toBe(
      scoreReviewCandidate({ ...signals, trustQuality: 0 }),
    )
  })

  it('caps direct reviews and keeps one per reviewer and Companion deterministically', () => {
    const raw = [
      reviewCandidate('review-a', 'reviewer-1', 'companion-1'),
      reviewCandidate('review-b', 'reviewer-1', 'companion-2'),
      reviewCandidate('review-c', 'reviewer-2', 'companion-1'),
      reviewCandidate('review-d', 'reviewer-2', 'companion-2'),
      reviewCandidate('review-e', 'reviewer-3', 'companion-3'),
    ]
    const ranked = rankFeedCandidates(raw)
    const selected = dedupeReviewCandidates(ranked)
    expect(selected).toHaveLength(FEED_V2_MAX_DIRECT_REVIEWS)
    expect(selected.map((candidate) => candidate.id)).toEqual(['review-a', 'review-d'])
    // Ranking sorts internally, so raw input order never changes the outcome.
    const reselected = dedupeReviewCandidates(rankFeedCandidates([...raw].reverse()))
    expect(reselected.map((candidate) => candidate.id)).toEqual(selected.map((candidate) => candidate.id))
  })

  it('suppresses recently shown reviews only when alternatives exist', () => {
    const candidates = [
      reviewCandidate('a', 'reviewer-1', 'companion-1'),
      reviewCandidate('b', 'reviewer-2', 'companion-2'),
    ]
    expect(suppressRecentlyShownReviews(candidates, new Set<string>())).toHaveLength(2)
    expect(suppressRecentlyShownReviews(candidates, new Set(['review:a']))).toEqual([candidates[1]])
    // Fallback keeps the feed non-empty when every candidate was shown.
    expect(suppressRecentlyShownReviews(candidates, new Set(['review:a', 'review:b']))).toHaveLength(2)
  })

  it('prefers an unseen third candidate over two seen top candidates', () => {
    const ranked = rankFeedCandidates([
      reviewCandidate('a', 'reviewer-1', 'companion-1'),
      reviewCandidate('b', 'reviewer-2', 'companion-2'),
      reviewCandidate('c', 'reviewer-3', 'companion-3'),
    ])
    expect(ranked.map((candidate) => candidate.id)).toEqual(['a', 'b', 'c'])
    // Suppression runs before the cap: hiding the top two lets the unseen
    // third surface instead of falling back to the seen pair.
    const unsuppressed = suppressRecentlyShownReviews(ranked, new Set(['review:a', 'review:b']))
    expect(unsuppressed.map((candidate) => candidate.id)).toEqual(['c'])
    expect(dedupeReviewCandidates(unsuppressed).map((candidate) => candidate.id)).toEqual(['c'])
    // Fallback only when every eligible candidate was recently shown.
    const fallback = suppressRecentlyShownReviews(ranked, new Set(['review:a', 'review:b', 'review:c']))
    expect(fallback).toHaveLength(3)
    expect(dedupeReviewCandidates(fallback).map((candidate) => candidate.id)).toEqual(['a', 'b'])
  })

  it('blends at most two reviews with spacing and never adjacent', () => {
    const posts = Array.from({ length: 20 }, (_, index) => ({ kind: 'post' as const, id: `post-${index}` }))
    const reviews = [{ kind: 'review' as const, id: 'r1' }, { kind: 'review' as const, id: 'r2' }, { kind: 'review' as const, id: 'r3' }]
    const blended = blendReviewsIntoFeed(posts, reviews)
    const reviewPositions = blended
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => (item as { kind: string }).kind === 'review')
      .map(({ index }) => index)
    expect(blended).toHaveLength(22)
    // Milestones count original posts, so the second insertion shifts by one.
    expect(reviewPositions).toEqual([3, 9])
    expect(reviewPositions[1] - reviewPositions[0]).toBeGreaterThan(1)
    expect(blendReviewsIntoFeed(posts, reviews)).toEqual(blended)
  })

  it('avoids adjacent reviews on sparse feeds by trailing at most one', () => {
    const posts = [{ kind: 'post' as const, id: 'p0' }]
    const reviews = [{ kind: 'review' as const, id: 'r1' }, { kind: 'review' as const, id: 'r2' }]
    const blended = blendReviewsIntoFeed(posts, reviews)
    expect(blended.filter((item) => (item as { kind: string }).kind === 'review')).toHaveLength(1)
    expect(blended.map((item) => (item as { kind: string }).kind)).toEqual(['post', 'review'])
  })
})
