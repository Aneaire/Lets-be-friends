// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompactComposer } from '../../src/features/messaging/CompactComposer'

afterEach(cleanup)

function field(input: HTMLElement) {
  return input as HTMLTextAreaElement
}

function button(input: HTMLElement) {
  return input as HTMLButtonElement
}

function fileInput(input: HTMLElement) {
  return input as HTMLInputElement
}

describe('CompactComposer', () => {
  it('writes a controlled draft and reports each change', () => {
    const onChange = vi.fn()
    const { rerender } = render(<CompactComposer value="" canSubmit={false} onChange={onChange} onSubmit={() => undefined} />)
    const textarea = field(screen.getByLabelText('Message'))
    expect(textarea.value).toBe('')

    fireEvent.change(textarea, { target: { value: 'Hello' } })
    expect(onChange).toHaveBeenCalledWith('Hello')

    rerender(<CompactComposer value="Hello" canSubmit onChange={onChange} onSubmit={() => undefined} />)
    expect(textarea.value).toBe('Hello')
  })

  it('keeps the send control disabled and never submits while canSubmit is false', () => {
    const onSubmit = vi.fn()
    const { container } = render(<CompactComposer value="" canSubmit={false} onChange={() => undefined} onSubmit={onSubmit} />)
    expect(button(screen.getByRole('button', { name: 'Send' })).disabled).toBe(true)
    fireEvent.submit(container.querySelector('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits on Enter and inserts a newline on Shift+Enter', () => {
    const onSubmit = vi.fn()
    const { container } = render(<CompactComposer value="Hello" canSubmit onChange={() => undefined} onSubmit={onSubmit} />)
    const textarea = field(screen.getByLabelText('Message'))

    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledOnce()

    onSubmit.mockClear()
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()

    const form = container.querySelector('form')!
    fireEvent.submit(form)
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('does not submit while a text composition (IME) is active', () => {
    const onSubmit = vi.fn()
    const { container } = render(<CompactComposer value="こん" canSubmit onChange={() => undefined} onSubmit={onSubmit} />)
    const textarea = field(screen.getByLabelText('Message'))

    fireEvent.compositionStart(textarea)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.compositionEnd(textarea)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledOnce()

    fireEvent.submit(container.querySelector('form')!)
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('shows preparing and sending states and blocks the send control', () => {
    const { rerender } = render(
      <CompactComposer value="Notes" canSubmit={false} preparing onChange={() => undefined} onSubmit={() => undefined} />,
    )
    expect(button(screen.getByRole('button', { name: 'Preparing…' })).disabled).toBe(true)

    rerender(<CompactComposer value="Notes" canSubmit={false} sending onChange={() => undefined} onSubmit={() => undefined} />)
    const send = button(screen.getByRole('button', { name: 'Sending…' }))
    expect(send.disabled).toBe(true)
    expect(send.getAttribute('aria-busy')).toBe('true')
    expect(field(screen.getByLabelText('Message')).disabled).toBe(true)
  })

  it('blocks submission while preparing even if canSubmit is true', () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <CompactComposer value="Notes" canSubmit preparing onChange={() => undefined} onSubmit={onSubmit} />,
    )

    expect(button(screen.getByRole('button', { name: 'Preparing…' })).disabled).toBe(true)
    fireEvent.submit(container.querySelector('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders the attachment tray slot in thread mode and keeps a compact standalone by default', () => {
    const { container, rerender } = render(
      <CompactComposer
        variant="thread"
        value=""
        canSubmit={false}
        attachments={<span data-testid="tray-item">session-notes.pdf</span>}
        onChange={() => undefined}
        onSubmit={() => undefined}
      />,
    )
    expect(container.querySelector('form')?.getAttribute('data-variant')).toBe('thread')
    expect(screen.getByLabelText('Selected files')).toBeTruthy()
    expect(screen.getByTestId('tray-item')).toBeTruthy()

    rerender(<CompactComposer value="" canSubmit={false} onChange={() => undefined} onSubmit={() => undefined} />)
    expect(container.querySelector('form')?.getAttribute('data-variant')).toBe('standalone')
    expect(container.querySelector('.ds-compact-composer-tray')).toBeNull()
  })

  it('exposes an accessible attach trigger and a hidden multiple file input that reports the selected files', () => {
    const onFilesSelected = vi.fn()
    const { container } = render(
      <CompactComposer
        variant="thread"
        value=""
        canSubmit={false}
        onChange={() => undefined}
        onSubmit={() => undefined}
        onFilesSelected={onFilesSelected}
      />,
    )
    const attach = screen.getByRole('button', { name: 'Attach files' })
    expect(attach.getAttribute('aria-label')).toBe('Attach files')
    expect(attach).toBeTruthy()

    const input = fileInput(container.querySelector('input[type="file"]')!)
    expect(input.multiple).toBe(true)
    const file = new File(['content'], 'session-notes.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onFilesSelected).toHaveBeenCalledTimes(1)
    expect(onFilesSelected.mock.calls[0][0]).toEqual([file])
    expect(input.value).toBe('')
  })

  it('associates the hint with the message field through aria-describedby', () => {
    const { container } = render(
      <CompactComposer
        variant="thread"
        value=""
        canSubmit={false}
        onChange={() => undefined}
        onSubmit={() => undefined}
        hint={<>Press Enter to send · Shift+Enter for a new line</>}
      />,
    )
    const textarea = field(screen.getByLabelText('Message'))
    const describedby = textarea.getAttribute('aria-describedby')
    expect(describedby).toBeTruthy()
    const hint = container.querySelector(`#${describedby}`)
    expect(hint?.textContent).toBe('Press Enter to send · Shift+Enter for a new line')
  })

  it('disables the real attach input with its proxy button', () => {
    const props = {
      variant: 'thread' as const,
      value: 'Draft',
      canSubmit: false,
      onChange: () => undefined,
      onSubmit: () => undefined,
      onFilesSelected: () => undefined,
    }
    const { container, rerender } = render(<CompactComposer {...props} disabled />)
    const input = fileInput(container.querySelector('input[type="file"]')!)

    expect(field(screen.getByLabelText('Message')).disabled).toBe(true)
    expect(button(screen.getByRole('button', { name: 'Attach files' })).disabled).toBe(true)
    expect(input.disabled).toBe(true)

    rerender(<CompactComposer {...props} sending />)
    expect(button(screen.getByRole('button', { name: 'Attach files' })).disabled).toBe(true)
    expect(input.disabled).toBe(true)

    rerender(<CompactComposer {...props} attachDisabled />)
    expect(button(screen.getByRole('button', { name: 'Attach files' })).disabled).toBe(true)
    expect(input.disabled).toBe(true)
  })
})
