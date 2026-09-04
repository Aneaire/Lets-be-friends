// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const feedState = vi.hoisted(() => ({
  viewer: { _id: 'user-viewer', displayName: 'Viewer Friend' },
  feedHookCalls: 0,
  impressionCalls: [] as Array<{ items: Array<{ itemKey: string; position: number }> }>,
}))

function buildFeedPosts(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const postId = `post-${index}`
    return {
      kind: 'post' as const,
      itemKey: `post:${postId}`,
      source: 'recent' as const,
      reason: 'Fresh from the community',
      post: {
        _id: postId,
        authorId: `user-author-${index % 7}`,
        body: `Feed post ${index}`,
        media: [],
        mentions: undefined,
        reportable: true,
        hidden: false,
        commentCount: 0,
        likeCount: 0,
        savedCount: 0,
        liked: false,
        authorDisplayName: `Author ${index % 7}`,
        authorUsername: `author_${index % 7}`,
        authorProfileImageUrl: undefined,
        authorCompanionProfileId: undefined,
        saved: false,
        followingAuthor: false,
        ownPost: false,
        createdAt: Date.UTC(2026, 6, 20, 12, 0) + index,
        updatedAt: Date.UTC(2026, 6, 20, 12, 0) + index,
      },
    }
  })
}

vi.mock('convex/react', () => ({
  // The generated api object is a Proxy that mints a fresh reference per
  // access, so mocks discriminate by call shape instead of reference identity.
  // Every feed render returns fresh array identities with identical contents,
  // exactly the condition that must not cause update-depth loops or
  // duplicate impression writes.
  usePaginatedQuery: (_fn: unknown, params: unknown) => {
    if (params && typeof params === 'object' && 'filter' in (params as Record<string, unknown>)) {
      feedState.feedHookCalls += 1
      return { results: buildFeedPosts(105), status: 'Exhausted', loadMore: vi.fn() }
    }
    return { results: [], status: 'Exhausted', loadMore: vi.fn() }
  },
  useQuery: (_fn: unknown, params: unknown) => {
    if (params === undefined) return feedState.viewer
    return undefined
  },
  useMutation: () => (args: unknown) => {
    if (args && typeof args === 'object' && Array.isArray((args as Record<string, unknown>).items)) {
      const items = (args as { items: Array<{ itemKey: string; position: number }> }).items
      feedState.impressionCalls.push({ items })
      return Promise.resolve({ inserted: items.length })
    }
    return Promise.resolve(undefined)
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
}))

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isSignedIn: true }),
  useUser: () => ({ fullName: 'Viewer Friend' }),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

import { SocialPage, toFeedImpressionPosition } from '../../src/features/social/SocialPage'

afterEach(() => {
  cleanup()
  feedState.feedHookCalls = 0
  feedState.impressionCalls.length = 0
})

describe('SocialPage feed stability', () => {
  it('keeps impression positions inside the 0 to 99 contract past 100 loaded items', () => {
    expect(toFeedImpressionPosition(0)).toBe(0)
    expect(toFeedImpressionPosition(99)).toBe(99)
    expect(toFeedImpressionPosition(100)).toBe(0)
    expect(toFeedImpressionPosition(150)).toBe(50)
    expect(toFeedImpressionPosition(205)).toBe(5)
  })

  it('deduplicates impressions across rerenders with new array identities and never loops', async () => {
    const updateDepthErrors: string[] = []
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const message = args.map((arg) => String(arg)).join(' ')
      if (message.includes('Maximum update depth exceeded')) updateDepthErrors.push(message)
    })
    try {
      const view = render(<SocialPage />)

      await waitFor(() => expect(feedState.impressionCalls.length).toBe(6))
      const recordedKeys = feedState.impressionCalls.flatMap((call) => call.items.map((item) => item.itemKey))
      expect(recordedKeys).toHaveLength(105)
      expect(new Set(recordedKeys).size).toBe(105)
      for (const call of feedState.impressionCalls) {
        for (const item of call.items) {
          expect(item.position).toBeGreaterThanOrEqual(0)
          expect(item.position).toBeLessThanOrEqual(99)
        }
      }

      // Same contents, brand-new array identities: impressions must stay
      // deduplicated and rendering must settle instead of looping.
      view.rerender(<SocialPage />)
      view.rerender(<SocialPage />)
      await waitFor(() => expect(feedState.feedHookCalls).toBe(3))
      expect(feedState.impressionCalls.length).toBe(6)
      expect(updateDepthErrors).toEqual([])
    } finally {
      errorSpy.mockRestore()
    }
  })
})
