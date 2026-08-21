import { describe, expect, it } from 'vitest'
import {
  boundedRatio,
  engagementScore,
  freshnessScore,
  rerankFeedCandidates,
  scoreFeedCandidate,
  type FeedRankingCandidate,
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
