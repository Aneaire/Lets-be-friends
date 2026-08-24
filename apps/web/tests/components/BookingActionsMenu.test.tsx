// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from '../../src/design-system/molecules/Dialog'
import { BookingActionsMenu } from '../../src/features/booking/BookingActionsMenu'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.style.overflow = ''
})

describe('BookingActionsMenu', () => {
  it('keeps secondary booking actions hidden until the menu is opened', () => {
    render(<BookingActionsMenu onCancel={vi.fn()} onEditRequest={vi.fn()} onReport={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Edit request' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More booking actions' }))

    expect(screen.getByRole('button', { name: 'Edit request' }).getAttribute('data-tone')).toBe('social')
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

  it('restores the persistent trigger after an action-opened dialog closes', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    function Example() {
      const [dialogOpen, setDialogOpen] = useState(false)
      return (
        <>
          <BookingActionsMenu onEditRequest={() => setDialogOpen(true)} onReport={vi.fn()} />
          <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Edit booking">
            <button type="button">Editor field</button>
          </Dialog>
        </>
      )
    }

    render(<Example />)
    const trigger = screen.getByRole('button', { name: 'More booking actions' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Edit request' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
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
