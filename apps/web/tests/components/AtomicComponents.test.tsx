// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Avatar } from '../../src/design-system/atoms/Avatar'
import { Button } from '../../src/design-system/atoms/Button'
import { Input } from '../../src/design-system/atoms/Field'
import { ActionMenu } from '../../src/design-system/molecules/ActionMenu'
import { FormField } from '../../src/design-system/molecules/FormField'
import { MessageBubble } from '../../src/features/messaging/MessageBubble'

afterEach(cleanup)

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

  it('announces message direction through readable content and status', () => {
    render(<MessageBubble direction="outgoing" body="See you at 2:30 PM." timestamp="2:24 PM" status="sent" />)
    expect(screen.getByText('See you at 2:30 PM.')).toBeTruthy()
    expect(screen.getByText('2:24 PM').tagName).toBe('TIME')
    expect(screen.getByLabelText('Message sent')).toBeTruthy()
  })
})
