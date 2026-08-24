// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import { BookingRequestEditor, type EditableBookingRequest } from '../../src/features/booking/BookingRequestEditor'

const booking: EditableBookingRequest = {
  bookingId: 'booking-1' as Id<'bookings'>,
  companionProfileId: 'companion-profile-1' as Id<'companionProfiles'>,
  companionDisplayName: 'Alex Rivera',
  category: 'Coffee and conversation',
  mode: 'online',
  requestedAt: new Date(2030, 0, 15, 14, 30).getTime(),
  durationMinutes: 60,
  notes: 'Meet somewhere quiet.',
}

const companion = {
  categories: ['Coffee and conversation', 'Walking and outdoors'],
  mode: 'both' as const,
  hourlyRateCentavos: 50_000,
}

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

describe('BookingRequestEditor', () => {
  it('preserves every field and composes date, time, duration, and trimmed notes on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<BookingRequestEditor booking={booking} companion={companion} onClose={vi.fn()} onSave={onSave} />)

    const category = screen.getByLabelText('What would you like to do?')
    const mode = screen.getByLabelText('Mode')
    const duration = screen.getByLabelText(/Duration/)
    const time = screen.getByLabelText('Time')
    const notes = screen.getByLabelText(/Anything you would like them to know/)

    expect((category as HTMLSelectElement).value).toBe('Coffee and conversation')
    expect((mode as HTMLSelectElement).value).toBe('online')
    expect((duration as HTMLSelectElement).value).toBe('60')
    expect((time as HTMLInputElement).value).toBe('14:30')
    expect((notes as HTMLTextAreaElement).value).toBe('Meet somewhere quiet.')
    expect(screen.getByText(/Estimated booking total/)).toBeTruthy()

    fireEvent.change(category, { target: { value: 'Walking and outdoors' } })
    fireEvent.change(mode, { target: { value: 'in_person' } })
    fireEvent.change(duration, { target: { value: '120' } })
    fireEvent.change(time, { target: { value: '18:45' } })
    fireEvent.change(notes, { target: { value: '  Bring tea.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith({
      category: 'Walking and outdoors',
      mode: 'in_person',
      requestedAt: new Date(2030, 0, 15, 18, 45).getTime(),
      durationMinutes: 120,
      notes: 'Bring tea.',
    })
  })

  it('rejects a past request before saving', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <BookingRequestEditor
        booking={{ ...booking, requestedAt: new Date(2020, 0, 15, 14, 30).getTime() }}
        companion={companion}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(screen.getByRole('alert').textContent).toContain('Choose a time in the future.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('prevents duplicate saves and keeps every dismissal and field disabled while saving', async () => {
    let resolveSave!: () => void
    const onClose = vi.fn()
    const onSave = vi.fn(() => new Promise<void>((resolve) => {
      resolveSave = resolve
    }))
    render(<BookingRequestEditor booking={booking} companion={companion} onClose={onClose} onSave={onSave} />)

    const save = screen.getByRole('button', { name: 'Save changes' })
    fireEvent.click(save)
    fireEvent.click(save)

    const dialog = screen.getByRole('dialog', { name: 'Update the plan with Alex Rivera' })
    expect(onSave).toHaveBeenCalledOnce()
    expect(dialog.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button', { name: 'Close edit dialog' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Save changes, loading' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByLabelText('What would you like to do?').hasAttribute('disabled')).toBe(true)
    expect(document.querySelector<HTMLButtonElement>('.calendar-trigger')?.hasAttribute('disabled')).toBe(true)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent.pointerDown(dialog.parentElement!)
    expect(onClose).not.toHaveBeenCalled()

    await act(async () => resolveSave())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(false))
  })

  it('shows rejected-save errors and re-enables the editor without closing it', async () => {
    const onClose = vi.fn()
    const onSave = vi.fn().mockRejectedValue(new Error('The booking changed on another device.'))
    render(<BookingRequestEditor booking={booking} companion={companion} onClose={onClose} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect((await screen.findByRole('alert')).textContent).toContain('The booking changed on another device.')
    expect(screen.getByRole('dialog').getAttribute('aria-busy')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('lets Calendar consume Escape before the editor closes, then restores the editor opener', () => {
    function Example() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Edit booking</button>
          {open ? <BookingRequestEditor booking={booking} companion={companion} onClose={() => setOpen(false)} onSave={vi.fn()} /> : null}
        </>
      )
    }

    render(<Example />)
    const opener = screen.getByRole('button', { name: 'Edit booking' })
    opener.focus()
    fireEvent.click(opener)

    const calendarTrigger = document.querySelector<HTMLButtonElement>('.calendar-trigger')!
    fireEvent.click(calendarTrigger)
    const calendarDialog = screen.getByRole('dialog', { name: 'Pick a date' })
    const focusedDay = calendarDialog.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')!
    fireEvent.keyDown(focusedDay, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Pick a date' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Update the plan with Alex Rivera' })).toBeTruthy()
    expect(document.activeElement).toBe(calendarTrigger)

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Update the plan with Alex Rivera' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
