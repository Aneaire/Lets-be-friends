// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
  useRouterState: vi.fn(),
}))

// Header search queries the bounded server directory; the fallback directory
// prop keeps these interaction tests deterministic without a Convex provider.
vi.mock('convex/react', () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}))

import { AccountAvatar, HeaderPrimaryActions, HeaderSearch, type HeaderSearchPerson } from '../../src/design-system/templates/AppNavigation'

afterEach(cleanup)

const directory: HeaderSearchPerson[] = [
  {
    _id: 'member-1',
    userId: 'member-1',
    kind: 'member',
    username: 'astro',
    displayName: 'Lanceloth David',
    city: 'Member',
    intro: 'A member of the community.',
  },
  {
    _id: 'companion-1',
    userId: 'user-2',
    kind: 'companion',
    username: 'maya_makati',
    displayName: 'Maya Santos',
    city: 'Makati',
    intro: 'Museum visits and coffee walks.',
    strengths: ['Good listener'],
  },
]

describe('account avatar', () => {
  it('shows a generic silhouette when the member has no app profile photo', () => {
    const { container } = render(<AccountAvatar />)

    expect(container.querySelector('.account-avatar svg')).toBeTruthy()
    expect(container.querySelector('.account-avatar img')).toBeNull()
  })

  it('shows a photo uploaded to the member profile', () => {
    const { container } = render(<AccountAvatar imageUrl="/member-photo.jpg" />)

    expect(container.querySelector('.account-avatar img')?.getAttribute('src')).toBe('/member-photo.jpg')
  })
})

describe('header primary actions', () => {
  it('links Messages and Bookings from the signed-in header', () => {
    render(<HeaderPrimaryActions activeItem={null} />)

    const nav = screen.getByRole('navigation', { name: /messages and bookings/i })
    expect(nav.querySelectorAll('a.header-primary-action')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Messages' }).getAttribute('href')).toBe('/messages')
    expect(screen.getByRole('link', { name: 'Bookings' }).getAttribute('href')).toBe('/app')
  })

  it('marks the active header destination for Messages', () => {
    render(<HeaderPrimaryActions activeItem="messages" />)

    expect(screen.getByRole('link', { name: 'Messages' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Bookings' }).getAttribute('aria-current')).toBeNull()
  })
})

describe('header search', () => {
  it('finds members and links to their member profile', () => {
    render(<HeaderSearch directory={directory} />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '@astro' } })

    expect(screen.getByRole('link', { name: /Lanceloth David/ }).getAttribute('href'))
      .toBe('/member-profile?userId=member-1')
  })

  it('finds Companions and links to their Companion profile', () => {
    render(<HeaderSearch directory={directory} />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'good listener' } })

    expect(screen.getByRole('link', { name: /Maya Santos/ }).getAttribute('href'))
      .toBe('/companion-profile?companionProfileId=companion-1')
  })

  it('closes its results on Escape', () => {
    render(<HeaderSearch directory={directory} />)
    const input = screen.getByRole('searchbox')

    fireEvent.change(input, { target: { value: 'maya' } })
    expect(input.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: /Maya Santos/ })).toBeNull()
  })
})
