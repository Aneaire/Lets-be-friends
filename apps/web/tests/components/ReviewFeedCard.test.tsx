// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    search,
    onClick,
    className,
    ...rest
  }: {
    children: React.ReactNode
    to?: string
    search?: Record<string, unknown>
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
    className?: string
  }) => (
    <a
      href="#"
      data-to={to}
      data-search={search ? JSON.stringify(search) : undefined}
      className={className}
      onClick={(event) => {
        event.preventDefault()
        onClick?.(event)
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}))

import { ReviewFeedCard } from '../../src/features/social/ReviewFeedCard'

afterEach(cleanup)

function buildReview() {
  return {
    _id: 'review-1',
    reviewerId: 'user-reviewer',
    reviewerDisplayName: 'Robin Lee',
    reviewerProfileImageUrl: null,
    companionProfileId: 'companion-7',
    companionDisplayName: 'Jordan Companion',
    rating: 5,
    body: 'A thoughtful walk and an easy conversation.',
    imageUrl: 'https://example.com/review.jpg',
    likeCount: 3,
    liked: false,
    commentCount: 2,
    saved: false,
    createdAt: Date.UTC(2026, 6, 20, 12, 0),
  }
}

function mountCard(viewerReady = true) {
  const onLike = vi.fn()
  const onOpen = vi.fn()
  const onSave = vi.fn()
  const onShareToFeed = vi.fn().mockResolvedValue(undefined)
  render(
    <ReviewFeedCard
      review={buildReview() as unknown as Parameters<typeof ReviewFeedCard>[0]['review']}
      viewerReady={viewerReady}
      onLike={onLike}
      onOpen={onOpen}
      onSave={onSave}
      onShareToFeed={onShareToFeed}
    />,
  )
  return { onLike, onOpen, onSave, onShareToFeed }
}

describe('ReviewFeedCard layout regression', () => {
  it('renders inside the shared PostCard layout contract instead of legacy social post markup', () => {
    mountCard()

    const article = screen.getByRole('article', { name: 'Review by Robin Lee' })
    expect(article.classList.contains('ds-post-card')).toBe(true)
    expect(article.querySelector('header.ds-post-head')).toBeTruthy()
    expect(article.querySelector('.ds-post-identity')).toBeTruthy()
    expect(article.querySelector('.ds-post-meta')).toBeTruthy()
    expect(article.querySelector('.ds-post-body')).toBeTruthy()
    expect(article.querySelector('.social-post-head')).toBeNull()
    expect(article.querySelector('.social-post-identity')).toBeNull()
    expect(article.querySelector('.social-post-meta')).toBeNull()
    expect(article.querySelector(':scope > .social-post-body')).toBeNull()
  })

  it('preserves reviewer profile links, timestamp, Companion review link, stars, body, and photo', () => {
    mountCard()

    expect(screen.getByRole('link', { name: 'Robin Lee' })).toBeTruthy()
    expect(screen.getByRole('link', { name: "View Robin Lee's profile" })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Robin Lee' }).getAttribute('data-to')).toBe('/member-profile')

    const companionLink = screen.getByRole('link', { name: 'Shared an experience with Jordan Companion' })
    expect(companionLink.getAttribute('data-to')).toBe('/companion-profile')
    expect(companionLink.getAttribute('data-search')).toContain('companion-7')
    expect(companionLink.getAttribute('data-search')).toContain('review-1')

    const time = screen.getByText(/Jul 20/i).closest('time')
    expect(time).toBeTruthy()

    expect(screen.getByLabelText('5 out of 5 stars')).toBeTruthy()
    expect(screen.getByText('A thoughtful walk and an easy conversation.')).toBeTruthy()
    expect(screen.getByAltText("Photo shared with Robin Lee's review")).toBeTruthy()
  })

  it('keeps like, open, save, and share actions wired', () => {
    const { onLike, onOpen, onSave } = mountCard()

    fireEvent.click(screen.getByRole('button', { name: 'Appreciate post' }))
    expect(onLike).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Show 2 comments' }))
    expect(onOpen).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('link', { name: 'Shared an experience with Jordan Companion' }))
    expect(onOpen).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: 'Save post' }))
    expect(onSave).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Share post' }))
    expect(screen.getByText('Share this review')).toBeTruthy()
  })
})
