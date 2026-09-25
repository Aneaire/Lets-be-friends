// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  signedIn: true,
  email: 'maya@example.com' as string | undefined,
  application: null as null | { _id: string; status: string; hourlyRateCentavos?: number },
  setTheme: vi.fn(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: { companions: { myApplication: 'companions.myApplication' } },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => query === 'companions.myApplication' ? state.application : undefined,
}))

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ isSignedIn: state.signedIn }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: state.email } } }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, search, children, ...props }: { to: string; search?: Record<string, string>; children: ReactNode }) => {
    const query = search ? `?${new URLSearchParams(search).toString()}` : ''
    return <a href={`${to}${query}`} {...props}>{children}</a>
  },
}))

vi.mock('../../src/design-system/atoms/ThemeToggle', () => ({
  useThemeChoice: () => ({ theme: 'light', setTheme: state.setTheme }),
}))

import { SettingsPage } from '../../src/routes/settings'

afterEach(cleanup)

beforeEach(() => {
  state.signedIn = true
  state.email = 'maya@example.com'
  state.application = null
  state.setTheme.mockClear()
})

describe('settings route', () => {
  it('gates signed-out visitors behind a sign-in button', () => {
    state.signedIn = false
    render(<SettingsPage />)

    expect(screen.getByRole('heading', { name: 'Sign in to manage your settings.' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' }).tagName).toBe('BUTTON')
  })

  it('keeps the theme choice as a pressed-state control on the saved device theme', () => {
    render(<SettingsPage />)

    const light = screen.getByRole('button', { name: /Light/ })
    const dark = screen.getByRole('button', { name: /Dark/ })
    expect(light.getAttribute('aria-pressed')).toBe('true')
    expect(dark.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(dark)
    expect(state.setTheme).toHaveBeenCalledWith('dark')
  })

  it('routes members without a profile to the Companion start path', () => {
    render(<SettingsPage />)

    const companion = screen.getByRole('link', { name: /Become a Companion/ })
    expect(companion.getAttribute('href')).toBe('/companion')
    expect(screen.getByRole('link', { name: /Personal profile/ }).getAttribute('href')).toBe('/profile')
    expect(screen.getByText('maya@example.com', { exact: false })).toBeTruthy()
  })

  it('links verified Companions to settings edit mode for their live rate', () => {
    state.application = { _id: 'app-1', status: 'approved', hourlyRateCentavos: 50_000 }
    render(<SettingsPage />)

    expect(screen.getByRole('region', { name: 'Companion' })).toBeTruthy()
    const rate = screen.getByRole('link', { name: /Hourly rate/ })
    expect(rate.getAttribute('href')).toBe('/become-companion?edit=true')
    expect(screen.getByText('₱500.00', { exact: false })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Companion profile details/ }).getAttribute('href')).toBe('/become-companion?edit=true')
    expect(screen.getByRole('link', { name: /Verification status/ }).getAttribute('href')).toBe('/get-verified')
  })
})
