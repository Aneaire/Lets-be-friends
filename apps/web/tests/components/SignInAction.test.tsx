// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const clerk = vi.hoisted(() => ({ openSignIn: vi.fn() }))

vi.mock('@clerk/react', () => ({ useClerk: () => clerk }))

import { SignInAction } from '../../src/features/auth/SignInAction'

afterEach(() => {
  cleanup()
  clerk.openSignIn.mockReset()
})

describe('SignInAction', () => {
  it('opens the sign-in modal when a signed-out visitor activates a discovery action', () => {
    render(<SignInAction className="btn">Explore Companions</SignInAction>)

    fireEvent.click(screen.getByRole('button', { name: 'Explore Companions' }))

    expect(clerk.openSignIn).toHaveBeenCalledTimes(1)
  })

  it('renders as a button so it never acts as a member-route link', () => {
    render(<SignInAction className="activity-card">Explore everyone</SignInAction>)

    const action = screen.getByRole('button', { name: 'Explore everyone' })
    expect(action.tagName).toBe('BUTTON')
    expect(action.getAttribute('type')).toBe('button')
  })
})
