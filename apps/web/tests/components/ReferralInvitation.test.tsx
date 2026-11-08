// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const openSignIn = vi.fn()
vi.mock('@clerk/react', () => ({ useAuth: () => ({ isSignedIn: false }), useClerk: () => ({ openSignIn }) }))
vi.mock('@tanstack/react-router', () => ({ Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a> }))
import { ReferralInvitation } from '../../src/features/referral/ReferralInvitation'
import { ReferralCapture } from '../../src/features/referral/ReferralCapture'
import { REFERRAL_CODE_STORAGE_KEY } from '@lets-be-friends/shared'

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks() })

it('shows the invitation code and opens sign in', () => {
  render(<ReferralInvitation code="ab-cd1234" />)
  expect(screen.getByText('ABCD1234')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Join or sign in' }))
  expect(openSignIn).toHaveBeenCalledOnce()
})

it('explains an invalid invitation', () => {
  render(<ReferralInvitation code="bad" />)
  expect(screen.getByText(/missing or invalid/)).toBeTruthy()
})

it('stores a valid referral code for account setup', () => {
  window.history.replaceState({}, '', '/invite?ref=ab-cd1234')
  render(<ReferralCapture />)
  expect(localStorage.getItem(REFERRAL_CODE_STORAGE_KEY)).toBe('ABCD1234')
})
