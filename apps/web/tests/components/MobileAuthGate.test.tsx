// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({ isSignedIn: false }))
const routerState = vi.hoisted(() => ({ pathname: '/messages' }))

vi.mock('@clerk/react', () => ({
  useAuth: () => authState,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: routerState.pathname } }),
}))

import { MobileAuthGate, isPublicMobilePath } from '../../src/features/auth/MobileAuthGate'

afterEach(() => {
  cleanup()
  authState.isSignedIn = false
  routerState.pathname = '/messages'
})

describe('MobileAuthGate', () => {
  it('blocks member routes with a dedicated sign-in view when signed out', () => {
    routerState.pathname = '/messages'
    const { container } = render(
      <MobileAuthGate>
        <p>Member route content</p>
      </MobileAuthGate>,
    )

    expect(screen.getByRole('heading', { name: 'Sign in to continue.' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
    expect(container.querySelector('.mobile-auth-gate-root')?.getAttribute('data-gate')).toBe('blocking')
    expect(container.querySelector('.mobile-auth-guarded-content')?.textContent).toContain('Member route content')
  })

  it('shows public marketing pages without the blocking gate when signed out', () => {
    routerState.pathname = '/'
    const { container } = render(
      <MobileAuthGate>
        <p>Public route content</p>
      </MobileAuthGate>,
    )

    expect(screen.queryByRole('heading', { name: 'Sign in to continue.' })).toBeNull()
    expect(container.querySelector('.mobile-auth-gate-root')?.getAttribute('data-gate')).toBe('open')
    expect(container.querySelector('.mobile-auth-guarded-content')?.textContent).toContain('Public route content')
  })

  it('renders the requested route without the sign-in gate when signed in', () => {
    authState.isSignedIn = true

    const { container } = render(
      <MobileAuthGate>
        <p>Member route content</p>
      </MobileAuthGate>,
    )

    expect(screen.queryByRole('heading', { name: 'Sign in to continue.' })).toBeNull()
    expect(screen.getByText('Member route content')).toBeTruthy()
    expect(container.querySelector('.mobile-auth-guarded-content')).toBeNull()
  })
})

describe('isPublicMobilePath', () => {
  it('treats marketing and discovery routes as public', () => {
    for (const path of ['/', '/safety', '/become-companion', '/discover', '/nearby', '/companion-profile', '/member-profile']) {
      expect(isPublicMobilePath(path)).toBe(true)
    }
    expect(isPublicMobilePath('/companion-profile/abc123')).toBe(true)
  })

  it('treats member-only routes as guarded', () => {
    for (const path of ['/messages', '/notifications', '/profile', '/wallet', '/settings', '/circles', '/social']) {
      expect(isPublicMobilePath(path)).toBe(false)
    }
  })
})
