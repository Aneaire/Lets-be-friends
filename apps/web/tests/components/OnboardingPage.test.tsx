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

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window.navigator, 'geolocation')
})

function acceptedViewer(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'user-test',
    username: 'maya',
    displayName: 'Maya Santos',
    firstName: 'Maya',
    lastName: 'Santos',
    bio: 'I like unhurried errands.',
    onboardingCategories: [],
    onboardingGoal: 'member',
    approximateLatitude: 15.14,
    approximateLongitude: 120.58,
    approximateLocationConsentedAt: 1,
    termsAcceptedAt: 1,
    termsVersion: currentTermsVersion,
    privacyPolicyAcceptedAt: 1,
    privacyPolicyVersion: currentTermsVersion,
    identityConsentAcceptedAt: 1,
    identityConsentVersion: currentTermsVersion,
    verificationStatus: 'not_started',
    identityEligible: false,
    onboardingCompletedAt: undefined,
    ...overrides,
  }
}

function unacceptedViewer(overrides: Record<string, unknown> = {}) {
  return acceptedViewer({
    approximateLocationConsentedAt: undefined,
    termsAcceptedAt: undefined,
    termsVersion: undefined,
    privacyPolicyAcceptedAt: undefined,
    privacyPolicyVersion: undefined,
    identityConsentAcceptedAt: undefined,
    identityConsentVersion: undefined,
    ...overrides,
  })
}

beforeEach(() => {
  state.viewer = acceptedViewer()
  state.latest = null
  state.application = null
  state.availability = undefined
  state.updateProfile.mockClear()
  state.claimUsername.mockClear()
  state.saveLocation.mockClear()
  state.submitCompanionProfile.mockClear()
  state.completeOnboarding.mockClear()
  state.navigate.mockClear()
})

async function goToStep5Member() {
  render(<OnboardingPage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maya' } })
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Santos' } })
  fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: 'I can help you practice a new language.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
  await screen.findByText('Review and accept to finish.')
}

function checkBothBoxes() {
  fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }))
}

describe('onboarding route', () => {
  it('keeps Back and Continue on one row with no skip control', async () => {
    state.viewer = unacceptedViewer()
    render(<OnboardingPage />)

    const stepOne = screen.getByRole('button', { name: 'Continue' })
    await waitFor(() => expect((stepOne as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
    fireEvent.click(stepOne)
    await screen.findByText('What would you like to do here?')

    const row = document.querySelector('.onboarding-actions-row')
    const back = screen.getByRole('button', { name: 'Back to the previous step' })
    const primary = screen.getByRole('button', { name: 'Continue' })
    expect(row).toBeTruthy()
    expect(back.textContent).toBe('')
    expect(row!.contains(back)).toBe(true)
    expect(row!.contains(primary)).toBe(true)
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
  })

  it('shows no back or skip control on the first step', () => {
    render(<OnboardingPage />)
    expect(screen.queryByRole('button', { name: 'Back to the previous step' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
  })

  it('keeps Step 1 free of policy checkboxes and defers location persistence until Step 5', async () => {
    state.viewer = acceptedViewer({ username: undefined, approximateLatitude: undefined, approximateLongitude: undefined })
    render(<OnboardingPage />)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByText(/Nothing is saved until Step 5/i)).toBeTruthy()
    const getCurrentPosition = vi.fn((success: (position: { coords: { latitude: number; longitude: number } }) => void) => {
      success({ coords: { latitude: 15.1456789, longitude: 120.5851234 } })
    })
    Object.defineProperty(window.navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })
    fireEvent.click(screen.getByRole('button', { name: 'Use device location' }))
    expect(await screen.findByText(/Only the two-decimal rounded result will be saved in Step 5/i)).toBeTruthy()
    expect(state.saveLocation).not.toHaveBeenCalled()
    expect(state.claimUsername).not.toHaveBeenCalled()
  })

  it('applies the rounded device location immediately without a confirmation step', async () => {
    const getCurrentPosition = vi.fn((success: (position: { coords: { latitude: number; longitude: number } }) => void) => {
      success({ coords: { latitude: 15.1456789, longitude: 120.5851234 } })
    })
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })

    render(<OnboardingPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Use device location' }))

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Device location applied to this preview. Only the two-decimal rounded result will be saved in Step 5.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Apply rounded location' })).toBeNull()
  })

  it('uses design-system fields with controlled values on the profile step', async () => {
    state.viewer = unacceptedViewer()
    render(<OnboardingPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
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
    state.viewer = unacceptedViewer()
    render(<OnboardingPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Enter your first and last name.')
    expect(state.updateProfile).not.toHaveBeenCalled()
    expect(screen.getByLabelText('First name')).toBeTruthy()
  })

  it('saves the profile and advances to the journey step', async () => {
    state.viewer = unacceptedViewer()
    render(<OnboardingPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: 'I can help you practice a new language.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))

    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledOnce())
    expect(await screen.findByText('What happens before you meet.')).toBeTruthy()
  })

  it('shows two independent unchecked boxes with document links on Step 5 for new accounts', async () => {
    state.viewer = unacceptedViewer()
    await goToStep5Member()
    const termsBox = screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }) as HTMLInputElement
    const privacyBox = screen.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }) as HTMLInputElement
    expect(termsBox.checked).toBe(false)
    expect(privacyBox.checked).toBe(false)

    const termsLink = screen.getByRole('link', { name: 'Terms and Conditions' })
    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' })
    expect(termsLink.getAttribute('href')).toBe('/terms-and-conditions')
    expect(termsLink.getAttribute('target')).toBe('_blank')
    expect(termsLink.getAttribute('rel')).toContain('noopener')
    expect(privacyLink.getAttribute('href')).toBe('/privacy-policy')
    expect(privacyLink.getAttribute('target')).toBe('_blank')

    fireEvent.click(termsLink)
    expect(termsBox.checked).toBe(false)
    expect(screen.queryByText(/rounded approximate location is stored/i)).toBeNull()
    expect(screen.queryByText(/for as long as your account exists/i)).toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(2)
  })

  it('requires both boxes in either order and re-disables when either is unchecked', async () => {
    state.viewer = unacceptedViewer()
    await goToStep5Member()
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
    const finishButton = screen.getByRole('button', { name: 'Verify identity' }) as HTMLButtonElement
    expect(finishButton.disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }))
    expect(finishButton.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
    expect(state.saveLocation).not.toHaveBeenCalled()
    expect(state.completeOnboarding).not.toHaveBeenCalled()
    expect(state.navigate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }))
    await waitFor(() => expect(finishButton.disabled).toBe(false))
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()

    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }))
    await waitFor(() => expect(finishButton.disabled).toBe(true))
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
    expect(state.saveLocation).not.toHaveBeenCalled()
    expect(state.completeOnboarding).not.toHaveBeenCalled()
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('shows no checkbox and a remembered notice for already accepted accounts', async () => {
    await goToStep5Member()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByText(/already accepted the current Terms/i)).toBeTruthy()
    const finishButton = screen.getByRole('button', { name: 'Verify identity' }) as HTMLButtonElement
    expect(finishButton.disabled).toBe(false)
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
  })

  it('lands completed legacy accounts directly on the final review', async () => {
    state.viewer = acceptedViewer({
      onboardingCompletedAt: 1,
      termsVersion: '2026-08-13',
      privacyPolicyVersion: undefined,
      identityConsentVersion: undefined,
      privacyPolicyAcceptedAt: undefined,
      identityConsentAcceptedAt: undefined,
    })
    render(<OnboardingPage />)
    await screen.findByText('Review and accept to finish.')
    expect(screen.queryByText('Choose your unique username.')).toBeNull()
    expect((screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }) as HTMLInputElement).checked).toBe(false)
  })

  it('guards Step 5 finishing actions until both boxes are checked and saves before completing', async () => {
    state.viewer = unacceptedViewer()
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maya' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Santos' } })
    fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: 'I can help you practice a new language.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await screen.findByText('Review and accept to finish.')

    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
    const finishButton = screen.getByRole('button', { name: 'Verify identity' }) as HTMLButtonElement
    expect(finishButton.disabled).toBe(true)

    checkBothBoxes()
    await waitFor(() => expect(finishButton.disabled).toBe(false))
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
    fireEvent.click(finishButton)
    await waitFor(() => expect(state.saveLocation).toHaveBeenCalledWith(expect.objectContaining({
      locationConsent: true,
      termsAccepted: true,
      termsVersion: currentTermsVersion,
      privacyAccepted: true,
      identityAccepted: true,
    })))
    await waitFor(() => expect(state.completeOnboarding).toHaveBeenCalledWith({ goal: 'member' }))
    const saveOrder = state.saveLocation.mock.invocationCallOrder[0]
    const completeOrder = state.completeOnboarding.mock.invocationCallOrder[0]
    expect(saveOrder).toBeLessThan(completeOrder)
  })

  it('never shows a skip control for unchecked, single, both, or remembered acceptance', async () => {
    state.viewer = unacceptedViewer()
    await goToStep5Member()
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }))
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }))
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
    cleanup()
    state.viewer = acceptedViewer()
    state.saveLocation.mockClear()
    state.completeOnboarding.mockClear()
    state.navigate.mockClear()
    await goToStep5Member()
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
  })

  it('labels the final approved member action Finish setup and navigates to /app after saving', async () => {
    state.viewer = unacceptedViewer({ verificationStatus: 'approved', identityEligible: true })
    await goToStep5Member()
    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
    const finishButton = screen.getByRole('button', { name: 'Finish setup' }) as HTMLButtonElement
    expect(screen.queryByRole('button', { name: 'Open bookings' })).toBeNull()
    expect(finishButton.disabled).toBe(true)
    checkBothBoxes()
    await waitFor(() => expect(finishButton.disabled).toBe(false))
    fireEvent.click(finishButton)
    await waitFor(() => expect(state.saveLocation).toHaveBeenCalled())
    await waitFor(() => expect(state.completeOnboarding).toHaveBeenCalledWith({ goal: 'member' }))
    const saveOrder = state.saveLocation.mock.invocationCallOrder[0]
    const completeOrder = state.completeOnboarding.mock.invocationCallOrder[0]
    expect(saveOrder).toBeLessThan(completeOrder)
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: '/app' }))
  })

  it('blocks completion when the acceptance save fails and supports retry', async () => {
    state.viewer = unacceptedViewer()
    state.saveLocation.mockRejectedValueOnce(new Error('Network error'))
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maya' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Santos' } })
    fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: 'I can help you practice a new language.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await screen.findByText('Review and accept to finish.')

    checkBothBoxes()
    const finishButton = await screen.findByRole('button', { name: 'Verify identity' })
    fireEvent.click(finishButton)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(state.completeOnboarding).not.toHaveBeenCalled()
    expect(state.navigate).not.toHaveBeenCalled()

    state.saveLocation.mockReset()
    state.saveLocation.mockImplementation(async () => undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }))
    await waitFor(() => expect(state.completeOnboarding).toHaveBeenCalledWith({ goal: 'member' }))
  })

  it('does not precheck new acceptance from legacy Terms', async () => {
    state.viewer = acceptedViewer({
      termsVersion: '2026-08-13',
      privacyPolicyVersion: undefined,
      identityConsentVersion: undefined,
      privacyPolicyAcceptedAt: undefined,
      identityConsentAcceptedAt: undefined,
    })
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Maya' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Santos' } })
    fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: 'I can help you practice a new language.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await screen.findByText('Review and accept to finish.')
    expect((screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }) as HTMLInputElement).checked).toBe(false)
  })

  it('collects the full Companion profile on Step 5 and submits it only after both acceptances', async () => {
    state.viewer = unacceptedViewer({
      onboardingGoal: 'companion',
      onboardingCategories: ['Good company'],
    })
    render(<OnboardingPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))

    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    const saveButton = screen.getByRole('button', { name: 'Save and verify identity' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)

    const bio = await screen.findByLabelText(/Tell me about yourself/) as HTMLTextAreaElement
    fireEvent.change(bio, { target: { value: 'I like helping neighbors.' } })
    const skills = await screen.findByLabelText(/What work or skills could you share/) as HTMLTextAreaElement
    fireEvent.change(skills, { target: { value: 'I can teach guitar and help with everyday errands.' } })
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Bacolor' } })
    expect(state.submitCompanionProfile).not.toHaveBeenCalled()

    checkBothBoxes()
    await waitFor(() => expect(saveButton.disabled).toBe(false))
    fireEvent.click(saveButton)

    await waitFor(() => expect(state.saveLocation).toHaveBeenCalled())
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

  it('labels the approved Companion final action as a finishing save', async () => {
    state.viewer = unacceptedViewer({
      onboardingGoal: 'companion',
      onboardingCategories: ['Good company'],
      verificationStatus: 'approved',
      identityEligible: true,
    })
    render(<OnboardingPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))

    expect(screen.queryByRole('button', { name: /Skip for now|Finish and set up later/ })).toBeNull()
    const saveButton = screen.getByRole('button', { name: 'Save Companion profile and finish' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)
    const bio = await screen.findByLabelText(/Tell me about yourself/) as HTMLTextAreaElement
    fireEvent.change(bio, { target: { value: 'I like helping neighbors.' } })
    const skills = await screen.findByLabelText(/What work or skills could you share/) as HTMLTextAreaElement
    fireEvent.change(skills, { target: { value: 'I can teach guitar and help with everyday errands.' } })
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Bacolor' } })
    checkBothBoxes()
    await waitFor(() => expect(saveButton.disabled).toBe(false))
    fireEvent.click(saveButton)
    await waitFor(() => expect(state.saveLocation).toHaveBeenCalled())
    await waitFor(() => expect(state.submitCompanionProfile).toHaveBeenCalled())
    await waitFor(() => expect(state.completeOnboarding).toHaveBeenCalledWith({ goal: 'companion' }))
    expect(state.navigate).toHaveBeenCalled()
  })

  it('lets a returning Companion reaccept with Accept and continue without touching the profile', async () => {
    state.viewer = unacceptedViewer({
      onboardingGoal: 'companion',
      onboardingCompletedAt: 1,
      onboardingCategories: ['Good company'],
    })
    render(<OnboardingPage />)
    await screen.findByText('Set up your Companion profile.')
    expect(screen.queryByLabelText(/Tell me about yourself/)).toBeNull()

    const acceptButton = screen.getByRole('button', { name: 'Accept and continue' }) as HTMLButtonElement
    expect(acceptButton.disabled).toBe(true)
    checkBothBoxes()
    await waitFor(() => expect(acceptButton.disabled).toBe(false))
    fireEvent.click(acceptButton)

    await waitFor(() => expect(state.saveLocation).toHaveBeenCalled())
    await waitFor(() => expect(state.completeOnboarding).toHaveBeenCalledWith({ goal: 'companion' }))
    expect(state.submitCompanionProfile).not.toHaveBeenCalled()
  })

  it('resets all per-account state on account switch without leaking the prior draft', async () => {
    state.viewer = unacceptedViewer({ _id: 'user-anna', username: 'anna' })
    const view = render(<OnboardingPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Anna Changed' } })
    fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: 'Anna bio.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await screen.findByText('Review and accept to finish.')
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }))
    expect((screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }) as HTMLInputElement).checked).toBe(true)

    state.viewer = unacceptedViewer({ _id: 'user-bob', username: 'bob' })
    view.rerender(<OnboardingPage />)
    await screen.findByText('Choose your unique username.')
    expect(screen.getByText('@bob')).toBeTruthy()
    expect(screen.queryByText('Anna Changed')).toBeNull()

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Maya')
    fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: 'Bob bio.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await screen.findByText('Review and accept to finish.')
    expect((screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }) as HTMLInputElement).checked).toBe(false)
  })

  it('preserves edits and unchecked boxes on same-account refetch', async () => {
    state.viewer = unacceptedViewer({ _id: 'user-anna', username: 'anna' })
    const view = render(<OnboardingPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Anna Changed' } })
    fireEvent.change(screen.getByLabelText(/Bio/), { target: { value: 'Anna bio.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    await screen.findByText('Review and accept to finish.')
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }))

    state.viewer = unacceptedViewer({ _id: 'user-anna', username: 'anna' })
    view.rerender(<OnboardingPage />)
    await screen.findByText('Review and accept to finish.')
    expect((screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }) as HTMLInputElement).checked).toBe(true)
  })
})
