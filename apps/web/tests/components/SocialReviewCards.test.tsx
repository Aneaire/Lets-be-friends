// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const reviewFeedState = vi.hoisted(() => ({
  viewer: { _id: 'user-viewer', displayName: 'Viewer Friend' },
  navigateCalls: [] as Array<unknown>,
}))

function buildReviewItem() {
  return {
    kind: 'review' as const,
    itemKey: 'review:review-1',
    source: 'review' as const,
    reason: 'A recent experience from a completed booking',
    review: {
      _id: 'review-1',
      reviewerId: 'user-pat',
      reviewerDisplayName: 'Pat',
      reviewerProfileImageUrl: null,
      companionProfileId: 'companion-alyssa',
      companionDisplayName: 'Alyssa',
      rating: 5,
      body: 'The plan was thoughtful, easy to follow, and paced well for me.',
      imageUrl: null,
      likeCount: 0,
      liked: false,
      commentCount: 0,
      comments: [],
      saved: false,
      createdAt: Date.UTC(2026, 7, 18, 12, 24),
      updatedAt: Date.UTC(2026, 7, 18, 12, 24),
    },
  }
}

vi.mock('convex/react', () => ({
  usePaginatedQuery: (_fn: unknown, params: unknown) => {
    if (params && typeof params === 'object' && 'filter' in (params as Record<string, unknown>)) {
      return { results: [buildReviewItem()], status: 'Exhausted', loadMore: vi.fn() }
    }
    return { results: [], status: 'Exhausted', loadMore: vi.fn() }
  },
  useQuery: (_fn: unknown, params: unknown) => {
    if (params === undefined) return reviewFeedState.viewer
    return undefined
  },
  useMutation: () => () => Promise.resolve(undefined),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, 'aria-label': ariaLabel }: { children: React.ReactNode; 'aria-label'?: string }) => (
    <a href="#" aria-label={ariaLabel}>{children}</a>
  ),
  useNavigate: () => (args: unknown) => {
    reviewFeedState.navigateCalls.push(args)
    return Promise.resolve(undefined)
  },
}))

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isSignedIn: true }),
  useUser: () => ({ fullName: 'Viewer Friend' }),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

import { SocialPage } from '../../src/features/social/SocialPage'

afterEach(() => {
  cleanup()
  reviewFeedState.navigateCalls.length = 0
})

describe('SocialPage review cards', () => {
  it('renders one review per card', async () => {
    render(<SocialPage />)

    await waitFor(() => expect(screen.getByRole('article', { name: 'Review by Pat' })).toBeTruthy())
    expect(screen.getAllByRole('article', { name: 'Review by Pat' })).toHaveLength(1)
    expect(screen.getAllByLabelText('5 out of 5 stars')).toHaveLength(1)
    expect(screen.getByText('The plan was thoughtful, easy to follow, and paced well for me.')).toBeTruthy()
  })

  it('opens the specific Companion review when its comments are requested', async () => {
    render(<SocialPage />)

    await waitFor(() => expect(screen.getByRole('article', { name: 'Review by Pat' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }))

    await waitFor(() => expect(reviewFeedState.navigateCalls.length).toBeGreaterThan(0))
    expect(reviewFeedState.navigateCalls).toContainEqual({
      to: '/companion-profile',
      search: { companionProfileId: 'companion-alyssa', reviewId: 'review-1' },
    })
  })
})
