// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: { publicProfile: 'users.publicProfile' },
    social: { byUser: 'social.byUser', toggleFollow: 'social.toggleFollow', toggleLike: 'social.toggleLike', toggleSavePost: 'social.toggleSavePost' },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => {
    if (query === 'users.publicProfile') {
      return {
        _id: 'member-2',
        displayName: 'gelo santiago',
        username: 'gelgaming',
        bio: 'I can help you to help others from helping other',
        onboardingCategories: ['Coffee'],
        profileImageUrl: '',
        identityVerified: false,
        following: false,
        isViewer: false,
      }
    }
    if (query === 'social.byUser') return []
    return undefined
  },
  useMutation: () => vi.fn(async () => undefined),
}))

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ isSignedIn: true, userId: 'user-1' }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({ ...options, useSearch: () => ({ userId: 'member-2' }) }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}))

vi.mock('../../src/features/profile/ProfileContentPanel', () => ({
  ProfileContentPanel: () => <div data-testid="profile-content" />,
}))

import { Route } from '../../src/routes/member-profile'

const MemberProfilePage = (Route as unknown as { component: () => ReactNode }).component

afterEach(cleanup)

describe('member profile privacy', () => {
  it('shows another member only their public identity and the identity trust chip', () => {
    render(<MemberProfilePage />)

    expect(screen.getByRole('heading', { name: 'gelo santiago' })).toBeTruthy()
    expect(screen.getByText('@gelgaming')).toBeTruthy()
    expect(screen.getByText('Not identity checked')).toBeTruthy()
    expect(screen.getByText('I can help you to help others from helping other')).toBeTruthy()
  })

  it('never shows the owner-only account status, discovery area, or Companion summary', () => {
    const { container } = render(<MemberProfilePage />)

    expect(screen.queryByText('Account status')).toBeNull()
    expect(screen.queryByText('Identity verification')).toBeNull()
    expect(screen.queryByText('Discovery area')).toBeNull()
    expect(screen.queryByText(/rounded device location Nearby measures/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Companion profile' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Edit Companion profile' })).toBeNull()
    expect(container.querySelector('.profile-companion-card')).toBeNull()
  })
})
