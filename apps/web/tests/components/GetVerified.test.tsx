// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({ signedIn: true }))
const queryState = vi.hoisted(() => ({
  viewer: undefined as any,
  latest: undefined as any,
  application: undefined as any,
  callIndex: 0,
}))

vi.mock('convex/react', () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
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
  useUser: () => ({}),
}))

import { useQuery } from 'convex/react'
import { GetVerifiedPage } from '../../src/features/verification/GetVerifiedPage'

const mockUseQuery = vi.mocked(useQuery)

mockUseQuery.mockImplementation(() => {
  const values = [queryState.viewer, queryState.latest, queryState.application]
  const value = values[queryState.callIndex % 3]
  queryState.callIndex += 1
  return value
})

afterEach(() => {
  cleanup()
  authState.signedIn = true
  queryState.viewer = undefined
  queryState.latest = undefined
  queryState.application = undefined
  queryState.callIndex = 0
  mockUseQuery.mockClear()
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

  it('locks both Companion CTAs until identity is submitted for safety review', () => {
    queryState.viewer = { verificationStatus: 'not_started', identityEligible: false }
    queryState.latest = {
      adminStatus: 'not_ready',
      verificationSource: 'in_app',
      identityStage: 'draft',
      isCurrent: true,
      reason: 'member',
    }
    queryState.application = null
    render(<GetVerifiedPage />)

    expect(screen.getAllByText('Submit your identity check for safety review first. Your Companion profile unlocks after your identity is submitted for review.')).toHaveLength(2)
    const lockedButtons = screen.getAllByTitle('Submit your identity check first')
    expect(lockedButtons).toHaveLength(2)
    for (const button of lockedButtons) {
      expect(button.hasAttribute('disabled')).toBe(true)
    }
    expect(screen.queryAllByRole('link', { name: /Companion profile/ })).toEqual([])
  })

  it('keeps a saved pending Companion profile locked without implying it was lost', () => {
    queryState.viewer = { verificationStatus: 'not_started', identityEligible: false }
    queryState.latest = {
      adminStatus: 'not_ready',
      verificationSource: 'in_app',
      identityStage: 'draft',
      isCurrent: true,
      reason: 'member',
    }
    queryState.application = { status: 'pending_review' }
    render(<GetVerifiedPage />)

    expect(screen.getAllByText('Your Companion profile is saved. Its review cannot proceed until your identity is submitted for safety review.')).toHaveLength(2)
    const lockedButtons = screen.getAllByTitle('Submit your identity check first')
    expect(lockedButtons).toHaveLength(2)
    for (const button of lockedButtons) {
      expect(button.hasAttribute('disabled')).toBe(true)
    }
    expect(screen.queryAllByRole('link', { name: /Companion profile/ })).toEqual([])
  })

  it('describes the Companion step with current profile fields', () => {
    queryState.viewer = { verificationStatus: 'not_started', identityEligible: false }
    queryState.latest = {
      adminStatus: 'not_ready',
      verificationSource: 'in_app',
      identityStage: 'draft',
      isCurrent: true,
      reason: 'member',
    }
    queryState.application = null
    render(<GetVerifiedPage />)

    expect(screen.getByText('Share your activities, session format, availability, and profile details.')).toBeTruthy()
  })

  it('unlocks Companion CTAs when identity is ready for safety review', () => {
    queryState.viewer = { verificationStatus: 'pending', identityEligible: false }
    queryState.latest = {
      adminStatus: 'pending',
      verificationSource: 'in_app',
      identityStage: 'ready_for_review',
      isCurrent: true,
      reason: 'member',
    }
    queryState.application = null
    render(<GetVerifiedPage />)

    const links = screen.getAllByRole('link', { name: /Companion profile/ })
    expect(links.length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByTitle('Submit your identity check first')).toBeNull()
  })

  it('unlocks Companion CTAs for a current approved identity', () => {
    queryState.viewer = { verificationStatus: 'approved', identityEligible: true }
    queryState.latest = {
      adminStatus: 'pending',
      verificationSource: 'in_app',
      identityStage: 'ready_for_review',
      isCurrent: true,
      reason: 'member',
    }
    queryState.application = null
    render(<GetVerifiedPage />)

    const links = screen.getAllByRole('link', { name: /Companion profile/ })
    expect(links.length).toBeGreaterThanOrEqual(2)
  })
})
