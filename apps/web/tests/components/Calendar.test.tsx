// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Calendar } from '../../src/design-system/organisms/Calendar'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Calendar', () => {
  it('opens with the selected day as the only tabbable grid cell', () => {
    render(<Calendar value={new Date(2026, 7, 15, 14, 30)} onChange={vi.fn()} aria-label="Booking date" />)
    const trigger = screen.getByRole('button', { name: 'Booking date' })
    trigger.focus()
    fireEvent.click(trigger)

    const selected = screen.getByRole('gridcell', { name: /August 15, 2026/ })
    expect(selected.getAttribute('aria-selected')).toBe('true')
    expect(selected.tabIndex).toBe(0)
    expect(document.activeElement).toBe(selected)
    expect(screen.getAllByRole('gridcell').filter((cell) => cell.tabIndex === 0)).toHaveLength(1)
  })

  it('supports arrow, week-boundary, and page keyboard navigation', () => {
    render(<Calendar value={new Date(2026, 7, 15)} onChange={vi.fn()} aria-label="Booking date" />)
    fireEvent.click(screen.getByRole('button', { name: 'Booking date' }))

    let focused = screen.getByRole('gridcell', { name: /August 15, 2026/ })
    fireEvent.keyDown(focused, { key: 'Home' })
    focused = screen.getByRole('gridcell', { name: /August 9, 2026/ })
    expect(document.activeElement).toBe(focused)

    fireEvent.keyDown(focused, { key: 'End' })
    focused = screen.getByRole('gridcell', { name: /August 15, 2026/ })
    expect(document.activeElement).toBe(focused)

    fireEvent.keyDown(focused, { key: 'ArrowRight' })
    focused = screen.getByRole('gridcell', { name: /August 16, 2026/ })
    expect(document.activeElement).toBe(focused)

    fireEvent.keyDown(focused, { key: 'ArrowDown' })
    focused = screen.getByRole('gridcell', { name: /August 23, 2026/ })
    expect(document.activeElement).toBe(focused)

    fireEvent.keyDown(focused, { key: 'PageDown' })
    focused = screen.getByRole('gridcell', { name: /September 23, 2026/ })
    expect(document.activeElement).toBe(focused)
    expect(screen.getByRole('dialog').textContent).toContain('September')
  })

  it('clamps keyboard movement to the allowed range and preserves the selected time', () => {
    const onChange = vi.fn()
    render(
      <Calendar
        value={new Date(2026, 7, 15, 14, 30)}
        onChange={onChange}
        min={new Date(2026, 7, 14)}
        max={new Date(2026, 7, 16)}
        aria-label="Booking date"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Booking date' }))

    const selected = screen.getByRole('gridcell', { name: /August 15, 2026/ })
    fireEvent.keyDown(selected, { key: 'ArrowRight' })
    const lastAllowed = screen.getByRole('gridcell', { name: /August 16, 2026/ })
    fireEvent.keyDown(lastAllowed, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(lastAllowed)

    fireEvent.click(lastAllowed)
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0].getHours()).toBe(14)
  })

  it('returns focus to the trigger when Escape closes the picker', () => {
    render(<Calendar value={new Date(2026, 7, 15)} onChange={vi.fn()} aria-label="Booking date" />)
    const trigger = screen.getByRole('button', { name: 'Booking date' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
