// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  search: { conversationId: 'conversation-1' } as { conversationId?: string },
  navigate: vi.fn(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    conversations: {
      list: 'conversations.list',
      messages: 'conversations.messages',
      markRead: 'conversations.markRead',
      sendMessage: 'conversations.sendMessage',
      generateAttachmentUploadUrl: 'conversations.generateAttachmentUploadUrl',
      registerAttachmentUpload: 'conversations.registerAttachmentUpload',
      discardAttachmentUpload: 'conversations.discardAttachmentUpload',
    },
    users: { viewer: 'users.viewer' },
    reports: { create: 'reports.create' },
    bookings: { companionDecision: 'bookings.companionDecision', editRequest: 'bookings.editRequest' },
    companions: { getPublic: 'companions.getPublic' },
  },
}))

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isSignedIn: true }),
  SignInButton: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, useSearch: () => mocks.search }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mocks.navigate,
}))

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mocks.query(...args),
  useMutation: (...args: unknown[]) => mocks.mutation(...args),
}))

import { MessagesPage } from '../../src/routes/messages'
import type { BookingRequestView } from '../../src/features/booking/BookingRequestCard'

const viewer = { _id: 'viewer-1' as Id<'users'>, displayName: 'Viewer' }

function booking(bookingId: string, category: string, status: BookingRequestView['status']): BookingRequestView {
  return {
    bookingId: bookingId as Id<'bookings'>,
    status,
    category,
    mode: 'online',
    requestedAt: new Date('2026-08-12T13:39:00+08:00').getTime(),
    durationMinutes: 60,
    memberId: 'member-1' as Id<'users'>,
    memberDisplayName: 'Angelo',
    companionDisplayName: 'Michael Reeves',
    settlementBlocked: false,
  }
}

function threadFor(conversationId: string, currentBooking: BookingRequestView) {
  return {
    conversation: {
      _id: conversationId,
      otherUserId: 'other-1' as Id<'users'>,
      otherDisplayName: 'Michael Reeves',
      otherProfileImageUrl: undefined,
      otherUserSuspended: false,
    },
    messages: [
      {
        _id: `message-${conversationId}-1` as Id<'directMessages'>,
        body: 'Michael sent a booking request with the session details.',
        createdAt: Date.now() - 60000,
        sentByViewer: false,
        attachments: [],
        booking: currentBooking,
      },
      {
        _id: `message-${conversationId}-2` as Id<'directMessages'>,
        body: 'Looking forward to it.',
        createdAt: Date.now(),
        sentByViewer: true,
        attachments: [],
        booking: currentBooking,
      },
    ],
  }
}

const conversationOneThread = threadFor('conversation-1', booking('booking-one', 'Hobbies and skills', 'accepted'))
const conversationTwoThread = threadFor('conversation-2', booking('booking-two', 'Coffee meetup', 'request_sent'))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  mocks.search = { conversationId: 'conversation-1' }
  mocks.mutation.mockReturnValue(vi.fn().mockResolvedValue(undefined))
  mocks.query.mockImplementation((key: string, args?: { conversationId?: string }) => {
    if (key === 'conversations.list') {
      return [
        { _id: 'conversation-1', otherDisplayName: 'Michael Reeves', otherUserSuspended: false, unreadCount: 0 },
        { _id: 'conversation-2', otherDisplayName: 'Michael Reeves', otherUserSuspended: false, unreadCount: 0 },
      ]
    }
    if (key === 'users.viewer') return viewer
    if (key === 'conversations.messages') {
      if (args?.conversationId === 'conversation-2') return conversationTwoThread
      return conversationOneThread
    }
    return undefined
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Messages pinned booking area', () => {
  it('renders one pinned card directly below the header and above the scrolling list', () => {
    render(<MessagesPage />)

    const directThread = document.querySelector('.direct-thread')
    const header = document.querySelector('.direct-thread-header')
    const slot = document.querySelector('.direct-thread-pin-slot')
    const list = document.querySelector('.direct-message-list')
    expect(directThread).toBeTruthy()
    expect(header).toBeTruthy()
    expect(slot).toBeTruthy()
    expect(list).toBeTruthy()

    expect(header!.compareDocumentPosition(slot!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(slot!.compareDocumentPosition(list!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(slot!.getAttribute('data-active')).toBe('true')
    expect(screen.getByRole('region', { name: 'Current booking' })).toBeTruthy()
  })

  it('keeps full booking cards out of the scrolling message stream', () => {
    render(<MessagesPage />)

    const list = document.querySelector('.direct-message-list')!
    expect(list.querySelectorAll('.booking-request-card')).toHaveLength(0)
    expect(list.querySelectorAll('.direct-booking')).toHaveLength(0)
    expect(list.querySelectorAll('.booking-update-line')).toHaveLength(2)

    const pinned = screen.getByRole('region', { name: 'Current booking' })
    expect(pinned.querySelectorAll('.booking-request-card')).toHaveLength(1)
  })

  it('hides the pinned card on dismiss and keeps it hidden for the same booking', () => {
    const { rerender } = render(<MessagesPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Hide current booking' }))

    expect(screen.queryByRole('region', { name: 'Current booking' })).toBeNull()
    expect(document.querySelector('.direct-thread-pin-slot')!.getAttribute('data-active')).toBeNull()

    rerender(<MessagesPage />)
    expect(screen.queryByRole('region', { name: 'Current booking' })).toBeNull()
  })

  it('resets dismissal when the conversation changes', () => {
    const { rerender } = render(<MessagesPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Hide current booking' }))
    expect(screen.queryByRole('region', { name: 'Current booking' })).toBeNull()

    mocks.search = { conversationId: 'conversation-2' }
    rerender(<MessagesPage />)

    const pinned = screen.getByRole('region', { name: 'Current booking' })
    expect(pinned.textContent).toContain('Coffee meetup')
  })
})
