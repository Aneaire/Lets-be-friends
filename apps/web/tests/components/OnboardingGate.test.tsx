// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const gateState = vi.hoisted(() => {
  const pending: Array<(value: unknown) => void> = []
  return {
    ensureViewer: vi.fn(() => new Promise((resolve) => {
      pending.push(resolve as (value: unknown) => void)
    })),
    resolveProvision: () => {
      pending.splice(0).forEach((resolve) => resolve(undefined))
    },
    signOut: vi.fn(),
  }
})

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: 'clerk-1' }),
  useClerk: () => ({ signOut: gateState.signOut }),
  useUser: () => ({ user: { fullName: 'Test Friend' } }),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => gateState.ensureViewer,
  useQuery: () => null,
}))

vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => '/discover',
}))

import {
  ONBOARDING_RECOVERY_DELAY_MS,
  OnboardingGate,
  replaceWithOnboarding,
} from '../../src/features/onboarding/OnboardingGate'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('OnboardingGate account recovery', () => {
  it('loads onboarding directly when the gate redirects an incomplete member', () => {
    const replace = vi.fn()

    replaceWithOnboarding({ replace })

    expect(replace).toHaveBeenCalledWith('/onboarding')
  })

  it('uses a deterministic 15 second wait before offering recovery', () => {
    expect(ONBOARDING_RECOVERY_DELAY_MS).toBe(15_000)
  })

  it('shows retry and reload without signing out after a long provisioning wait', async () => {
    const { container } = render(
      <OnboardingGate>
        <p>Member content</p>
      </OnboardingGate>,
    )

    expect(container.querySelector('img[src="/logo.svg"]')).toBeTruthy()
    expect(container.querySelector('.gate-state-loading-status .ds-spinner')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Getting things ready' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Preparing your account...')
    expect(screen.getByText('Preparing your account...')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry account setup' })).toBeNull()

    act(() => {
      vi.advanceTimersByTime(ONBOARDING_RECOVERY_DELAY_MS)
    })

    expect(screen.getByText(/taking longer than expected/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()

    // Let the first attempt settle, wait out the restarted recovery timer,
    // then retry: a fresh attempt starts only after the previous one settled.
    await act(async () => {
      gateState.resolveProvision()
    })
    act(() => {
      vi.advanceTimersByTime(ONBOARDING_RECOVERY_DELAY_MS)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Retry account setup' }))
    expect(gateState.ensureViewer).toHaveBeenCalledTimes(2)
    expect(gateState.signOut).not.toHaveBeenCalled()
  })

  it('keeps automatic and manual retries single-flight while provisioning is pending', () => {
    render(
      <OnboardingGate>
        <p>Member content</p>
      </OnboardingGate>,
    )

    // Mount triggers the automatic attempt exactly once.
    expect(gateState.ensureViewer).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(ONBOARDING_RECOVERY_DELAY_MS)
    })

    const retry = screen.getByRole('button', { name: 'Retry account setup' })
    // A double-clicked retry joins the in-flight attempt instead of starting
    // concurrent account setup calls.
    fireEvent.click(retry)
    fireEvent.click(retry)
    expect(gateState.ensureViewer).toHaveBeenCalledTimes(1)
    expect(gateState.signOut).not.toHaveBeenCalled()
  })
})
