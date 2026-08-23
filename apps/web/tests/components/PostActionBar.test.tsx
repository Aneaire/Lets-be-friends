// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PostActionBar } from '../../src/features/social/PostActionBar'

afterEach(cleanup)

function renderActions(overrides: Partial<Parameters<typeof PostActionBar>[0]> = {}) {
  const props: Parameters<typeof PostActionBar>[0] = {
    liked: false,
    likeCount: 0,
    commentCount: 0,
    saved: false,
    commentsOpen: false,
    likeDisabled: false,
    showSave: true,
    onLike: vi.fn(),
    onToggleComments: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<PostActionBar {...props} />) }
}

describe('PostActionBar', () => {
  it('shows icons without text or zero counts', () => {
    renderActions()

    expect(screen.getByRole('button', { name: 'Appreciate post' }).textContent).toBe('')
    expect(screen.getByRole('button', { name: 'Show comments' }).textContent).toBe('')
    expect(screen.getByRole('button', { name: 'Save post' }).textContent).toBe('')
  })

  it('shows positive counts and keeps complete accessible labels', () => {
    renderActions({ liked: true, likeCount: 3, commentCount: 1, saved: true })

    expect(screen.getByRole('button', { name: 'Remove appreciation' }).textContent).toBe('3')
    expect(screen.getByRole('button', { name: 'Show 1 comment' }).textContent).toBe('1')
    expect(screen.getByRole('button', { name: 'Remove saved post' }).textContent).toBe('')
  })

  it('runs each available action', () => {
    const { props } = renderActions()

    fireEvent.click(screen.getByRole('button', { name: 'Appreciate post' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save post' }))
    expect(props.onLike).toHaveBeenCalledOnce()
    expect(props.onToggleComments).toHaveBeenCalledOnce()
    expect(props.onSave).toHaveBeenCalledOnce()
  })
})
