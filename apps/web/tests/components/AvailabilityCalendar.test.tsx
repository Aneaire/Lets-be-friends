// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvailabilityCalendar } from '../../src/features/scheduling/AvailabilityCalendar'

afterEach(cleanup)

const NOW = Date.UTC(2026, 9, 15, 2, 0)
const OCTOBER = { year: 2026, month: 9 }
const NOVEMBER = { year: 2026, month: 10 }
const SLOT_0900 = Date.UTC(2026, 9, 20, 1, 0)
const SLOT_1030 = Date.UTC(2026, 9, 20, 2, 30)
const SLOT_1400 = Date.UTC(2026, 9, 21, 6, 0)

const days = [
  { date: '2026-10-20', startsAt: [SLOT_0900, SLOT_1030] },
  { date: '2026-10-21', startsAt: [SLOT_1400] },
]

function renderCalendar(overrides: Partial<React.ComponentProps<typeof AvailabilityCalendar>> = {}) {
  const props: React.ComponentProps<typeof AvailabilityCalendar> = {
    month: OCTOBER,
    onMonthChange: vi.fn(),
    days,
    durationMinutes: 60,
    selectedStart: null,
    onSelectStart: vi.fn(),
    now: NOW,
    ...overrides,
  }
  return { props, ...render(<AvailabilityCalendar {...props} />) }
}

describe('AvailabilityCalendar', () => {
  it('reveals backend-provided Manila start times after a day is picked and emits the timestamp', () => {
    const { props } = renderCalendar()

    expect(screen.getByText(/Times shown in Asia\/Manila \(PHT\)/)).toBeTruthy()
    expect(screen.getByText(/Each start fits a 1 hr session/)).toBeTruthy()
    expect(screen.getByText('Choose an available day to see start times.')).toBeTruthy()
    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(0)

    fireEvent.click(screen.getByRole('gridcell', { name: /Tuesday, October 20, 2026/ }))
    expect(screen.getByRole('button', { name: '9:00 AM, 1 hr session' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '10:30 AM, 1 hr session' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '9:00 AM, 1 hr session' }))
    expect(props.onSelectStart).toHaveBeenCalledWith(SLOT_0900)
    expect(document.querySelectorAll('input')).toHaveLength(0)
  })

  it('marks past dates and days without starts as unavailable', () => {
    renderCalendar()

    const past = screen.getByRole('gridcell', { name: /Saturday, October 10, 2026, Past date/ })
    expect((past as HTMLButtonElement).disabled).toBe(true)
    const empty = screen.getByRole('gridcell', { name: /Thursday, October 22, 2026, No open times/ })
    expect((empty as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('gridcell', { name: /Tuesday, October 20, 2026, 2 open times/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('navigates to the previous and next Manila month', () => {
    const { props } = renderCalendar({ month: NOVEMBER })

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(props.onMonthChange).toHaveBeenCalledWith(OCTOBER)
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(props.onMonthChange).toHaveBeenCalledWith({ year: 2026, month: 11 })
  })

  it('clamps month navigation to the current Manila month and the shared maximum month', () => {
    renderCalendar({ month: OCTOBER })
    expect((screen.getByRole('button', { name: 'Previous month' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Next month' }) as HTMLButtonElement).disabled).toBe(false)

    cleanup()
    renderCalendar({ month: { year: 2100, month: 11 } })
    expect((screen.getByRole('button', { name: 'Next month' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Previous month' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('builds a valid ARIA grid with a header row and seven cells per week row', () => {
    renderCalendar()

    const grid = screen.getByRole('grid', { name: 'October 2026 dates' })
    const rows = within(grid).getAllByRole('row')
    expect(rows.length).toBeGreaterThan(1)
    expect(within(rows[0]).getAllByRole('columnheader')).toHaveLength(7)
    for (const row of rows.slice(1)) {
      expect(within(row).getAllByRole('gridcell')).toHaveLength(7)
    }
  })

  it('keeps the calendar visible while slots load and disables its controls and passed days', () => {
    renderCalendar({ loading: true })

    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Loading available times in Asia/Manila')
    expect((screen.getByRole('button', { name: 'Next month' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('gridcell', { name: /Tuesday, October 20, 2026/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables passed days and times when scheduling data fails to load', () => {
    renderCalendar({ error: 'Available times could not be loaded. Try again.' })

    expect(screen.getByRole('alert').textContent).toContain('Available times could not be loaded.')
    expect((screen.getByRole('gridcell', { name: /Tuesday, October 20, 2026/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /9:00 AM/ })).toBeNull()
  })

  it('says honestly when the Companion has not shared a schedule', () => {
    renderCalendar({ scheduleConfigured: false })

    expect(screen.getByText('This Companion has not shared a weekly schedule yet.')).toBeTruthy()
    expect((screen.getByRole('gridcell', { name: /Tuesday, October 20, 2026, No open times/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('reports a month with no open days and a day with no remaining starts', () => {
    const { rerender, props } = renderCalendar({ days: [] })
    expect(screen.getByText('No open times this month. Try another month.')).toBeTruthy()

    rerender(<AvailabilityCalendar {...props} selectedStart={SLOT_0900} days={days} />)
    rerender(<AvailabilityCalendar {...props} selectedStart={null} days={[{ date: '2026-10-20', startsAt: [] }]} />)
    expect(screen.getByText('No open times remain on this day.')).toBeTruthy()
  })

  it('shows a stale selection as unavailable without inventing a time control', () => {
    const staleStart = Date.UTC(2026, 8, 20, 1, 0)
    renderCalendar({ selectedStart: staleStart })

    expect(screen.getByRole('status').textContent).toContain('The time you picked is no longer available')
    expect(screen.queryAllByRole('button', { name: /9:00 AM/ })).toHaveLength(0)
  })

  it('clears the selected start when the month, duration, or picked date changes', () => {
    const onSelectStart = vi.fn()
    const { props, rerender } = renderCalendar({ selectedStart: SLOT_0900, onSelectStart })

    rerender(<AvailabilityCalendar {...props} month={NOVEMBER} selectedStart={SLOT_0900} onSelectStart={onSelectStart} />)
    expect(onSelectStart).toHaveBeenCalledWith(null)

    onSelectStart.mockClear()
    rerender(<AvailabilityCalendar {...props} month={OCTOBER} selectedStart={SLOT_0900} durationMinutes={90} onSelectStart={onSelectStart} />)
    expect(onSelectStart).toHaveBeenCalledWith(null)

    onSelectStart.mockClear()
    rerender(<AvailabilityCalendar {...props} selectedStart={SLOT_0900} durationMinutes={60} onSelectStart={onSelectStart} />)
    fireEvent.click(screen.getByRole('gridcell', { name: /Wednesday, October 21, 2026/ }))
    expect(onSelectStart).toHaveBeenCalledWith(null)
  })

  it('disables every time button when booking is paused', () => {
    renderCalendar({ selectedStart: SLOT_0900, disabled: true })

    expect((screen.getByRole('button', { name: '9:00 AM, 1 hr session' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('gridcell', { name: /Tuesday, October 20, 2026/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})
