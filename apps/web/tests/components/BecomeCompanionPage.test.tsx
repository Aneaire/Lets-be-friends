// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentTermsVersion } from '../../src/lib/onboarding'

const state = vi.hoisted(() => ({
  identity: { begin: vi.fn(async () => ({ mode: 'launch' })), busy: false, message: '', error: '' },
  viewer: undefined as Record<string, unknown> | null | undefined,
  application: null as unknown,
  latestVerification: null as unknown,
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: {
      viewer: 'users.viewer',
      latestMemberVerification: 'users.latestMemberVerification',
      saveOnboardingLocationAndConsent: 'users.saveOnboardingLocationAndConsent',
    },
    companions: { myApplication: 'companions.myApplication', submitApplication: 'companions.submitApplication', updateAvailability: 'companions.updateAvailability' },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => {
    if (query === 'users.viewer') return state.viewer
    if (query === 'users.latestMemberVerification') return state.latestVerification
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
  state.latestVerification = null
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
  it('renders the single Companion profile form bound to controlled state', () => {
    render(<BecomeCompanionPage />)

    const rate = screen.getByLabelText(/Listed hourly rate/) as HTMLInputElement
    expect(rate.value).toBe('500')
    expect(rate.type).toBe('number')
    expect(rate.min).toBe('30')
    expect(rate.max).toBe('10000')

    const skills = screen.getByLabelText(/What work or skills could you share/) as HTMLTextAreaElement
    fireEvent.change(skills, { target: { value: 'I can help with a calm grocery run and explain everyday technology.' } })
    expect(skills.value).toBe('I can help with a calm grocery run and explain everyday technology.')
    expect(document.querySelector('.companion-preview-intro')?.textContent).toBe('I can help with a calm grocery run and explain everyday technology.')

    const bio = screen.getByLabelText(/Tell me about yourself/) as HTMLTextAreaElement
    fireEvent.change(bio, { target: { value: 'Weekend cyclist who likes slow coffees.' } })
    expect(bio.value).toBe('Weekend cyclist who likes slow coffees.')

    expect(screen.queryByLabelText(/Why do you want to earn/)).toBeNull()
    expect(screen.getByLabelText(/City/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save availability' })).toBeNull()
  })

  it('prefills the form from an existing Companion profile', () => {
    state.application = {
      _id: 'app-1',
      status: 'pending_review',
      displayName: 'Maya Santos',
      mode: 'online',
      city: 'Cebu City',
      hourlyRateCentavos: 75_000,
      intro: 'I teach guitar and help with everyday errands.',
      bio: 'Member bio.',
      categories: ['Good company'],
    }
    render(<BecomeCompanionPage />)

    const skills = screen.getByLabelText(/What work or skills could you share/) as HTMLTextAreaElement
    expect(skills.value).toBe('I teach guitar and help with everyday errands.')
    expect((screen.getByLabelText(/Listed hourly rate/) as HTMLInputElement).value).toBe('750')
  })

  it('keeps the editor open for a saved approved profile', () => {
    state.application = {
      _id: 'app-1',
      status: 'approved',
      displayName: 'Maya Santos',
      mode: 'both',
      city: 'Cebu City',
      hourlyRateCentavos: 50_000,
      intro: 'I teach guitar and help with everyday errands.',
      bio: 'Member bio.',
      categories: ['Good company'],
    }
    render(<BecomeCompanionPage />)

    expect(screen.queryByText('Your Companion profile is locked')).toBeNull()
    expect(screen.queryByText('Manage in settings')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Monday availability' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save availability' })).toBeTruthy()
    expect(screen.getAllByText('Live in Explore').length).toBeGreaterThan(0)
  })

  it('groups the profile form and availability card in the primary column beside the aside', () => {
    state.application = {
      _id: 'app-1',
      status: 'approved',
      displayName: 'Maya Santos',
      mode: 'both',
      city: 'Cebu City',
      hourlyRateCentavos: 50_000,
      intro: 'I teach guitar and help with everyday errands.',
      bio: 'Member bio.',
      categories: ['Good company'],
    }
    render(<BecomeCompanionPage />)

    const primary = document.querySelector('.companion-editor-primary')
    const form = document.querySelector('.companion-editor-form')
    const availability = document.querySelector('.companion-availability-panel')
    const aside = document.querySelector('.companion-editor-aside')

    expect(primary).not.toBeNull()
    expect(form).not.toBeNull()
    expect(availability).not.toBeNull()
    expect(aside).not.toBeNull()

    // The form and availability card are siblings inside the shared column.
    expect(form?.parentElement).toBe(primary)
    expect(availability?.parentElement).toBe(primary)
    // The aside stays outside the primary column so desktop shows it alongside.
    expect(primary?.contains(form as Node)).toBe(true)
    expect(primary?.contains(availability as Node)).toBe(true)
    expect(primary?.contains(aside as Node)).toBe(false)
  })

  it('renders legacy review statuses in the editor without crashing', () => {
    state.application = {
      _id: 'app-1',
      status: 'pending_review',
      displayName: 'Maya Santos',
      mode: 'online',
      city: 'Cebu City',
      hourlyRateCentavos: 75_000,
      intro: 'I teach guitar and help with everyday errands.',
      bio: 'Member bio.',
      categories: ['Good company'],
    }
    render(<BecomeCompanionPage />)

    expect(screen.queryByText('Your Companion profile is locked')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy()
    expect(screen.getAllByText('Saved').length).toBeGreaterThan(0)
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

  it.each([
    { case: 'new profile', application: null },
    {
      case: 'existing profile',
      application: {
        _id: 'app-1',
        status: 'approved',
        displayName: 'Maya Santos',
        mode: 'both',
        city: 'Cebu City',
        hourlyRateCentavos: 50_000,
        intro: 'I teach guitar and help with everyday errands.',
        bio: 'Member bio.',
        categories: ['Good company'],
      },
    },
  ])('confirms a saved profile for an approved identity without verification follow-ups ($case)', async ({ application }) => {
    state.viewer = {
      ...(state.viewer as Record<string, unknown>),
      identityEligible: true,
      verificationStatus: 'pending',
      onboardingCategories: ['Good company'],
    }
    state.latestVerification = null
    state.application = application
    render(<BecomeCompanionPage />)
    await saveValidCompanionProfile()

    expect(await screen.findByText('Your Companion profile is saved')).toBeTruthy()
    expect(screen.getByText('Your details are saved. Set your availability so members can request a session.')).toBeTruthy()
    expect(screen.queryByText('Next: identity verification')).toBeNull()
    expect(screen.queryByText(/hidden from discovery until your identity check is approved/i)).toBeNull()
    expect(screen.queryByRole('link', { name: 'View verification status' })).toBeNull()
    const availability = screen.getByRole('link', { name: 'Set your availability' })
    expect(availability.getAttribute('class')).toContain('btn-self')
    expect(screen.getByRole('link', { name: 'Go to home' })).toBeTruthy()
  })

  it('keeps pending safety review guidance after a saved profile while under review', async () => {
    state.viewer = {
      ...(state.viewer as Record<string, unknown>),
      identityEligible: false,
      verificationStatus: 'pending',
    }
    state.latestVerification = {
      adminStatus: 'pending',
      verificationSource: 'in_app',
      identityStage: 'ready_for_review',
      isCurrent: true,
      reason: 'member',
    }
    state.application = {
      _id: 'app-1',
      status: 'approved',
      displayName: 'Maya Santos',
      mode: 'both',
      city: 'Cebu City',
      hourlyRateCentavos: 50_000,
      intro: 'I teach guitar and help with everyday errands.',
      bio: 'Member bio.',
      categories: ['Good company'],
    }
    render(<BecomeCompanionPage />)
    await saveValidCompanionProfile()

    expect(await screen.findByText('Your Companion profile is saved')).toBeTruthy()
    expect(screen.getByText(/hidden from discovery until your identity check is approved/i)).toBeTruthy()
    expect(screen.getByText('Next: safety review')).toBeTruthy()
    expect(screen.getByText(/reviewed by the safety team/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View verification status' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Set your availability' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to home' })).toBeTruthy()
  })
})

async function saveValidCompanionProfile() {
  fireEvent.change(screen.getByLabelText(/What work or skills could you share/), {
    target: { value: 'I can help with a calm grocery run and explain everyday technology to neighbors.' },
  })
  fireEvent.change(screen.getByLabelText(/Tell me about yourself/), {
    target: { value: 'Weekend cyclist who likes slow coffees and calm company.' },
  })
  fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Cebu City' } })
  const form = document.querySelector('.companion-editor-form')
  if (!form) throw new Error('Companion profile editor form did not render')
  fireEvent.submit(form)
}
