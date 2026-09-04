// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommentActionsMenu } from '../../src/features/social/CommentActionsMenu'

afterEach(cleanup)

describe('CommentActionsMenu', () => {
  it('offers reporting only for comments owned by another member', () => {
    const onReport = vi.fn()
    render(
      <CommentActionsMenu
        ownedByViewer={false}
        onReport={onReport}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Comment options' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    fireEvent.click(trigger)

    const report = screen.getByRole('menuitem', { name: 'Report comment' })
    expect(report.getAttribute('data-tone')).toBe('danger')
    expect(screen.queryByRole('menuitem', { name: 'Edit comment' })).toBeNull()

    fireEvent.click(report)
    expect(onReport).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('offers editing without self-reporting for the comment owner', () => {
    const onEdit = vi.fn()
    const onReport = vi.fn()
    render(
      <CommentActionsMenu
        ownedByViewer
        onEdit={onEdit}
        onReport={onReport}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Comment options' }))
    const edit = screen.getByRole('menuitem', { name: 'Edit comment' })
    expect(edit.getAttribute('data-tone')).toBe('self')
    expect(screen.queryByRole('menuitem', { name: 'Report comment' })).toBeNull()

    fireEvent.click(edit)
    expect(onEdit).toHaveBeenCalledOnce()
    expect(onReport).not.toHaveBeenCalled()
  })

  it('offers deletion only for the comment owner', () => {
    const onDelete = vi.fn()
    const { unmount } = render(
      <CommentActionsMenu
        ownedByViewer
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Comment options' }))
    const remove = screen.getByRole('menuitem', { name: 'Delete comment' })
    expect(remove.getAttribute('data-tone')).toBe('danger')
    fireEvent.click(remove)
    expect(onDelete).toHaveBeenCalledOnce()
    unmount()

    render(
      <CommentActionsMenu
        ownedByViewer={false}
        onDelete={vi.fn()}
        onReport={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Comment options' }))
    expect(screen.queryByRole('menuitem', { name: 'Delete comment' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Report comment' })).toBeTruthy()
  })

  it('renders no empty menu and disables an available menu', () => {
    const { rerender } = render(
      <CommentActionsMenu ownedByViewer />,
    )
    expect(screen.queryByRole('button', { name: 'Comment options' })).toBeNull()

    rerender(
      <CommentActionsMenu
        ownedByViewer
        disabled
        onEdit={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Comment options' }),
    ).toHaveProperty('disabled', true)
  })
})
