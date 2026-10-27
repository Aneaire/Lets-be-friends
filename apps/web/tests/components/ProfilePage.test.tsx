// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatPhp } from '@lets-be-friends/shared'

const state = vi.hoisted(() => ({
  viewer: undefined as Record<string, unknown> | null | undefined,
  application: null as unknown,
  navigate: vi.fn(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: {
      viewer: 'users.viewer',
      latestMemberVerification: 'users.latestMemberVerification',
      updateProfile: 'users.updateProfile',
      generateProfileImageUploadUrl: 'users.generateProfileImageUploadUrl',
    },
    companions: { myApplication: 'companions.myApplication' },
    notificationMutes: { mine: 'notificationMutes.mine', setMuted: 'notificationMutes.setMuted' },
    social: {
      byUser: 'social.byUser',
      toggleLike: 'social.toggleLike',
      toggleSavePost: 'social.toggleSavePost',
      editPost: 'social.editPost',
      deletePost: 'social.deletePost',
      createPost: 'social.createPost',
      updateProfilePicture: 'social.updateProfilePicture',
      voteOnPoll: 'social.voteOnPoll',
    },
    reviews: {
      forCompanion: 'reviews.forCompanion',
      toggleLike: 'reviews.toggleLike',
      createComment: 'reviews.createComment',
      deleteComment: 'reviews.deleteComment',
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => {
    if (query === 'users.viewer') return state.viewer
    if (query === 'users.latestMemberVerification') return null
    if (query === 'companions.myApplication') return state.application
    if (query === 'social.byUser') return []
    return undefined
  },
  useMutation: () => vi.fn(async () => undefined),
}))

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ isSignedIn: true, userId: 'user-1' }),
  useUser: () => ({ user: { fullName: 'gelo santiago', username: 'gelgaming' } }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({ ...options, useSearch: () => ({}) }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => state.navigate,
}))

vi.mock('../../src/features/identity/IdentityVerificationFlow', () => ({
  useIdentityVerification: () => ({ begin: vi.fn(async () => ({ mode: 'launch' })), busy: false, message: '', error: '' }),
}))

vi.mock('../../src/features/profile/ProfileContentPanel', () => ({
  ProfileContentPanel: () => <div data-testid="profile-content" />,
}))

vi.mock('../../src/features/profile/AvatarCropper', () => ({
  AvatarCropper: () => <div data-testid="avatar-cropper" />,
}))

import { Route } from '../../src/routes/profile'

const ProfilePage = (Route as unknown as { component: () => ReactNode }).component

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  state.navigate = vi.fn()
  state.application = null
  state.viewer = {
    _id: 'member-1',
    displayName: 'gelo santiago',
    username: 'gelgaming',
    bio: 'I can help you to help others from helping other',
    profileImageUrl: '',
    onboardingCategories: [],
    verificationStatus: 'not_started',
    identityEligible: false,
  }
})

const approvedCompanion = {
  _id: 'companion-1',
  status: 'approved',
  intro: 'I can help you practice a new language, and I make everyday errands more fun.',
  mode: 'in_person',
  city: 'Bacolor',
  hourlyRateCentavos: 50_000,
  categories: ['Coffee walks', 'Grocery runs'],
  strengths: [],
  boundaries: [],
  rating: 5,
  reviewCount: 3,
}

describe('profile hero actions menu', () => {
  it('keeps the three profile actions behind the top corner menu instead of a button row', () => {
    const { container } = render(<ProfilePage />)

    expect(container.querySelector('.profile-hero-actions')).toBeNull()
    expect(screen.getByRole('button', { name: 'Profile actions' }).getAttribute('aria-haspopup')).toBe('menu')
    expect(screen.queryByRole('menuitem', { name: 'Edit profile' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Your bookings' })).toBeNull()
  })

  it('lists Edit profile, Your bookings, and the Companion action when opened', () => {
    render(<ProfilePage />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile actions' }))

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Edit profile',
      'Your bookings',
      'Become a Companion',
    ])
  })

  it('opens the edit dialog from the menu', () => {
    render(<ProfilePage />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit profile' }))

    expect(screen.queryByRole('menuitem', { name: 'Edit profile' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Edit profile' })).toBeTruthy()
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })

  it('opens the post-style photo composer from the profile picture', () => {
    render(<ProfilePage />)

    fireEvent.click(screen.getByRole('button', { name: 'Update profile picture' }))

    expect(screen.getByRole('dialog', { name: 'Update profile picture' })).toBeTruthy()
    expect(screen.getByRole('article', { name: 'Profile photo preview' })).toBeTruthy()
    expect(screen.getByText('Post')).toBeTruthy()
  })

  it('routes bookings and the Companion profile through the same menu', () => {
    render(<ProfilePage />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Your bookings' }))
    expect(state.navigate).toHaveBeenCalledWith({ to: '/app', search: {} })

    fireEvent.click(screen.getByRole('button', { name: 'Profile actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Become a Companion' }))
    expect(state.navigate).toHaveBeenCalledWith({ to: '/become-companion' })
  })

  it('labels the Companion action for a member who already has a profile', () => {
    state.application = { _id: 'companion-1', status: 'approved', rating: null, reviewCount: 0 }

    render(<ProfilePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Profile actions' }))

    expect(screen.getByRole('menuitem', { name: 'Edit Companion profile' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Become a Companion' })).toBeNull()
  })
})

describe('profile detail cards', () => {
  it('shows the rounded discovery area saved during onboarding', () => {
    state.viewer = { ...state.viewer, approximateLatitude: 15.15, approximateLongitude: 120.58 }

    render(<ProfilePage />)

    expect(screen.getByText('Discovery area')).toBeTruthy()
    expect(screen.getByText('15.15, 120.58')).toBeTruthy()
  })

  it('says so when no rounded area was saved', () => {
    render(<ProfilePage />)

    expect(screen.getByText('Not saved')).toBeTruthy()
  })

  it('publishes what the Companion profile shows members', () => {
    state.application = approvedCompanion
    state.viewer = { ...state.viewer, verificationStatus: 'approved', identityEligible: true }

    render(<ProfilePage />)

    expect(screen.getByRole('heading', { name: 'Companion profile' })).toBeTruthy()
    expect(screen.getByText(approvedCompanion.intro)).toBeTruthy()
    expect(screen.getByText('In-person')).toBeTruthy()
    expect(screen.getByText('Bacolor')).toBeTruthy()
    expect(screen.getByText(`${formatPhp(approvedCompanion.hourlyRateCentavos)} per hour`)).toBeTruthy()
    expect(screen.getByText('Coffee walks')).toBeTruthy()
    expect(screen.getByText('Grocery runs')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View public profile' }).getAttribute('href')).toBe('/companion-profile')
    expect(screen.getByRole('link', { name: 'Edit Companion profile' }).getAttribute('href')).toBe('/become-companion')
  })

  it('keeps the public profile link hidden until identity is approved', () => {
    state.application = approvedCompanion

    render(<ProfilePage />)

    expect(screen.queryByRole('link', { name: 'View public profile' })).toBeNull()
    expect(screen.getByText('Your profile appears in Explore and on the nearby map once your identity check is approved.')).toBeTruthy()
  })

  it('says when a Companion detail is still missing', () => {
    state.application = { ...approvedCompanion, city: '', hourlyRateCentavos: undefined, categories: [] }

    render(<ProfilePage />)

    expect(screen.getAllByText('Not set')).toHaveLength(2)
    expect(screen.queryByText('Everyday help and activities')).toBeNull()
  })

  it('keeps the Become a Companion entry point while no profile exists', () => {
    render(<ProfilePage />)

    expect(screen.queryByRole('heading', { name: 'Companion profile' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Become a Companion' }).getAttribute('href')).toBe('/become-companion')
  })
})
