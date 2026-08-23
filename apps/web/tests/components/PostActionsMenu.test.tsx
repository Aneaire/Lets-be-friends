// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PostActionsMenu } from '../../src/features/social/PostActionsMenu'

afterEach(cleanup)

describe('PostActionsMenu', () => {
  it('shows only the report action to a viewer who does not own the post', () => {
    const onReport = vi.fn()
    render(<PostActionsMenu ownedByViewer={false} onReport={onReport} />)

    expect(screen.queryByRole('button', { name: 'Report post' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Post options' }))

    expect(screen.getByRole('button', { name: 'Report post' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit post' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete post' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Report post' }))
    expect(onReport).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Report post' })).toBeNull()
  })

  it('shows edit and delete actions to the post owner without showing report', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<PostActionsMenu ownedByViewer onEdit={onEdit} onDelete={onDelete} />)

    const trigger = screen.getByRole('button', { name: 'Post options' })
    fireEvent.click(trigger)

    expect(screen.getByRole('button', { name: 'Edit post' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete post' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Report post' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit post' }))
    expect(onEdit).toHaveBeenCalledOnce()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Delete post' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('closes on Escape and returns focus to the trigger', () => {
    render(<PostActionsMenu ownedByViewer={false} onReport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Post options' })

    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('button', { name: 'Report post' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
