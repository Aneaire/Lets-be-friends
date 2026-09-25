// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentTermsVersion } from '../../src/lib/onboarding'

const state = vi.hoisted(() => ({
  identity: { begin: vi.fn(async () => ({ mode: 'launch' })), busy: false, message: '', error: '' },
  viewer: undefined as Record<string, unknown> | null | undefined,
  application: null as unknown,
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: {
      viewer: 'users.viewer',
      latestMemberVerification: 'users.latestMemberVerification',
      saveOnboardingLocationAndConsent: 'users.saveOnboardingLocationAndConsent',
    },
    companions: { myApplication: 'companions.myApplication', submitApplication: 'companions.submitApplication' },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => {
    if (query === 'users.viewer') return state.viewer
    if (query === 'users.latestMemberVerification') return null
    if (query === 'companions.myApplication') return state.application
    return undefined
  },
  useMutation: () => vi.fn(async () => undefined),
}))

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ isSignedIn: true, userId: 'user-1' }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({ ...options, useSearch: () => ({}) }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
}))

vi.mock('../../src/features/identity/IdentityVerificationFlow', () => ({
  useIdentityVerification: () => state.identity,
}))

vi.mock('../../src/design-system/organisms/ApproximateLocationMap', () => ({
  ApproximateLocationMap: () => <div data-testid="approx-map" />,
}))

vi.mock('../../src/features/companion-application/ActivityCategoryPicker', () => ({
  ActivityCategoryPicker: () => <div data-testid="category-picker" />,
}))

import { BecomeCompanionPage } from '../../src/routes/become-companion'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

beforeEach(() => {
  state.identity = { begin: vi.fn(async () => ({ mode: 'launch' })), busy: false, message: '', error: '' }
  state.application = null
  state.viewer = {
    displayName: 'Maya Santos',
    identityEligible: true,
    verificationStatus: 'approved',
    approximateLatitude: 15.145,
    approximateLongitude: 120.585,
    termsAcceptedAt: 1,
    termsVersion: currentTermsVersion,
    bio: 'I like unhurried errands.',
    onboardingCategories: [],
  }
})

describe('become-companion route', () => {
  it('renders the editor with design-system inputs bound to controlled state', () => {
    render(<BecomeCompanionPage />)

    const rate = screen.getByLabelText(/Listed hourly rate/) as HTMLInputElement
    expect(rate.value).toBe('500')
    expect(rate.type).toBe('number')

    const intro = screen.getByLabelText(/How would you like to spend time with members/) as HTMLTextAreaElement
    fireEvent.change(intro, { target: { value: 'I can help with a calm grocery run and explain everyday technology.' } })
    expect(intro.value).toBe('I can help with a calm grocery run and explain everyday technology.')

    expect((screen.getByLabelText(/Why do you want to earn/) as HTMLTextAreaElement).required).toBe(true)
  })

  it('keeps the bespoke session-format pressed-state contract', () => {
    render(<BecomeCompanionPage />)

    const both = screen.getByRole('button', { name: 'Online and in-person' })
    const onlineOnly = screen.getByRole('button', { name: 'Online only' })
    expect(both.getAttribute('aria-pressed')).toBe('true')
    expect(onlineOnly.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(onlineOnly)
    expect(onlineOnly.getAttribute('aria-pressed')).toBe('true')
    expect(both.getAttribute('aria-pressed')).toBe('false')
  })

  it('surfaces identity errors through the inline notice alert', () => {
    state.identity = { ...state.identity, error: 'Identity verification could not be started.' }
    render(<BecomeCompanionPage />)

    expect(screen.getByRole('alert').textContent).toContain('Identity verification could not be started.')
  })
})
