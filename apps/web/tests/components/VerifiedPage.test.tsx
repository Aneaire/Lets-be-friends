// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({ signedIn: true }))
const queryState = vi.hoisted(() => ({
  viewer: undefined as any,
  latest: undefined as any,
  callIndex: 0,
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
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
}))

import { useQuery } from 'convex/react'
import { VerifiedPage } from '../../src/features/verification/VerifiedPage'

const mockUseQuery = vi.mocked(useQuery)

mockUseQuery.mockImplementation(() => {
  const values = [queryState.viewer, queryState.latest]
  const value = values[queryState.callIndex % 2]
  queryState.callIndex += 1
  return value
})

afterEach(() => {
  cleanup()
  authState.signedIn = true
  queryState.viewer = undefined
  queryState.latest = undefined
  queryState.callIndex = 0
  mockUseQuery.mockClear()
})

const approvedViewer = { verificationStatus: 'approved', identityEligible: true }

describe('verification congratulations page', () => {
  it('asks signed-out visitors to sign in instead of congratulating them', () => {
    authState.signedIn = false
    render(<VerifiedPage />)

    expect(screen.getByRole('heading', { name: 'Sign in to see your verification result.' })).toBeTruthy()
    expect(screen.queryByText(/You are verified/)).toBeNull()
  })

  it('waits for the verification status before claiming anything', () => {
    render(<VerifiedPage />)

    expect(screen.getByText('Checking your verification status...')).toBeTruthy()
    expect(screen.queryByText(/You are verified/)).toBeNull()
  })

  it('never congratulates a member whose approval is not current', () => {
    queryState.viewer = { verificationStatus: 'pending', identityEligible: false }
    queryState.latest = {
      adminStatus: 'pending',
      verificationSource: 'in_app',
      identityStage: 'ready_for_review',
      isCurrent: true,
      reason: 'member',
    }
    render(<VerifiedPage />)

    expect(screen.getByRole('heading', { name: 'Safety review pending' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Review your verification status/ })).toBeTruthy()
    expect(screen.queryByText(/You are verified/)).toBeNull()
    expect(screen.queryByText(/start making friends/)).toBeNull()
  })

  it('celebrates a current approval and points at the first friendly step', () => {
    queryState.viewer = approvedViewer
    queryState.latest = {
      adminStatus: 'approved',
      verificationSource: 'in_app',
      identityStage: 'approved',
      isCurrent: true,
      reason: 'member',
    }
    render(<VerifiedPage />)

    expect(screen.getByRole('heading', { name: 'You are verified. Start making friends.' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Three easy ways to begin' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /Explore people/ }).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('link', { name: /How safety works/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Create a Companion profile/ })).toBeTruthy()
  })

  it('serves the generated verification imagery with a smaller variant', () => {
    queryState.viewer = approvedViewer
    queryState.latest = {
      adminStatus: 'approved',
      verificationSource: 'in_app',
      identityStage: 'approved',
      isCurrent: true,
      reason: 'member',
    }
    const { container } = render(<VerifiedPage />)

    expect(container.textContent).not.toContain('—')
    expect(container.textContent).not.toContain('–')

    const sources = Array.from(container.querySelectorAll('img')).map((image) => image.getAttribute('src'))
    expect(sources).toContain('/images/verification/frienday-verified-hero-1024.webp')
    expect(sources).toContain('/images/verification/frienday-verified-meet-1024.webp')
    expect(sources).toContain('/images/verification/frienday-verified-plan-1024.webp')
    expect(sources).toContain('/images/verification/frienday-verified-online-1024.webp')
    const hero = container.querySelector('img[src="/images/verification/frienday-verified-hero-1024.webp"]')
    expect(hero?.getAttribute('srcSet')).toContain('/images/verification/frienday-verified-hero-768.webp 768w')
  })
})
