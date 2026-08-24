// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { CommentBubble } from '../../src/features/social/CommentBubble'
import { PostCard } from '../../src/features/social/PostCard'

afterEach(cleanup)

describe('social timeline presentation', () => {
  it('forwards article attributes and renders custom identity slots, time, and metadata', () => {
    const ref = createRef<HTMLElement>()
    render(
      <PostCard
        ref={ref}
        id="post-123"
        tabIndex={-1}
        className="custom-post"
        data-feed-item="post-123"
        author="Gelo Santiago"
        timestamp="Aug 14, 9:22 PM"
        dateTime="2026-08-14T13:22:00.000Z"
        authorAction={<a href="/profile">Gelo Santiago</a>}
        avatarAction={<a href="/profile" aria-label="View Gelo Santiago's profile"><span>GS portrait</span></a>}
        meta={<><span aria-hidden="true">·</span><span>Experience post</span></>}
        actions={<button type="button" aria-label="Post options">Options</button>}
      >
        <p>Looking for conversation practice this weekend.</p>
      </PostCard>,
    )

    const article = screen.getByRole('article')
    const header = article.querySelector('header')
    const copy = screen.getByText('Looking for conversation practice this weekend.')
    const time = screen.getByText('Aug 14, 9:22 PM')

    expect(ref.current).toBe(article)
    expect(article.id).toBe('post-123')
    expect(article.tabIndex).toBe(-1)
    expect(article.classList.contains('ds-post-card')).toBe(true)
    expect(article.classList.contains('custom-post')).toBe(true)
    expect(article.getAttribute('data-feed-item')).toBe('post-123')
    expect(screen.getByRole('link', { name: 'Gelo Santiago' })).toBeTruthy()
    expect(header?.querySelector('.ds-post-avatar')?.contains(screen.getByRole('link', { name: "View Gelo Santiago's profile" }))).toBe(true)
    expect(time.tagName).toBe('TIME')
    expect(time.getAttribute('datetime')).toBe('2026-08-14T13:22:00.000Z')
    expect(header?.textContent).toContain('Gelo Santiago·Aug 14, 9:22 PM·Experience post')
    expect(header?.contains(copy)).toBe(false)
    expect(copy.parentElement?.classList.contains('ds-post-body')).toBe(true)
    expect(screen.getByRole('button', { name: 'Post options' })).toBeTruthy()
  })

  it('keeps the default author and avatar image fallback backward compatible', () => {
    render(<PostCard author="Gelo Santiago" imageUrl="/missing.jpg" timestamp="Now">Hello.</PostCard>)

    const article = screen.getByRole('article')
    const image = article.querySelector('.ds-post-avatar img')
    expect(image).toBeTruthy()
    fireEvent.error(image!)

    expect(article.querySelector('.ds-post-avatar')?.textContent).toBe('GS')
    expect(article.querySelector('.ds-post-identity strong')?.textContent).toBe('Gelo Santiago')
  })

  it('keeps comment identity, time, body, and report action together', () => {
    render(
      <CommentBubble
        author="Alex Rivera"
        timestamp="9:28 PM"
        dateTime="2026-08-14T13:28:00.000Z"
        className="custom-comment"
        data-comment-id="comment-456"
        actions={<button type="button" aria-label="Report comment">Report</button>}
      >
        I am available on Saturday morning.
      </CommentBubble>,
    )

    const article = screen.getByRole('article')
    const header = article.querySelector('header')
    const time = screen.getByText('9:28 PM')

    expect(article.classList.contains('ds-comment-bubble')).toBe(true)
    expect(article.classList.contains('custom-comment')).toBe(true)
    expect(article.getAttribute('data-comment-id')).toBe('comment-456')
    expect(header?.textContent).toContain('Alex Rivera·9:28 PM')
    expect(time.tagName).toBe('TIME')
    expect(time.getAttribute('datetime')).toBe('2026-08-14T13:28:00.000Z')
    expect(screen.getByText('I am available on Saturday morning.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Report comment' })).toBeTruthy()
  })
})
