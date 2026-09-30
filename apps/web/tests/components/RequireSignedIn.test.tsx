// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({ isLoaded: true, isSignedIn: false }))
const redirects = vi.hoisted(() => [] as string[])

vi.mock('@clerk/react', () => ({ useAuth: () => authState }))

vi.mock('@tanstack/react-router', () => ({
  Navigate: ({ to }: { to: string }) => {
    redirects.push(to)
    return <div data-testid="navigate" data-to={to} />
  },
}))

import { RequireSignedIn } from '../../src/features/auth/RequireSignedIn'

afterEach(() => {
  cleanup()
  authState.isLoaded = true
  authState.isSignedIn = false
  redirects.length = 0
})

describe('RequireSignedIn', () => {
  it('redirects signed-out visitors to the marketing home instead of member content', () => {
    render(
      <RequireSignedIn>
        <p>Home feed content</p>
      </RequireSignedIn>,
    )

    expect(screen.queryByText('Home feed content')).toBeNull()
    expect(redirects).toEqual(['/'])
  })

  it('renders member content for a signed-in session without redirecting', () => {
    authState.isSignedIn = true

    render(
      <RequireSignedIn>
        <p>Home feed content</p>
      </RequireSignedIn>,
    )

    expect(screen.getByText('Home feed content')).toBeTruthy()
    expect(redirects).toEqual([])
  })

  it('renders nothing while the session is still resolving', () => {
    authState.isLoaded = false

    const { container } = render(
      <RequireSignedIn>
        <p>Home feed content</p>
      </RequireSignedIn>,
    )

    expect(container.textContent).toBe('')
    expect(redirects).toEqual([])
  })
})
