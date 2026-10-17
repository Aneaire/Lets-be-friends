// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WeeklyAvailabilityEditor } from '../../src/features/scheduling/WeeklyAvailabilityEditor'

afterEach(cleanup)

function saveButton() {
  return screen.getByRole('button', { name: 'Save availability' }) as HTMLButtonElement
}

describe('WeeklyAvailabilityEditor', () => {
  it('renders every persisted window for a weekday with 15-minute native controls', () => {
    render(
      <WeeklyAvailabilityEditor
        initialAvailability={[
          { weekday: 1, startMinutes: 9 * 60, endMinutes: 12 * 60 },
          { weekday: 1, startMinutes: 13 * 60, endMinutes: 15 * 60 },
        ]}
        onSave={vi.fn(async () => undefined)}
      />,
    )

    const starts = screen.getAllByLabelText(/Monday window \d start time/) as HTMLInputElement[]
    expect(starts).toHaveLength(2)
    expect(starts[0].value).toBe('09:00')
    expect(starts[0].type).toBe('time')
    expect(starts[0].step).toBe('900')
    expect((screen.getByLabelText('Monday window 1 end time') as HTMLInputElement).value).toBe('12:00')
  })

  it('starts closed with no fabricated days and saves an empty schedule', async () => {
    const onSave = vi.fn(async () => undefined)
    render(<WeeklyAvailabilityEditor initialAvailability={undefined} onSave={onSave} />)

    expect(screen.queryAllByLabelText(/start time/)).toHaveLength(0)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(7)
    expect(switches.every((element) => element.getAttribute('aria-checked') === 'false')).toBe(true)
    expect(screen.getByText(/All days are currently unavailable/)).toBeTruthy()

    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([]))
  })

  it('only enables a weekday the owner explicitly chooses', async () => {
    const onSave = vi.fn(async () => undefined)
    render(<WeeklyAvailabilityEditor initialAvailability={undefined} onSave={onSave} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Monday availability' }))
    expect(screen.getByRole('switch', { name: 'Monday availability' }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByLabelText('Monday window 1 start time') as HTMLInputElement).value).toBe('09:00')
    expect((screen.getByLabelText('Monday window 1 end time') as HTMLInputElement).value).toBe('17:00')
    expect(screen.getByRole('switch', { name: 'Tuesday availability' }).getAttribute('aria-checked')).toBe('false')

    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([
      { weekday: 1, startMinutes: 9 * 60, endMinutes: 17 * 60 },
    ]))
  })

  it('allows multiple windows on one weekday and removes them explicitly', async () => {
    const onSave = vi.fn(async () => undefined)
    render(
      <WeeklyAvailabilityEditor
        initialAvailability={[{ weekday: 2, startMinutes: 9 * 60, endMinutes: 10 * 60 }]}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add another window for Tuesday' }))
    expect(screen.getAllByLabelText(/Tuesday window \d start time/)).toHaveLength(2)
    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([
      { weekday: 2, startMinutes: 9 * 60, endMinutes: 10 * 60 },
      { weekday: 2, startMinutes: 10 * 60, endMinutes: 11 * 60 },
    ]))

    fireEvent.click(screen.getByRole('button', { name: 'Remove Tuesday window 1' }))
    expect(screen.getAllByLabelText(/Tuesday window \d start time/)).toHaveLength(1)
  })

  it('rejects overlapping windows with clear feedback and does not call save', async () => {
    const onSave = vi.fn(async () => undefined)
    render(
      <WeeklyAvailabilityEditor
        initialAvailability={[
          { weekday: 1, startMinutes: 9 * 60, endMinutes: 11 * 60 },
          { weekday: 1, startMinutes: 10 * 60, endMinutes: 12 * 60 },
        ]}
        onSave={onSave}
      />,
    )

    fireEvent.click(saveButton())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('overlap'))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects an end time that is not later than the start', async () => {
    const onSave = vi.fn(async () => undefined)
    render(
      <WeeklyAvailabilityEditor
        initialAvailability={[{ weekday: 3, startMinutes: 10 * 60, endMinutes: 9 * 60 }]}
        onSave={onSave}
      />,
    )

    fireEvent.click(saveButton())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('later than its start'))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('closes a previously configured weekday and saves the empty schedule', async () => {
    const onSave = vi.fn(async () => undefined)
    render(
      <WeeklyAvailabilityEditor
        initialAvailability={[{ weekday: 5, startMinutes: 18 * 60, endMinutes: 21 * 60 }]}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Friday availability' }))
    expect((screen.getByRole('switch', { name: 'Friday availability' }) as HTMLButtonElement).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([]))
  })

  it('keeps a persisted midnight end with an explicit end-of-day control', async () => {
    const onSave = vi.fn(async () => undefined)
    render(
      <WeeklyAvailabilityEditor
        initialAvailability={[{ weekday: 1, startMinutes: 20 * 60, endMinutes: 24 * 60 }]}
        onSave={onSave}
      />,
    )

    const end = screen.getByLabelText('Monday window 1 end time') as HTMLInputElement
    const midnight = screen.getByLabelText('Monday window 1 ends at midnight') as HTMLInputElement
    expect(end.disabled).toBe(true)
    expect(end.value).toBe('')
    expect(midnight.checked).toBe(true)

    fireEvent.click(saveButton())
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([
      { weekday: 1, startMinutes: 20 * 60, endMinutes: 24 * 60 },
    ]))
  })

  it('turns a midnight end into an editable late end time when unchecked', () => {
    render(
      <WeeklyAvailabilityEditor
        initialAvailability={[{ weekday: 1, startMinutes: 20 * 60, endMinutes: 24 * 60 }]}
        onSave={vi.fn(async () => undefined)}
      />,
    )

    fireEvent.click(screen.getByLabelText('Monday window 1 ends at midnight'))
    const end = screen.getByLabelText('Monday window 1 end time') as HTMLInputElement
    expect(end.disabled).toBe(false)
    expect(end.value).toBe('23:00')
  })

  it('shows busy, error, and saved feedback around the async save', async () => {
    let resolveSave: (() => void) | undefined
    const pendingSave = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve }))
    const { rerender } = render(<WeeklyAvailabilityEditor initialAvailability={[]} onSave={pendingSave} />)

    fireEvent.click(saveButton())
    const busyButton = screen.getByText('Saving availability').closest('button') as HTMLButtonElement
    expect(busyButton.getAttribute('aria-busy')).toBe('true')
    expect(busyButton.disabled).toBe(true)
    resolveSave?.()
    await waitFor(() => expect(saveButton().disabled).toBe(false))

    const failingSave = vi.fn(async () => { throw new Error('Schedule could not be saved.') })
    rerender(<WeeklyAvailabilityEditor initialAvailability={[]} onSave={failingSave} />)
    fireEvent.click(saveButton())
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Schedule could not be saved.'))

    const succeedingSave = vi.fn(async () => undefined)
    rerender(<WeeklyAvailabilityEditor initialAvailability={[]} onSave={succeedingSave} />)
    fireEvent.click(saveButton())
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Availability saved.'))
  })

  it('enforces the shared maximum of 28 weekly windows', () => {
    const windows = Array.from({ length: 28 }, (_, index) => ({
      weekday: index % 7,
      startMinutes: 8 * 60 + Math.floor(index / 7) * 60,
      endMinutes: 9 * 60 + Math.floor(index / 7) * 60,
    }))
    render(<WeeklyAvailabilityEditor initialAvailability={windows} onSave={vi.fn(async () => undefined)} />)

    expect(screen.getByText('28 of 28 windows')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Add another window for Monday' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/You can share up to 28 weekly windows/)).toBeTruthy()
  })

  it('disables editing while the owner save is disabled', () => {
    render(<WeeklyAvailabilityEditor initialAvailability={undefined} onSave={vi.fn(async () => undefined)} disabled />)

    expect((screen.getAllByRole('switch')[0] as HTMLButtonElement).disabled).toBe(true)
    expect(saveButton().disabled).toBe(true)
  })
})
