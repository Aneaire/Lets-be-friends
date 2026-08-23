// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { CommentBubble } from '../../src/features/social/CommentBubble'
import { PostCard } from '../../src/features/social/PostCard'

afterEach(cleanup)

describe('social timeline presentation', () => {
  it('keeps post author and time in one compact header region', () => {
    render(
      <PostCard
        author="Gelo Santiago"
        timestamp="Aug 14, 9:22 PM"
        actions={<button type="button" aria-label="Post options">Options</button>}
      >
        <p>Looking for conversation practice this weekend.</p>
      </PostCard>,
    )

    const article = screen.getByRole('article')
    const header = article.querySelector('header')

    const copy = screen.getByText('Looking for conversation practice this weekend.')

    expect(article.classList.contains('ds-post-card')).toBe(true)
    expect(header?.textContent).toContain('Gelo Santiago·Aug 14, 9:22 PM')
    expect(header?.querySelector('.ds-post-avatar')).toBeTruthy()
    expect(header?.contains(copy)).toBe(false)
    expect(copy.parentElement?.classList.contains('ds-post-body')).toBe(true)
    expect(screen.getByRole('button', { name: 'Post options' })).toBeTruthy()
  })

  it('keeps comment identity, time, body, and report action together', () => {
    render(
      <CommentBubble
        author="Alex Rivera"
        timestamp="9:28 PM"
        actions={<button type="button" aria-label="Report comment">Report</button>}
      >
        I am available on Saturday morning.
      </CommentBubble>,
    )

    const article = screen.getByRole('article')
    const header = article.querySelector('header')

    expect(article.classList.contains('ds-comment-bubble')).toBe(true)
    expect(header?.textContent).toContain('Alex Rivera·9:28 PM')
    expect(screen.getByText('I am available on Saturday morning.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Report comment' })).toBeTruthy()
  })
})
