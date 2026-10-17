// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BookingAvailabilityPicker } from '../../src/features/scheduling/BookingAvailabilityPicker'

const state = vi.hoisted(() => ({
  data: undefined as unknown,
  calls: [] as Array<{ companionProfileId?: string; month?: string; durationMinutes?: number } | 'skip'>,
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    bookings: { availableSlots: 'bookings.availableSlots' },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (_query: unknown, args: { companionProfileId?: string; month?: string; durationMinutes?: number } | 'skip') => {
    state.calls.push(args)
    return state.data
  },
}))

const NOW = Date.UTC(2026, 9, 15, 2, 0)
const SLOT_0900 = Date.UTC(2026, 9, 20, 1, 0)
const SLOT_1030 = Date.UTC(2026, 9, 20, 2, 30)

const availableData = {
  timezone: 'Asia/Manila',
  scheduleConfigured: true,
  days: [{ date: '2026-10-20', startsAt: [SLOT_0900, SLOT_1030] }],
}

beforeEach(() => {
  state.data = availableData
  state.calls = []
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderPicker(overrides: Partial<React.ComponentProps<typeof BookingAvailabilityPicker>> = {}) {
  const props: React.ComponentProps<typeof BookingAvailabilityPicker> = {
    companionProfileId: 'companion-1',
    durationMinutes: 60,
    selectedStart: null,
    onSelectStart: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<BookingAvailabilityPicker {...props} />) }
}

describe('BookingAvailabilityPicker', () => {
  it('queries the current Manila month and delegates slot selection to the pure calendar', () => {
    const { props } = renderPicker()

    expect(state.calls.at(-1)).toEqual({
      companionProfileId: 'companion-1',
      month: '2026-10',
      durationMinutes: 60,
    })
    fireEvent.click(screen.getByRole('gridcell', { name: /Tuesday, October 20, 2026/ }))
    fireEvent.click(screen.getByRole('button', { name: '9:00 AM, 1 hr session' }))
    expect(props.onSelectStart).toHaveBeenCalledWith(SLOT_0900)
  })

  it('queries the next month and clears the previous start', () => {
    const onSelectStart = vi.fn()
    renderPicker({ selectedStart: SLOT_0900, onSelectStart })

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))

    expect(state.calls.some((args) => args !== 'skip' && args.month === '2026-11')).toBe(true)
    expect(onSelectStart).toHaveBeenCalledWith(null)
  })

  it('clears a valid selection when the Companion changes', () => {
    const onSelectStart = vi.fn()
    const { props, rerender } = renderPicker({ selectedStart: SLOT_0900, onSelectStart })

    rerender(<BookingAvailabilityPicker {...props} companionProfileId="companion-2" selectedStart={SLOT_0900} onSelectStart={onSelectStart} />)

    expect(onSelectStart).toHaveBeenCalledWith(null)
  })

  it('clears a valid selection when the session duration changes', () => {
    const onSelectStart = vi.fn()
    const { props, rerender } = renderPicker({ selectedStart: SLOT_0900, onSelectStart })

    rerender(<BookingAvailabilityPicker {...props} durationMinutes={90} selectedStart={SLOT_0900} onSelectStart={onSelectStart} />)

    expect(onSelectStart).toHaveBeenCalledWith(null)
  })

  it('clears a stale selection after returned slot data changes', async () => {
    const onSelectStart = vi.fn()
    const { props, rerender } = renderPicker({ selectedStart: SLOT_1030, onSelectStart })
    expect(onSelectStart).not.toHaveBeenCalled()

    state.data = {
      ...availableData,
      days: [{ date: '2026-10-20', startsAt: [SLOT_0900] }],
    }
    rerender(<BookingAvailabilityPicker {...props} selectedStart={SLOT_1030} onSelectStart={onSelectStart} />)

    await waitFor(() => expect(onSelectStart).toHaveBeenCalledWith(null))
  })

  it('keeps a selection that is still present in the returned slots', () => {
    const onSelectStart = vi.fn()
    renderPicker({ selectedStart: SLOT_0900, onSelectStart })

    expect(onSelectStart).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '9:00 AM, 1 hr session' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows the loading state through the calendar and skips the query without a Companion', () => {
    state.data = undefined
    renderPicker({ companionProfileId: '' })

    expect(state.calls.at(-1)).toBe('skip')
    expect(screen.getByRole('status').textContent).toContain('Loading available times')
  })

  it('passes disabled through to the calendar', () => {
    renderPicker({ selectedStart: SLOT_0900, disabled: true })

    expect((screen.getByRole('button', { name: 'Next month' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '9:00 AM, 1 hr session' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
