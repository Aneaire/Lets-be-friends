// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({ signedIn: true }))

vi.mock('convex/react', () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    search,
    children,
    ...props
  }: {
    to: string
    search?: Record<string, string>
    children: ReactNode
  }) => {
    const query = search ? `?${new URLSearchParams(search).toString()}` : ''
    return <a href={`${to}${query}`} {...props}>{children}</a>
  },
}))

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ isSignedIn: authState.signedIn }),
  useUser: () => ({}),
}))

import { GetVerifiedPage } from '../../src/features/verification/GetVerifiedPage'

afterEach(() => {
  cleanup()
  authState.signedIn = true
})

describe('get verified page', () => {
  it('shows identity, Companion profile, and earnings sections while status loads', () => {
    render(<GetVerifiedPage />)

    expect(screen.getByRole('heading', { name: 'Get verified' })).toBeTruthy()
    expect(screen.getByLabelText('0 of 2 verification steps complete')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Identity check' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Companion profile' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Earn with your everyday Strengths' })).toBeTruthy()
    expect(screen.getByText('Loading identity status...')).toBeTruthy()
    expect(screen.getByText('Loading Companion profile...')).toBeTruthy()
  })

  it('asks signed-out visitors to sign in first', () => {
    authState.signedIn = false
    render(<GetVerifiedPage />)

    expect(screen.getByRole('heading', { name: 'Sign in to check your verification.' })).toBeTruthy()
  })
})
