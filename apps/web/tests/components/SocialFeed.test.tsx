// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const feedState = vi.hoisted(() => ({
  viewer: { _id: 'user-viewer', displayName: 'Viewer Friend' },
  feedHookCalls: 0,
  impressionCalls: [] as Array<{ items: Array<{ itemKey: string; position: number }> }>,
  links: [] as Array<{ to?: unknown; search?: Record<string, unknown>; label?: string }>,
}))

function buildFeedPosts(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const postId = `post-${index}`
    const featuredComment = index === 0 ? {
      _id: 'comment-0',
      postId,
      authorId: 'user-commenter',
      body: 'The most discussed comment',
      reportable: true,
      hidden: false,
      likeCount: 4,
      liked: false,
      ownComment: false,
      authorDisplayName: 'Commenter',
      authorUsername: 'commenter',
      authorProfileImageUrl: undefined,
      replyToAuthorDisplayName: undefined,
      replyToAuthorId: undefined,
      replyToAuthorUsername: undefined,
      threadInteractionCount: 6,
      createdAt: Date.UTC(2026, 6, 20, 12, 30),
      updatedAt: Date.UTC(2026, 6, 20, 12, 30),
    } : null
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
        commentCount: index === 0 ? 3 : 0,
        likeCount: 0,
        savedCount: 0,
        liked: false,
        featuredComment,
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
  Link: ({ children, to, search, 'aria-label': ariaLabel }: { children: React.ReactNode; to?: unknown; search?: Record<string, unknown>; 'aria-label'?: string }) => {
    feedState.links.push({ to, search, label: ariaLabel })
    return <a href="#" aria-label={ariaLabel}>{children}</a>
  },
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
  feedState.links.length = 0
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

  it('shows the most discussed comment and opens its conversation on demand', async () => {
    render(<SocialPage />)

    await waitFor(() => expect(screen.getAllByText('Most discussed')).toHaveLength(1))
    expect(screen.getByText('The most discussed comment')).toBeTruthy()
    expect(screen.getByText('See the conversation (6 interactions)')).toBeTruthy()
  })

  it('links a member post avatar to that member profile', async () => {
    render(<SocialPage />)

    await waitFor(() => expect(screen.getAllByText('Most discussed')).toHaveLength(1))
    const authorLink = feedState.links.find((link) => link.to === '/member-profile' && link.label === "View Author 0's profile")
    expect(authorLink?.search).toEqual({ userId: 'user-author-0' })
  })
})
