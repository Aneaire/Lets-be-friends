// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Avatar } from '../../src/design-system/atoms/Avatar'
import { Button } from '../../src/design-system/atoms/Button'
import { Input } from '../../src/design-system/atoms/Field'
import { ActionMenu } from '../../src/design-system/molecules/ActionMenu'
import { Dialog } from '../../src/design-system/molecules/Dialog'
import { FormField } from '../../src/design-system/molecules/FormField'
import { SearchField } from '../../src/design-system/molecules/SearchField'
import { SegmentedControl } from '../../src/design-system/molecules/SegmentedControl'
import { MessageBubble } from '../../src/features/messaging/MessageBubble'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.style.overflow = ''
})

describe('atomic design-system components', () => {
  it('keeps a loading button disabled and exposes its busy state', () => {
    render(<Button loading loadingLabel="Sending" intent="social">Send</Button>)
    const button = screen.getByRole('button', { name: 'Send, loading' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByText('Sending')).toBeTruthy()
  })

  it('falls back to initials when an avatar image fails', () => {
    render(<Avatar name="Alex Rivera" src="/missing.jpg" />)
    fireEvent.error(screen.getByRole('img').querySelector('img')!)
    expect(screen.getByRole('img', { name: 'Alex Rivera has no profile photo' }).textContent).toBe('AR')
  })

  it('associates help and error copy with its field', () => {
    render(<FormField label="Username" error="Already taken"><Input /></FormField>)
    const input = screen.getByLabelText('Username')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
  })

  it('supports menu focus navigation, Escape, and trigger focus restoration', () => {
    render(<ActionMenu label="Post options" items={[{ label: 'Unavailable action', disabled: true, onSelect: vi.fn() }, { label: 'Edit post', tone: 'self', onSelect: vi.fn() }, { label: 'Report post', tone: 'danger', onSelect: vi.fn() }]} />)
    const trigger = screen.getByRole('button', { name: 'Post options' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    fireEvent.click(trigger)
    const edit = screen.getByRole('menuitem', { name: 'Edit post' })
    const report = screen.getByRole('menuitem', { name: 'Report post' })
    expect(document.activeElement).toBe(edit)
    fireEvent.keyDown(edit, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(report)
    fireEvent.keyDown(report, { key: 'Home' })
    expect(document.activeElement).toBe(edit)
    fireEvent.keyDown(edit, { key: 'End' })
    expect(document.activeElement).toBe(report)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menuitem', { name: 'Report post' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('moves segmented-control selection and focus with arrow keys', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        label="Feed view"
        options={[
          { value: 'all', label: 'All posts' },
          { value: 'following', label: 'Following', disabled: true },
          { value: 'saved', label: 'Saved' },
        ]}
        value="all"
        onChange={onChange}
        tone="social"
      />,
    )
    const allPosts = screen.getByRole('radio', { name: 'All posts' })
    const saved = screen.getByRole('radio', { name: 'Saved' })
    allPosts.focus()
    fireEvent.keyDown(allPosts, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('saved')
    expect(document.activeElement).toBe(saved)
  })

  it('gives an enabled segment a tab stop when the selected value is disabled', () => {
    render(
      <SegmentedControl
        label="Booking status"
        options={[
          { value: 'active', label: 'Active' },
          { value: 'archived', label: 'Archived', disabled: true },
        ]}
        value="archived"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Active' }).tabIndex).toBe(0)
    expect(screen.getByRole('radio', { name: 'Archived' }).tabIndex).toBe(-1)
  })

  it('clears search and returns focus to the field', () => {
    const onClear = vi.fn()
    function SearchExample() {
      const [value, setValue] = useState('Alex')
      return <SearchField label="Search members" value={value} onChange={setValue} onClear={onClear} />
    }
    render(<SearchExample />)
    const input = screen.getByRole('searchbox', { name: 'Search members' })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(input.getAttribute('value')).toBe('')
    expect(document.activeElement).toBe(input)
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('does not expose a clear action for disabled or read-only search fields', () => {
    const { rerender } = render(<SearchField label="Search members" value="Alex" onChange={vi.fn()} disabled />)
    expect(screen.getByRole('searchbox', { name: 'Search members' }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()

    rerender(<SearchField label="Search members" value="Alex" onChange={vi.fn()} readOnly />)
    expect(screen.getByRole('searchbox', { name: 'Search members' }).hasAttribute('readonly')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })

  it('traps dialog focus, closes on Escape, restores focus, and unlocks scrolling', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    function DialogExample() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open details</button>
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title="Booking details"
            footer={<button type="button">Done</button>}
          >
            <button type="button">Review booking</button>
          </Dialog>
        </>
      )
    }

    render(<DialogExample />)
    const opener = screen.getByRole('button', { name: 'Open details' })
    opener.focus()
    fireEvent.click(opener)
    const close = screen.getByRole('button', { name: 'Close dialog' })
    const done = screen.getByRole('button', { name: 'Done' })
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(close)

    done.focus()
    fireEvent.keyDown(done, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('announces message direction through readable content and status', () => {
    const { container } = render(
      <MessageBubble
        direction="outgoing"
        body="See you at 2:30 PM."
        timestamp="2:24 PM"
        dateTime="2026-08-23T14:24:00.000Z"
        status="sent"
      />,
    )
    expect(screen.getByText('See you at 2:30 PM.')).toBeTruthy()
    expect(screen.getByText('2:24 PM').getAttribute('datetime')).toBe('2026-08-23T14:24:00.000Z')
    expect(screen.getByLabelText('Message sent')).toBeTruthy()
    expect(container.querySelector('.ds-message')?.getAttribute('data-direction')).toBe('outgoing')
    expect(container.querySelector('.ds-message-content .ds-message-delivery')).toBeTruthy()
  })
})
