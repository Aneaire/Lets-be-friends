// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookingCompletionAction } from '../../src/features/booking/BookingCompletionAction'

afterEach(() => {
  cleanup()
})

describe('BookingCompletionAction', () => {
  it('shows a concise, visible error and re-enables the button when completion is rejected', async () => {
    const onComplete = vi.fn(() => Promise.reject(new Error(
      '[CONVEX M(bookings:markCompleted)] [Request ID: c5b4ed1b6a010a1f] Server Error Uncaught Error: Booking cannot be completed before the scheduled session ends at handler (../../convex/bookings.ts:401:27) Called by client',
    )))
    render(<BookingCompletionAction onComplete={onComplete} />)

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
    render(<BookingCompletionAction onComplete={onComplete} />)

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
    render(<BookingCompletionAction onComplete={onComplete} />)

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
    render(<BookingCompletionAction onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))
    expect(await screen.findByRole('alert')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm completion' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(onComplete).toHaveBeenCalledTimes(2)
  })
})
