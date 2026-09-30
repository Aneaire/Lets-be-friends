// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode
    to?: string
    className?: string
  }) => (
    <a href={to ?? '#'} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('../../src/design-system/molecules/OpenableImage', () => ({
  OpenableImage: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}))

import { SafetyPage } from '../../src/routes/safety'

afterEach(() => {
  cleanup()
})

describe('SafetyPage fraud and trust guidance', () => {
  it('states the 18+ rule and verification gate in the hero', () => {
    render(<SafetyPage />)

    expect(screen.getByRole('heading', { name: 'Know what happens before you meet.' })).toBeTruthy()
    expect(screen.getByText(/adults 18 and older/)).toBeTruthy()
    expect(screen.getByText(/Verification is required before booking/)).toBeTruthy()
  })

  it('shows scannable fraud red flags and emergency guidance', () => {
    render(<SafetyPage />)

    expect(screen.getByRole('heading', { name: 'Stop fraud before it starts.' })).toBeTruthy()
    expect(screen.getByText('Keep payment in the app.')).toBeTruthy()
    expect(screen.getByText('Keep agreements in writing.')).toBeTruthy()
    expect(screen.getByText('Check identity and approval signals.')).toBeTruthy()
    expect(screen.getByText(/In an emergency, leave first/)).toBeTruthy()
    expect(screen.getByText(/never replaces emergency help/)).toBeTruthy()
  })

  it('explains reporting without evidence and fund protection', () => {
    render(<SafetyPage />)

    expect(screen.getByRole('heading', { name: 'Report in seconds. No evidence required.' })).toBeTruthy()
    expect(screen.getAllByText(/pauses unsettled funds for safety review/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Private check-in photos are optional/).length).toBeGreaterThan(0)
  })

  it('keeps discovery and profile actions on the correct accent intent', () => {
    const { container } = render(<SafetyPage />)

    const discoveryLinks = Array.from(container.querySelectorAll('a[href="/nearby"]'))
    expect(discoveryLinks.length).toBeGreaterThan(0)
    for (const link of discoveryLinks) {
      expect(link.className).toContain('btn-social')
    }

    const profileLinks = Array.from(container.querySelectorAll('a[href="/become-companion"]'))
    expect(profileLinks.length).toBeGreaterThan(0)
    for (const link of profileLinks) {
      expect(link.className).toContain('btn-self')
    }
    expect(screen.getAllByText('Create your Companion profile').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Find a Companion').length).toBeGreaterThan(0)
  })

  it('uses Companion language and contains no em dashes', () => {
    const { container } = render(<SafetyPage />)

    expect(container.textContent).toContain("Let's Be Friends")
    expect(container.textContent).not.toContain('Lets Be Friends')
    expect(container.textContent).not.toContain('—')
    expect(container.textContent).not.toContain('–')
    expect(container.textContent).not.toContain('saved pin')
  })
})
