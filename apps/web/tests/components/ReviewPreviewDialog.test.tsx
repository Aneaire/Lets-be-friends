// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ReviewPreviewDialog, ReviewPostPreview } from '../../src/features/social/ReviewPreviewDialog'

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

  it('previews the selected photo inside the card', () => {
    render(
      <ReviewPostPreview
        authorName="Robin Lee"
        companionName="Jordan Companion"
        rating={5}
        imageUrl="blob:preview"
      />,
    )

    expect(screen.getByAltText("Photo shared with Robin Lee's review")).toBeTruthy()
  })
})

describe('ReviewPreviewDialog', () => {
  it('frames the preview and explains which reviews reach the feed', () => {
    render(
      <ReviewPreviewDialog
        open
        onClose={vi.fn()}
        authorName="Robin Lee"
        companionName="Jordan Companion"
        rating={5}
        body="An easy conversation."
      />,
    )

    expect(screen.getByRole('dialog', { name: 'How your review will look' })).toBeTruthy()
    expect(screen.getByText(/Published reviews appear in the feed like this/)).toBeTruthy()
    expect(screen.getByText(/A star rating on its own stays on/)).toBeTruthy()
    expect(screen.getByRole('article', { name: 'Review preview' })).toBeTruthy()
    expect(screen.getByText('An easy conversation.')).toBeTruthy()
  })

  it('renders nothing while closed', () => {
    render(
      <ReviewPreviewDialog
        open={false}
        onClose={vi.fn()}
        authorName="Robin Lee"
        companionName="Jordan Companion"
        rating={5}
      />,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
