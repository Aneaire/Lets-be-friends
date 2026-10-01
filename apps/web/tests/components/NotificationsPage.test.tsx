// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  signedIn: true,
  status: 'Exhausted' as 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted',
  results: [] as Array<{
    id: string
    title: string
    body?: string
    createdAt: number
    tone?: string
    priority: 'attention' | 'standard'
    readAt?: number
  }>,
  open: vi.fn(),
  markRead: vi.fn(),
  markUnread: vi.fn(),
  markAllRead: vi.fn(),
  loadMore: vi.fn(),
}))

const sentinel = vi.hoisted(() => ({ inView: false }))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    notifications: {
      list: 'notifications.list',
      open: 'notifications.open',
      markRead: 'notifications.markRead',
      markUnread: 'notifications.markUnread',
      markAllRead: 'notifications.markAllRead',
    },
  },
}))

vi.mock('convex/react', () => ({
  usePaginatedQuery: () => ({ results: state.results, status: state.status, loadMore: state.loadMore }),
  useMutation: (mutation: string) => {
    if (mutation === 'notifications.open') return state.open
    if (mutation === 'notifications.markRead') return state.markRead
    if (mutation === 'notifications.markUnread') return state.markUnread
    if (mutation === 'notifications.markAllRead') return state.markAllRead
    return vi.fn()
  },
}))

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ isSignedIn: state.signedIn }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  useNavigate: () => vi.fn(),
}))

vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: sentinel.inView }),
}))

import { NotificationsPage } from '../../src/routes/notifications'

afterEach(cleanup)

beforeEach(() => {
  state.signedIn = true
  state.status = 'Exhausted'
  state.results = []
  state.open.mockReset()
  state.markRead.mockReset()
  state.markUnread.mockReset()
  state.markAllRead.mockReset()
  state.loadMore.mockReset()
  sentinel.inView = false
})

describe('notifications route', () => {
  it('gates signed-out visitors behind a sign-in button', () => {
    state.signedIn = false
    render(<NotificationsPage />)

    expect(screen.getByRole('heading', { name: 'Sign in to view notifications' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' }).tagName).toBe('BUTTON')
  })

  it('shows an empty state with a disabled mark-all-read control when nothing is unread', () => {
    render(<NotificationsPage />)

    expect(screen.getByRole('heading', { name: 'You are all caught up' })).toBeTruthy()
    expect((screen.getByRole('button', { name: /Mark all as read/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables mark all as read for unread items and marks every notification read', () => {
    state.results = [
      { id: 'n1', title: 'New booking request', body: 'Alex asked for Saturday.', createdAt: Date.now(), priority: 'attention' },
    ]
    render(<NotificationsPage />)

    const markAll = screen.getByRole('button', { name: /Mark all as read/ }) as HTMLButtonElement
    expect(markAll.disabled).toBe(false)
    fireEvent.click(markAll)
    expect(state.markAllRead).toHaveBeenCalledOnce()
    expect(screen.getByText('New booking request')).toBeTruthy()
  })

  it('loads more notifications automatically when the sentinel scrolls into view', async () => {
    sentinel.inView = true
    state.status = 'CanLoadMore'
    state.results = [
      { id: 'n2', title: 'Identity approved', createdAt: Date.now(), priority: 'standard', readAt: Date.now() },
    ]
    render(<NotificationsPage />)

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
    await waitFor(() => expect(state.loadMore).toHaveBeenCalledWith(30))
  })
})
