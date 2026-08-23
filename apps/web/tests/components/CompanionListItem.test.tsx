// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/react', () => ({ SignInButton: ({ children }: { children: ReactNode }) => children }))

import { CompanionListItem, type DiscoveryCompanion } from '../../src/design-system/organisms/CompanionListItem'

afterEach(cleanup)

const companion: DiscoveryCompanion = {
  _id: 'companion-1',
  userId: 'user-1',
  kind: 'companion',
  displayName: 'Angelo Santiago',
  city: 'Angeles City',
  mode: 'both',
  rating: 4.9,
  reviewCount: 18,
  distanceKm: 3.2,
  intro: 'Coffee walks and easy conversation.',
  strengths: ['Good listener', 'Patient', 'Organized'],
  verified: true,
}

describe('CompanionListItem', () => {
  it('shows compact discovery details and links to the Companion profile', () => {
    render(<CompanionListItem companion={companion} signedIn onFollow={vi.fn()} profileLinkProps={{ href: '/companion-profile?companionProfileId=companion-1' }} />)

    expect(screen.getByRole('link', { name: 'Angelo Santiago' }).getAttribute('href'))
      .toBe('/companion-profile?companionProfileId=companion-1')
    expect(screen.getByText('Identity checked')).toBeTruthy()
    expect(screen.getByText('Angeles City')).toBeTruthy()
    expect(screen.getByText('Online and in-person')).toBeTruthy()
    expect(screen.getAllByText('Good listener')).toHaveLength(1)
    expect(screen.queryByText('Organized')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Profile' })).toBeNull()
  })

  it('keeps the follow action separate from profile navigation', () => {
    const onFollow = vi.fn().mockResolvedValue(undefined)
    render(<CompanionListItem companion={companion} signedIn onFollow={onFollow} />)

    fireEvent.click(screen.getByRole('button', { name: 'Follow Angelo Santiago' }))
    expect(onFollow).toHaveBeenCalledOnce()
  })

  it('links members to their member profile without unverified status copy', () => {
    render(<CompanionListItem companion={{ ...companion, kind: 'member', verified: false }} signedIn onFollow={vi.fn()} profileLinkProps={{ href: '/member-profile?userId=user-1' }} />)

    expect(screen.getByRole('link', { name: 'Angelo Santiago' }).getAttribute('href'))
      .toBe('/member-profile?userId=user-1')
    expect(screen.queryByText('Not identity checked')).toBeNull()
  })
})
