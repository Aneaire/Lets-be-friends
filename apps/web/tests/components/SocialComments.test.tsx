// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const commentFixtures = vi.hoisted(() => ({
  comments: [
    {
      _id: 'comment-1',
      postId: 'post-1',
      authorId: 'user-mara',
      parentCommentId: undefined,
      body: 'A thoughtful note on this post.',
      mentions: undefined,
      reportable: true,
      hidden: false,
      likeCount: 0,
      createdAt: Date.UTC(2026, 7, 20, 14, 13),
      updatedAt: Date.UTC(2026, 7, 20, 14, 13),
      authorDisplayName: 'Mara Reyes',
      authorUsername: 'mara_reyes',
      authorProfileImageUrl: undefined,
      ownComment: true,
      liked: false,
      replyToAuthorDisplayName: undefined,
      replyToAuthorId: undefined,
      replyToAuthorUsername: undefined,
    },
  ],
  loadMore: vi.fn(),
}))

vi.mock('convex/react', () => ({
  usePaginatedQuery: () => ({ results: commentFixtures.comments, status: 'Exhausted', loadMore: commentFixtures.loadMore }),
  useQuery: () => [],
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
  body: 'Looking for conversation practice this weekend.',
  media: [],
  mentions: undefined,
  reportable: true,
  hidden: false,
  commentCount: 1,
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

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('SocialPage comment interactions', () => {
  it('opens comments, creates a comment, edits, likes, and deletes without an update-depth loop', async () => {
    const updateDepthErrors: string[] = []
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const message = args.map((arg) => String(arg)).join(' ')
      if (message.includes('Maximum update depth exceeded')) updateDepthErrors.push(message)
    })
    try {
      const onComment = vi.fn().mockResolvedValue('comment-2')
      const onEditComment = vi.fn().mockResolvedValue(undefined)
      const onLikeComment = vi.fn().mockResolvedValue(true)
      const onDeleteComment = vi.fn().mockResolvedValue(undefined)

      render(
        <PostRow
          post={post}
          focusComments={false}
          viewerReady
          onComment={onComment}
          onEdit={vi.fn().mockResolvedValue(undefined)}
          onDelete={vi.fn().mockResolvedValue(undefined)}
          onLike={vi.fn().mockResolvedValue(undefined)}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onReport={vi.fn().mockResolvedValue(undefined)}
          onEditComment={onEditComment}
          onDeleteComment={onDeleteComment}
          onLikeComment={onLikeComment}
          onReportComment={vi.fn().mockResolvedValue(undefined)}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Show 1 comment' }))
      expect(screen.getByText('A thoughtful note on this post.')).toBeTruthy()

      fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), { target: { value: 'I can join on Saturday.' } })
      fireEvent.click(screen.getByRole('button', { name: 'Comment' }))
      await waitFor(() => expect(onComment).toHaveBeenCalledWith('I can join on Saturday.'))

      fireEvent.click(screen.getByRole('button', { name: "Like Mara Reyes's comment" }))
      await waitFor(() => expect(onLikeComment).toHaveBeenCalledWith('comment-1'))

      fireEvent.click(screen.getByRole('button', { name: 'Comment options' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Edit comment' }))
      fireEvent.change(screen.getByRole('textbox', { name: 'Edit comment' }), { target: { value: 'An updated note.' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(onEditComment).toHaveBeenCalledWith('comment-1', 'An updated note.'))

      fireEvent.click(screen.getByRole('button', { name: 'Comment options' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete comment' }))
      expect(screen.getByRole('dialog', { name: 'Delete this comment?' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }))
      await waitFor(() => expect(onDeleteComment).toHaveBeenCalledWith('comment-1'))

      expect(updateDepthErrors).toEqual([])
    } finally {
      errorSpy.mockRestore()
    }
  })
})
