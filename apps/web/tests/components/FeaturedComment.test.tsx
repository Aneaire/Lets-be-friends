// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, search, ...props }: { children: ReactNode; to: string; search?: Record<string, unknown> }) => (
    <a href={to} data-search={search ? JSON.stringify(search) : undefined} {...props}>{children}</a>
  ),
}))

import { FeaturedComment, type FeaturedCommentView } from '../../src/features/social/FeaturedComment'

afterEach(cleanup)

const comment: FeaturedCommentView = {
  authorId: 'user-commenter',
  authorDisplayName: 'Commenter',
  authorProfileImageUrl: null,
  ownComment: false,
  body: 'A thoughtful note on this plan.',
  threadInteractionCount: 6,
  createdAt: Date.UTC(2026, 6, 20, 12, 30),
  updatedAt: Date.UTC(2026, 6, 20, 12, 30),
}

describe('FeaturedComment', () => {
  it('labels the most discussed comment, links the author, and opens the thread', () => {
    const onOpenThread = vi.fn()
    render(<FeaturedComment comment={comment} onOpenThread={onOpenThread} />)

    expect(screen.getByLabelText('Most discussed comment')).toBeTruthy()
    expect(screen.getByText('Most discussed')).toBeTruthy()
    expect(screen.getByText('A thoughtful note on this plan.')).toBeTruthy()
    expect(screen.getByLabelText("View Commenter's profile").getAttribute('data-search')).toContain('user-commenter')

    fireEvent.click(screen.getByRole('button', { name: 'See the conversation (6 interactions)' }))
    expect(onOpenThread).toHaveBeenCalledOnce()
  })

  it('links the viewer profile when the featured comment is their own', () => {
    render(
      <FeaturedComment
        comment={{ ...comment, ownComment: true, authorDisplayName: 'Mara Reyes' }}
        onOpenThread={() => undefined}
      />,
    )

    expect(screen.getByLabelText('View your profile').getAttribute('href')).toBe('/profile')
  })
})
