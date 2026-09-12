// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('convex/react', () => ({
  usePaginatedQuery: () => ({ results: [], status: 'Exhausted', loadMore: vi.fn() }),
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
}))

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isSignedIn: true }),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

import { PostRow } from '../../src/features/social/SocialPage'

const post = {
  _id: 'post-1',
  authorId: 'user-alex',
  body: '',
  media: [],
  mentions: undefined,
  poll: {
    question: 'Do you watch the agent while it works?',
    options: [
      { id: 'option-1', label: 'Usually', voteCount: 25, percentage: 17 },
      { id: 'option-2', label: 'Occasionally', voteCount: 70, percentage: 47 },
    ],
    totalVotes: 95,
    closed: false,
    votedOptionId: undefined,
  },
  reportable: true,
  hidden: false,
  commentCount: 0,
  likeCount: 0,
  savedCount: 0,
  liked: false,
  authorDisplayName: 'Alex Rivera',
  authorUsername: 'alex_rivera',
  authorProfileImageUrl: undefined,
  authorCompanionProfileId: undefined,
  saved: false,
  followingAuthor: false,
  ownPost: false,
  createdAt: Date.UTC(2026, 7, 19, 14, 13),
  updatedAt: Date.UTC(2026, 7, 19, 14, 13),
} as any

afterEach(cleanup)

function renderPost(onVotePoll = vi.fn().mockResolvedValue(undefined)) {
  render(
    <PostRow
      post={post}
      focusComments={false}
      viewerReady
      onComment={vi.fn().mockResolvedValue(undefined)}
      onEdit={vi.fn().mockResolvedValue(undefined)}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      onLike={vi.fn().mockResolvedValue(undefined)}
      onSave={vi.fn().mockResolvedValue(undefined)}
      onReport={vi.fn().mockResolvedValue(undefined)}
      onEditComment={vi.fn().mockResolvedValue(undefined)}
      onDeleteComment={vi.fn().mockResolvedValue(undefined)}
      onLikeComment={vi.fn().mockResolvedValue(undefined)}
      onReportComment={vi.fn().mockResolvedValue(undefined)}
      onVotePoll={onVotePoll}
    />,
  )
  return onVotePoll
}

describe('feed poll post', () => {
  it('renders the poll on a post and forwards the selected option', async () => {
    const onVotePoll = renderPost()

    expect(screen.getByText('Do you watch the agent while it works?')).toBeTruthy()
    expect(screen.getByText('95 votes')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Occasionally/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Vote' }))
    await waitFor(() => expect(onVotePoll).toHaveBeenCalledWith('option-2'))
  })
})
