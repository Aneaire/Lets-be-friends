// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationPreferencesView } from '../../src/features/settings/notificationPreferences'

const state = vi.hoisted(() => ({
  preferences: null as unknown as NotificationPreferencesView,
  update: vi.fn(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    notificationPreferences: {
      mine: 'notificationPreferences.mine',
      update: 'notificationPreferences.update',
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => query === 'notificationPreferences.mine' ? state.preferences : undefined,
  useMutation: () => state.update,
}))

vi.mock('../../src/features/settings/notificationPreferences', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/settings/notificationPreferences')>()
  return { ...actual, resolveBrowserTimeZone: () => 'Asia/Manila' }
})

import { NotificationPreferencesSection } from '../../src/features/settings/NotificationPreferencesSection'

const storedPreferences: NotificationPreferencesView = {
  socialReactions: true,
  socialComments: true,
  socialFollows: true,
  circleActivity: true,
  quietHoursEnabled: true,
  quietHoursStartMinute: 1320,
  quietHoursEndMinute: 420,
  timeZone: 'Asia/Manila',
  digestEnabled: false,
  digestHourMinute: 1080,
}

function deferred() {
  let resolve!: () => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

afterEach(cleanup)

beforeEach(() => {
  state.preferences = { ...storedPreferences }
  state.update.mockReset()
})

describe('notification preferences section', () => {
  it('lists every social category with an accessible switch and the always delivered notice', () => {
    render(<NotificationPreferencesSection />)

    expect(screen.getByRole('region', { name: 'Notifications' })).toBeTruthy()
    for (const name of ['Reactions', 'Comments and replies', 'New followers', 'Circle activity', 'Quiet hours']) {
      expect(screen.getByRole('switch', { name }).getAttribute('aria-checked')).toBe('true')
    }
    expect(screen.getByRole('switch', { name: 'Daily digest' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('Bookings, messages, and safety notices are always delivered. You cannot turn them off here.')).toBeTruthy()
    expect((screen.getByLabelText('Quiet hours start time') as HTMLInputElement).value).toBe('22:00')
    expect((screen.getByLabelText('Quiet hours end time') as HTMLInputElement).value).toBe('07:00')
    expect((screen.getByLabelText('Daily digest time') as HTMLInputElement).disabled).toBe(true)
  })

  it('turns off one category, disables that control while saving, and keeps the new value', async () => {
    const save = deferred()
    state.update.mockReturnValueOnce(save.promise)
    render(<NotificationPreferencesSection />)

    const reactions = screen.getByRole('switch', { name: 'Reactions' })
    fireEvent.click(reactions)

    expect(state.update).toHaveBeenCalledWith({ socialReactions: false })
    expect(reactions.getAttribute('aria-checked')).toBe('false')
    expect((reactions as HTMLButtonElement).disabled).toBe(true)

    save.resolve()
    await waitFor(() => expect((reactions as HTMLButtonElement).disabled).toBe(false))
    expect(reactions.getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('restores the previous value and shows one inline error when saving fails', async () => {
    state.update.mockRejectedValueOnce(new Error('Notification settings are unavailable.'))
    render(<NotificationPreferencesSection />)

    const reactions = screen.getByRole('switch', { name: 'Reactions' })
    fireEvent.click(reactions)

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Notification settings are unavailable.'))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(reactions.getAttribute('aria-checked')).toBe('true')
  })

  it('stores a changed quiet hours time as a minute of day and keeps the previous value on failure', async () => {
    const save = deferred()
    state.update.mockReturnValueOnce(save.promise)
    render(<NotificationPreferencesSection />)

    const start = screen.getByLabelText('Quiet hours start time')
    fireEvent.change(start, { target: { value: '21:30' } })

    expect(state.update).toHaveBeenCalledWith({ quietHoursStartMinute: 1290 })
    expect((start as HTMLInputElement).value).toBe('21:30')

    save.reject(new Error('The quiet hours window could not be saved.'))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect((start as HTMLInputElement).value).toBe('22:00')
  })

  it('turns on the daily digest and saves its digest time', async () => {
    state.update.mockResolvedValue(undefined)
    render(<NotificationPreferencesSection />)

    fireEvent.click(screen.getByRole('switch', { name: 'Daily digest' }))
    expect(state.update).toHaveBeenCalledWith({ digestEnabled: true })

    await waitFor(() => expect((screen.getByLabelText('Daily digest time') as HTMLInputElement).disabled).toBe(false))
    fireEvent.change(screen.getByLabelText('Daily digest time'), { target: { value: '08:15' } })
    expect(state.update).toHaveBeenCalledWith({ digestHourMinute: 495 })
  })

  it('sends the browser time zone once on load only when it differs from the stored zone', async () => {
    state.preferences = { ...storedPreferences, timeZone: 'UTC' }
    state.update.mockResolvedValue(undefined)
    const { rerender } = render(<NotificationPreferencesSection />)

    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ timeZone: 'Asia/Manila' }))
    rerender(<NotificationPreferencesSection />)
    expect(state.update).toHaveBeenCalledTimes(1)
  })

  it('does not send the browser time zone when it already matches', async () => {
    state.update.mockResolvedValue(undefined)
    render(<NotificationPreferencesSection />)

    await waitFor(() => expect(screen.getByRole('region', { name: 'Notifications' })).toBeTruthy())
    expect(state.update).not.toHaveBeenCalled()
  })
})
