// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}))

import { PrivacyPolicyPage } from '../../src/routes/privacy-policy'
import { TermsAndConditionsPage } from '../../src/routes/terms-and-conditions'
import { AcceptanceCheckboxes, AlreadyAcceptedNotice, PolicyLinkList } from '../../src/features/policy/PolicySummaries'
import { currentPolicyVersion } from '@lets-be-friends/shared'

afterEach(() => {
  cleanup()
})

describe('dedicated legal pages', () => {
  it('renders the Terms page with version, sections, and a Privacy crosslink', () => {
    render(<TermsAndConditionsPage />)
    expect(screen.getByRole('heading', { name: 'Terms and Conditions' })).toBeTruthy()
    expect(screen.getByText(new RegExp(`Version ${currentPolicyVersion.replace('.', '\\.')}`))).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Platonic purpose and boundaries' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Companion obligations' })).toBeTruthy()
    const crosslink = screen.getByRole('link', { name: 'Read the Privacy Policy' })
    expect(crosslink.getAttribute('href')).toBe('/privacy-policy')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('renders the Privacy page with version, retention scope, and a Terms crosslink', () => {
    const { container } = render(<PrivacyPolicyPage />)
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeTruthy()
    expect(screen.getByText(new RegExp(`Version ${currentPolicyVersion.replace('.', '\\.')}`))).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Location and retention' })).toBeTruthy()
    expect(screen.getByText(/for as long as your account exists/)).toBeTruthy()
    expect(screen.getByText(/never sent to the field reader/)).toBeTruthy()
    expect(screen.getByText(/Only coordinates rounded to two decimals are saved/)).toBeTruthy()
    expect(screen.getByText(/OpenAI field reader/)).toBeTruthy()
    expect(screen.getByText(/not used as biometric proof/)).toBeTruthy()
    expect(screen.getByText(/human safety team decision/)).toBeTruthy()
    expect(screen.getByText(/documented legal hold/)).toBeTruthy()
    expect(screen.getByText(/time limited and audit logged/)).toBeTruthy()
    expect(screen.getByText(/never appear on public profiles/)).toBeTruthy()
    expect(container.textContent ?? '').not.toContain('730 days')
    const crosslink = screen.getByRole('link', { name: 'Read the Terms and Conditions' })
    expect(crosslink.getAttribute('href')).toBe('/terms-and-conditions')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('honors disabled on both acceptance checkboxes while saving', () => {
    const { rerender } = render(
      <AcceptanceCheckboxes termsChecked={false} privacyChecked={false} onTermsChange={() => undefined} onPrivacyChange={() => undefined} />,
    )
    expect((screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }) as HTMLInputElement).disabled).toBe(false)
    rerender(
      <AcceptanceCheckboxes termsChecked={false} privacyChecked={false} onTermsChange={() => undefined} onPrivacyChange={() => undefined} disabled />,
    )
    expect((screen.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }) as HTMLInputElement).disabled).toBe(true)
  })

  it('opens remembered-notice documents in a new tab without repeat boxes', () => {
    render(<AlreadyAcceptedNotice />)
    expect(screen.queryByRole('checkbox')).toBeNull()
    for (const name of ['Terms and Conditions', 'Privacy Policy']) {
      const link = screen.getByRole('link', { name })
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
    }
  })

  it('renders both policy links from the shared catalog', () => {
    render(<PolicyLinkList />)
    expect(screen.getByRole('link', { name: 'Terms and Conditions' }).getAttribute('href')).toBe('/terms-and-conditions')
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('/privacy-policy')
  })
})
