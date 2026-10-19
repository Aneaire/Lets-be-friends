// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookingCompletionAction } from '../../src/features/booking/BookingCompletionAction'

const toastWarning = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({ toast: { warning: toastWarning } }))

afterEach(() => {
  cleanup()
  toastWarning.mockClear()
})

// A session that ended two hours ago, so the completion call reaches the server.
const endedSession = { requestedAt: Date.now() - 2 * 60 * 60 * 1000, durationMinutes: 60 }

function renderAction(onComplete: () => Promise<void>, schedule = endedSession) {
  return render(<BookingCompletionAction onComplete={onComplete} {...schedule} />)
}

describe('BookingCompletionAction', () => {
  it('shows a concise, visible error and re-enables the button when completion is rejected', async () => {
    const onComplete = vi.fn(() => Promise.reject(new Error(
      '[CONVEX M(bookings:markCompleted)] [Request ID: c5b4ed1b6a010a1f] Server Error Uncaught Error: Booking cannot be completed before the scheduled session ends at handler (../../convex/bookings.ts:401:27) Called by client',
    )))
    renderAction(onComplete)

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Booking cannot be completed before the scheduled session ends')
    expect(alert.textContent).not.toMatch(/CONVEX|Request ID|bookings\.ts/)
    expect(screen.getByRole('button', { name: 'Confirm completion' }).hasAttribute('disabled')).toBe(false)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('disables the button while pending and ignores duplicate submissions', async () => {
    let resolveCompletion!: () => void
    const onComplete = vi.fn(() => new Promise<void>((resolve) => {
      resolveCompletion = resolve
    }))
    renderAction(onComplete)

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))
    const pending = screen.getByRole('button', { name: /Confirming completion/ })
    expect(pending.hasAttribute('disabled')).toBe(true)
    expect(pending.getAttribute('aria-busy')).toBe('true')

    fireEvent.click(pending)
    expect(onComplete).toHaveBeenCalledTimes(1)

    await act(async () => resolveCompletion())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm completion' })).toBeTruthy())
  })

  it('clears a stale error when a new attempt starts and leaves the success state clean', async () => {
    let resolveRetry!: () => void
    const onComplete = vi.fn()
      .mockRejectedValueOnce(new Error('Uncaught Error: Booking cannot be completed before the scheduled session ends at handler (a) Called by client'))
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        resolveRetry = resolve
      }))
    renderAction(onComplete)

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Booking cannot be completed before the scheduled session ends')

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: /Confirming completion/ })).toBeTruthy()

    await act(async () => resolveRetry())

    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm completion' })).toBeTruthy())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onComplete).toHaveBeenCalledTimes(2)
  })

  it('retries successfully after an early-completion rejection and removes the error', async () => {
    const onComplete = vi.fn()
      .mockRejectedValueOnce(new Error('Uncaught Error: Booking cannot be completed before the scheduled session ends at handler (a) Called by client'))
      .mockResolvedValueOnce(undefined)
    renderAction(onComplete)

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))
    expect(await screen.findByRole('alert')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(onComplete).toHaveBeenCalledTimes(2)
  })

  it('tells the viewer the session is not done yet instead of asking the server', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    renderAction(onComplete, { requestedAt: Date.now() + 60 * 60 * 1000, durationMinutes: 60 })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))

    expect(onComplete).not.toHaveBeenCalled()
    expect(toastWarning).toHaveBeenCalledTimes(1)
    expect(toastWarning.mock.calls[0][0]).toMatch(/^Your session is not done yet\. You can confirm completion after \d/)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Confirm completion' }).hasAttribute('disabled')).toBe(false)
  })

  it('keeps the wait toast while the session is running and clears it once the session ends', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    const requestedAt = Date.now() + 30 * 60 * 1000
    const { rerender } = render(
      <BookingCompletionAction onComplete={onComplete} requestedAt={requestedAt} durationMinutes={60} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))
    expect(toastWarning).toHaveBeenCalledTimes(1)

    rerender(
      <BookingCompletionAction onComplete={onComplete} requestedAt={requestedAt - 2 * 60 * 60 * 1000} durationMinutes={60} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(toastWarning).toHaveBeenCalledTimes(1)
  })

  it('defers to the server when the stored schedule cannot be read', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    renderAction(onComplete, { requestedAt: Number.NaN, durationMinutes: 0 })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(toastWarning).not.toHaveBeenCalled()
  })
})
