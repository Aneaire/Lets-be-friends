// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookingActionsMenu } from '../../src/components/BookingActionsMenu'

afterEach(cleanup)

describe('BookingActionsMenu', () => {
  it('keeps secondary booking actions hidden until the menu is opened', () => {
    render(<BookingActionsMenu onCancel={vi.fn()} onEditRequest={vi.fn()} onReport={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Edit request' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More booking actions' }))

    expect(screen.getByRole('button', { name: 'Edit request' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Report' })).toBeTruthy()
  })

  it('runs the selected action and closes the panel', () => {
    const onReport = vi.fn()
    render(<BookingActionsMenu onReport={onReport} />)

    fireEvent.click(screen.getByRole('button', { name: 'More booking actions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Report' }))

    expect(onReport).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Report' })).toBeNull()
  })

  it('closes on Escape and returns focus to the trigger', () => {
    render(<BookingActionsMenu onReport={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'More booking actions' })

    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('button', { name: 'Report' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
