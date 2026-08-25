// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({ isSignedIn: false }))

vi.mock('@clerk/react', () => ({
  useAuth: () => authState,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}))

import { MobileAuthGate } from '../../src/features/auth/MobileAuthGate'

afterEach(() => {
  cleanup()
  authState.isSignedIn = false
})

describe('MobileAuthGate', () => {
  it('provides a dedicated sign-in view and a guarded route container when signed out', () => {
    const { container } = render(
      <MobileAuthGate>
        <p>Public route content</p>
      </MobileAuthGate>,
    )

    expect(screen.getByRole('heading', { name: 'Sign in to continue.' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
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
