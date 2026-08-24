// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmationDialog, Dialog } from '../../src/design-system/molecules/Dialog'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.style.overflow = ''
})

describe('Dialog', () => {
  it('dismisses normally and restores focus to its opener', () => {
    function Example() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open details</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Booking details">
            <button type="button">Review booking</button>
          </Dialog>
        </>
      )
    }

    render(<Example />)
    const opener = screen.getByRole('button', { name: 'Open details' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Booking details' })
    fireEvent.pointerDown(dialog.parentElement!)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('guards dismissal without rerunning focus setup when busy changes', () => {
    const onClose = vi.fn()
    const requestAnimationFrame = vi.mocked(window.requestAnimationFrame)
    const { rerender } = render(
      <Dialog
        open
        onClose={onClose}
        title="Booking details"
        footer={<button type="button">Done</button>}
      >
        <button type="button">Review booking</button>
      </Dialog>,
    )

    const review = screen.getByRole('button', { name: 'Review booking' })
    review.focus()
    rerender(
      <Dialog
        open
        busy
        onClose={onClose}
        title="Booking details"
        footer={<button type="button">Done</button>}
      >
        <button type="button">Review booking</button>
      </Dialog>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Booking details' })
    const close = screen.getByRole('button', { name: 'Close dialog' })
    const done = screen.getByRole('button', { name: 'Done' })
    expect(dialog.getAttribute('aria-busy')).toBe('true')
    expect(close.hasAttribute('disabled')).toBe(true)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(review)
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(review, { key: 'Escape' })
    fireEvent.pointerDown(dialog.parentElement!)
    expect(onClose).not.toHaveBeenCalled()

    done.focus()
    fireEvent.keyDown(done, { key: 'Tab' })
    expect(document.activeElement).toBe(review)
  })
})

describe('ConfirmationDialog', () => {
  it('passes busy state through to guarded dismissal and disabled controls', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(
      <ConfirmationDialog
        open
        busy
        onClose={onClose}
        onConfirm={onConfirm}
        title="Cancel this booking?"
        description="The other member will be notified."
        confirmLabel="Cancel booking"
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Cancel this booking?' })
    expect(dialog.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button', { name: 'Close dialog' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel booking, loading' }).hasAttribute('disabled')).toBe(true)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent.pointerDown(dialog.parentElement!)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel booking, loading' }))

    expect(onClose).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
