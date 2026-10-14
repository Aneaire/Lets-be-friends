// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentTermsVersion } from '../../src/lib/onboarding'

const state = vi.hoisted(() => ({
  viewer: undefined as Record<string, unknown> | null | undefined,
  latest: null as unknown,
  application: null as unknown,
  availability: undefined as unknown,
  updateProfile: vi.fn(async () => undefined),
  claimUsername: vi.fn(async () => 'maya'),
  saveLocation: vi.fn(async () => undefined),
  submitCompanionProfile: vi.fn(async () => undefined),
  completeOnboarding: vi.fn(async () => undefined),
  navigate: vi.fn(async () => undefined),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: {
      viewer: 'users.viewer',
      latestMemberVerification: 'users.latestMemberVerification',
      usernameAvailability: 'users.usernameAvailability',
      updateProfile: 'users.updateProfile',
      claimUsername: 'users.claimUsername',
      saveOnboardingLocationAndConsent: 'users.saveOnboardingLocationAndConsent',
      completeOnboarding: 'users.completeOnboarding',
    },
    companions: { myApplication: 'companions.myApplication', submitApplication: 'companions.submitApplication' },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => {
    if (query === 'users.viewer') return state.viewer
    if (query === 'users.latestMemberVerification') return state.latest
    if (query === 'users.usernameAvailability') return state.availability
    if (query === 'companions.myApplication') return state.application
    return undefined
  },
  useMutation: (mutation: string) => {
    if (mutation === 'users.updateProfile') return state.updateProfile
    if (mutation === 'users.claimUsername') return state.claimUsername
    if (mutation === 'users.saveOnboardingLocationAndConsent') return state.saveLocation
    if (mutation === 'companions.submitApplication') return state.submitCompanionProfile
    if (mutation === 'users.completeOnboarding') return state.completeOnboarding
    return vi.fn(async () => undefined)
  },
}))

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ isSignedIn: true }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  useNavigate: () => state.navigate,
}))

vi.mock('../../src/features/identity/IdentityVerificationFlow', () => ({
  useIdentityVerification: () => ({ begin: vi.fn(async () => ({ mode: 'return' })), busy: false, message: '', error: '' }),
}))

vi.mock('../../src/design-system/organisms/ApproximateLocationMap', () => ({
  ApproximateLocationMap: () => <div data-testid="approx-map" />,
}))

import { OnboardingPage } from '../../src/routes/onboarding'

afterEach(cleanup)

beforeEach(() => {
  state.viewer = {
    username: 'maya',
    displayName: 'Maya Santos',
    firstName: 'Maya',
    lastName: 'Santos',
    bio: '',
    onboardingCategories: [],
    onboardingGoal: 'member',
    approximateLatitude: 15.145,
    approximateLongitude: 120.585,
    approximateLocationConsentedAt: 1,
    termsAcceptedAt: 1,
    termsVersion: currentTermsVersion,
    verificationStatus: 'not_started',
    identityEligible: false,
    onboardingCompletedAt: undefined,
  }
  state.latest = null
  state.application = null
  state.availability = undefined
  state.updateProfile.mockClear()
  state.saveLocation.mockClear()
  state.submitCompanionProfile.mockClear()
})

describe('onboarding route', () => {
  it('uses design-system fields with controlled values on the profile step', async () => {
    render(<OnboardingPage />)

    const saveUsername = screen.getByRole('button', { name: 'Save and continue' })
    await waitFor(() => expect((saveUsername as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(saveUsername)

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))

    const firstName = screen.getByLabelText('First name') as HTMLInputElement
    const lastName = screen.getByLabelText('Last name') as HTMLInputElement
    const bio = screen.getByLabelText(/Bio/) as HTMLTextAreaElement
    expect(firstName.value).toBe('Maya')
    expect(lastName.value).toBe('Santos')

    fireEvent.change(firstName, { target: { value: 'Maya Rose' } })
    fireEvent.change(bio, { target: { value: 'I like unhurried errands.' } })
    expect(firstName.value).toBe('Maya Rose')
    expect(bio.value).toBe('I like unhurried errands.')
  })

  it('announces a validation error with an inline notice and stays on the profile step', async () => {
    render(<OnboardingPage />)

    const saveUsername = screen.getByRole('button', { name: 'Save and continue' })
    await waitFor(() => expect((saveUsername as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(saveUsername)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Enter your first and last name.')
    expect(state.updateProfile).not.toHaveBeenCalled()
    expect(screen.getByLabelText('First name')).toBeTruthy()
  })

  it('saves the profile and advances to the journey step', async () => {
    render(<OnboardingPage />)

    const saveUsername = screen.getByRole('button', { name: 'Save and continue' })
    await waitFor(() => expect((saveUsername as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(saveUsername)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: 'I can help you practice a new language.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledOnce())
    expect(await screen.findByText('What happens before you meet.')).toBeTruthy()
  })

  it('collects the full Companion profile on the Companion step and submits it before identity', async () => {
    state.viewer = { ...state.viewer, onboardingGoal: 'companion', onboardingCategories: ['Good company'] }
    render(<OnboardingPage />)

    const saveUsername = screen.getByRole('button', { name: 'Save and continue' })
    await waitFor(() => expect((saveUsername as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(saveUsername)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))

    expect(screen.queryByLabelText(/Bio/)).toBeNull()
    expect(screen.queryByText(/What would you like to offer/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))

    const bio = await screen.findByLabelText(/Tell me about yourself/) as HTMLTextAreaElement
    fireEvent.change(bio, { target: { value: 'I like helping neighbors.' } })
    const skills = await screen.findByLabelText(/What work or skills could you share/) as HTMLTextAreaElement
    fireEvent.change(skills, { target: { value: 'I can teach guitar and help with everyday errands.' } })
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Bacolor' } })
    expect(skills.value).toBe('I can teach guitar and help with everyday errands.')

    fireEvent.click(screen.getByRole('button', { name: 'Save and verify identity' }))

    await waitFor(() => expect(state.submitCompanionProfile).toHaveBeenCalledWith(expect.objectContaining({
      intro: 'I can teach guitar and help with everyday errands.',
      city: 'Bacolor',
      bio: 'I like helping neighbors.',
      categories: ['Good company'],
      mode: 'both',
      hourlyRateCentavos: 50_000,
    })))
    await waitFor(() => expect(state.completeOnboarding).toHaveBeenCalledWith({ goal: 'companion' }))
  })
})
