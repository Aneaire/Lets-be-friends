// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PostActionsMenu } from '../../src/features/social/PostActionsMenu'

afterEach(cleanup)

describe('PostActionsMenu', () => {
  it('maps the viewer report action to menu semantics and closes after selection', () => {
    const onReport = vi.fn()
    render(<PostActionsMenu ownedByViewer={false} onReport={onReport} />)

    const trigger = screen.getByRole('button', { name: 'Post options' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.querySelector('svg')).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(trigger)

    const menu = screen.getByRole('menu', { name: 'Post options' })
    const report = screen.getByRole('menuitem', { name: 'Report post' })
    expect(menu.contains(report)).toBe(true)
    expect(report.getAttribute('data-tone')).toBe('danger')
    expect(report.querySelector('svg')).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Edit post' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Delete post' })).toBeNull()

    fireEvent.click(report)
    expect(onReport).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('maps owner callbacks to self edit and danger delete items', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<PostActionsMenu ownedByViewer onEdit={onEdit} onDelete={onDelete} />)

    const trigger = screen.getByRole('button', { name: 'Post options' })
    fireEvent.click(trigger)

    const edit = screen.getByRole('menuitem', { name: 'Edit post' })
    const deleteItem = screen.getByRole('menuitem', { name: 'Delete post' })
    expect(edit.getAttribute('data-tone')).toBe('self')
    expect(deleteItem.getAttribute('data-tone')).toBe('danger')
    expect(screen.queryByRole('menuitem', { name: 'Report post' })).toBeNull()

    fireEvent.click(edit)
    expect(onEdit).toHaveBeenCalledOnce()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete post' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('focuses the first item, closes on Escape, and returns focus to the trigger', () => {
    render(<PostActionsMenu ownedByViewer={false} onReport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Post options' })

    fireEvent.click(trigger)
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Report post' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes an open menu when it becomes disabled', () => {
    const { rerender } = render(<PostActionsMenu ownedByViewer={false} onReport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Post options' })

    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeTruthy()

    rerender(<PostActionsMenu ownedByViewer={false} onReport={vi.fn()} disabled />)

    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger.hasAttribute('disabled')).toBe(true)
    fireEvent.click(trigger)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('omits actions whose callbacks are missing and renders no empty menu trigger', () => {
    const onEdit = vi.fn()
    const { rerender } = render(<PostActionsMenu ownedByViewer onEdit={onEdit} />)
    const trigger = screen.getByRole('button', { name: 'Post options' })

    fireEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Edit post' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Delete post' })).toBeNull()

    rerender(<PostActionsMenu ownedByViewer={false} />)

    expect(screen.queryByRole('button', { name: 'Post options' })).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
