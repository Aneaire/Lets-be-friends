// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('convex/react', () => ({
  useQuery: () => ({ displayName: 'Robin Lee', profileImageUrl: null }),
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}))

import { ReviewPostPreview } from '../../src/features/social/ReviewPostCard'

afterEach(cleanup)

describe('ReviewPostPreview', () => {
  it('renders the shared feed card contract with the draft review', () => {
    const { container } = render(
      <ReviewPostPreview
        authorName="Robin Lee"
        companionName="Jordan Companion"
        rating={4}
        body="We planned the route in chat and it worked perfectly."
      />,
    )

    const article = screen.getByRole('article', { name: 'Review preview' })
    expect(article.classList.contains('ds-post-card')).toBe(true)
    expect(article.classList.contains('social-review-card')).toBe(true)
    expect(container.querySelector('header.ds-post-head')).toBeTruthy()
    expect(container.querySelector('.ds-post-body')).toBeTruthy()
    expect(screen.getByText(/Shared an experience with Jordan Companion/)).toBeTruthy()
    expect(screen.getByLabelText('4 out of 5 stars')).toBeTruthy()
    expect(screen.getByText('We planned the route in chat and it worked perfectly.')).toBeTruthy()
  })

  it('shows the action row a published review carries without wiring it to anything', () => {
    render(
      <ReviewPostPreview authorName="Robin Lee" companionName="Jordan Companion" rating={5} />,
    )

    expect(screen.getByRole('group', { name: 'Post actions' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Appreciate post' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show comments' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save post' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Share post' })).toBeTruthy()
  })

  it('grids several photos and keeps one photo full width', () => {
    const { container, rerender } = render(
      <ReviewPostPreview
        authorName="Robin Lee"
        companionName="Jordan Companion"
        rating={5}
        imageUrls={['blob:one', 'blob:two', 'blob:three']}
      />,
    )

    expect(container.querySelector('.social-review-image-grid')).toBeTruthy()
    expect(screen.getAllByAltText("Photo shared with Robin Lee's review")).toHaveLength(3)

    rerender(
      <ReviewPostPreview
        authorName="Robin Lee"
        companionName="Jordan Companion"
        rating={5}
        imageUrls={['blob:one']}
      />,
    )

    expect(container.querySelector('.social-review-image-grid')).toBeNull()
    expect(screen.getAllByAltText("Photo shared with Robin Lee's review")).toHaveLength(1)
  })
})
