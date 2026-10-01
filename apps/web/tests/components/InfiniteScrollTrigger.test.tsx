// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const inViewState = vi.hoisted(() => ({ inView: false }))

vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: inViewState.inView }),
}))

import { InfiniteScrollTrigger } from '../../src/design-system/molecules/InfiniteScrollTrigger'

afterEach(() => {
  cleanup()
  inViewState.inView = false
})

describe('InfiniteScrollTrigger', () => {
  it('renders nothing when the list is exhausted', () => {
    const onLoadMore = vi.fn()
    const { container } = render(
      <InfiniteScrollTrigger status="Exhausted" onLoadMore={onLoadMore} loadingLabel="Loading more posts..." />,
    )

    expect(container.innerHTML).toBe('')
    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it('loads the next page when the sentinel scrolls near the viewport', () => {
    inViewState.inView = true
    const onLoadMore = vi.fn()
    render(<InfiniteScrollTrigger status="CanLoadMore" onLoadMore={onLoadMore} loadingLabel="Loading more posts..." />)

    expect(screen.getByRole('status').textContent).toContain('Loading more posts...')
    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it('shows loading feedback without requesting another page while loading', () => {
    inViewState.inView = true
    const onLoadMore = vi.fn()
    render(<InfiniteScrollTrigger status="LoadingMore" onLoadMore={onLoadMore} loadingLabel="Loading more people..." />)

    expect(screen.getByRole('status').textContent).toContain('Loading more people...')
    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it('waits offscreen without loading when the sentinel is not in view', () => {
    inViewState.inView = false
    const onLoadMore = vi.fn()
    render(<InfiniteScrollTrigger status="CanLoadMore" onLoadMore={onLoadMore} loadingLabel="Loading more posts..." />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(onLoadMore).not.toHaveBeenCalled()
  })
})
