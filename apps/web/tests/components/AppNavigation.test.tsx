// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const navigationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  query: vi.fn(),
  mutation: vi.fn(),
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
  useRouterState: vi.fn(),
  useNavigate: () => navigationMocks.navigate,
}))

// Header search queries the bounded server directory; the fallback directory
// prop keeps these interaction tests deterministic without a Convex provider.
vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => navigationMocks.query(...args),
  useMutation: (...args: unknown[]) => navigationMocks.mutation(...args),
}))

import { AccountAvatar, DesktopPrimaryNavigation, HeaderPrimaryActions, HeaderSearch, MobilePrimaryNavigation, NotificationNavigation, type HeaderSearchPerson } from '../../src/design-system/templates/AppNavigation'

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

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

describe('notification navigation', () => {
  it('reports an open failure without navigating or rejecting the click handler', async () => {
    let queryIndex = 0
    let mutationIndex = 0
    const openNotification = vi.fn().mockRejectedValue(new Error('Network unavailable'))
    navigationMocks.query.mockImplementation(() => {
      const values = [1, [{
        id: 'notification-1',
        title: 'New follower',
        body: 'Alex followed you.',
        tone: 'social',
        priority: 'standard',
        destination: { type: 'profile', userId: 'alex' },
        targetAvailable: true,
        createdAt: Date.now(),
      }], []]
      return values[queryIndex++ % values.length]
    })
    navigationMocks.mutation.mockImplementation(() => {
      const values = [openNotification, vi.fn()]
      return values[mutationIndex++ % values.length]
    })

    render(<NotificationNavigation />)
    fireEvent.click(screen.getByRole('button', { name: /Open notifications/ }))
    fireEvent.click(screen.getByRole('button', { name: /New follower/ }))

    expect((await screen.findByRole('alert')).textContent).toBe('The notification could not be opened. Try again.')
    await waitFor(() => expect(openNotification).toHaveBeenCalledWith({ notificationId: 'notification-1' }))
    expect(navigationMocks.navigate).not.toHaveBeenCalled()
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

describe('primary navigation surfaces', () => {
  it('adds Circles to the desktop rail', () => {
    render(<DesktopPrimaryNavigation activeItem="home" />)

    const nav = screen.getByRole('navigation', { name: /primary navigation/i })
    expect(nav.querySelectorAll('a.primary-nav-link')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Explore' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Circles' }).getAttribute('href')).toBe('/circles')
    expect(screen.queryByRole('link', { name: 'Messages' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Bookings' })).toBeNull()
  })

  it('marks Circles active on desktop while mobile stays on frequent destinations', () => {
    render(<DesktopPrimaryNavigation activeItem="circles" />)
    expect(screen.getByRole('link', { name: 'Circles' }).getAttribute('aria-current')).toBe('page')

    cleanup()
    render(<MobilePrimaryNavigation activeItem="circles" accountOpen={false} accountActive={false} onOpenAccount={() => {}} />)
    expect(screen.getByRole('navigation', { name: /mobile primary navigation/i }).querySelectorAll('a.mobile-primary-nav-item')).toHaveLength(4)
    expect(screen.queryByRole('link', { name: 'Circles' })).toBeNull()
  })

  it('keeps Messages and Bookings in the mobile bottom tabs', () => {
    render(<MobilePrimaryNavigation activeItem="messages" accountOpen={false} accountActive={false} onOpenAccount={() => {}} />)

    const nav = screen.getByRole('navigation', { name: /mobile primary navigation/i })
    expect(nav.querySelectorAll('a.mobile-primary-nav-item')).toHaveLength(4)
    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Explore' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Circles' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Messages' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Bookings' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy()
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
