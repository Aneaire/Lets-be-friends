// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { MouseEvent, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const directory = vi.hoisted(() => ({
  results: [
    {
      _id: 'reviewed-companion',
      kind: 'companion',
      displayName: 'Reviewed Companion',
      city: 'Makati',
      mode: 'both',
      rating: 4.8,
      reviewCount: 6,
      intro: 'Coffee and conversation.',
      strengths: [],
    },
    {
      _id: 'new-companion',
      kind: 'companion',
      displayName: 'New Companion',
      city: 'Manila',
      mode: 'online',
      rating: 0,
      reviewCount: 0,
      intro: 'Online company.',
      strengths: [],
    },
    {
      _id: 'reviewed-member',
      kind: 'member',
      displayName: 'Reviewed Member',
      city: 'Pasig',
      mode: 'online',
      rating: 5,
      reviewCount: 2,
      intro: 'A community member.',
      strengths: [],
    },
  ],
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    companions: { listExploreDirectoryPage: 'companions.listExploreDirectoryPage' },
    social: { toggleFollow: 'social.toggleFollow' },
  },
}))

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({ results: directory.results, status: 'Exhausted', loadMore: vi.fn() }),
}))

vi.mock('@clerk/react', () => ({ useAuth: () => ({ isSignedIn: true }) }))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, onClick, children, ...props }: {
    to: string
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
    children: ReactNode
  }) => (
    <a
      href={to}
      onClick={(event) => {
        event.preventDefault()
        onClick?.(event)
      }}
      {...props}
    >
      {children}
    </a>
  ),
}))

vi.mock('../../src/design-system/organisms/CompanionListItem', () => ({
  CompanionListItem: ({ companion }: { companion: { displayName: string } }) => (
    <div role="listitem">{companion.displayName}</div>
  ),
}))

vi.mock('../../src/features/discovery/CategoryFilterDialog', () => ({ CategoryFilterDialog: () => null }))

import { DiscoverPage } from '../../src/routes/discover'

afterEach(cleanup)

describe('Explore destinations', () => {
  it('uses page links for destinations and filters Reviews to reviewed Companions', () => {
    render(<DiscoverPage />)

    const destinations = screen.getByRole('navigation', { name: 'Explore destinations' })
    const people = screen.getByRole('link', { name: 'People' })
    const reviews = screen.getByRole('link', { name: 'Reviews' })

    expect(people.getAttribute('href')).toBe('/discover')
    expect(people.getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Circles' }).getAttribute('href')).toBe('/circles')
    expect(screen.getByRole('link', { name: 'Nearby' }).getAttribute('href')).toBe('/nearby')
    expect(reviews.getAttribute('href')).toBe('#reviews')
    expect(destinations.getAttribute('role')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByLabelText('Search people')).toBeTruthy()
    expect(screen.getByText('Reviewed Companion')).toBeTruthy()
    expect(screen.getByText('New Companion')).toBeTruthy()
    expect(screen.getByText('Reviewed Member')).toBeTruthy()
    expect(screen.queryByText('Explore people')).toBeNull()
    expect(screen.queryByText('Open nearby search')).toBeNull()
    expect(screen.queryByText('Browse Circles')).toBeNull()

    fireEvent.click(reviews)

    expect(people.getAttribute('aria-current')).toBeNull()
    expect(reviews.getAttribute('aria-current')).toBe('location')
    expect(screen.getByText('Reviewed Companion')).toBeTruthy()
    expect(screen.queryByText('New Companion')).toBeNull()
    expect(screen.queryByText('Reviewed Member')).toBeNull()

    fireEvent.click(people)

    expect(people.getAttribute('aria-current')).toBe('page')
    expect(reviews.getAttribute('aria-current')).toBeNull()
    expect(screen.getByText('New Companion')).toBeTruthy()
    expect(screen.getByText('Reviewed Member')).toBeTruthy()
  })
})
