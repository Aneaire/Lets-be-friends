// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  decideParticipant: vi.fn(),
  requestJoin: vi.fn(),
  leave: vi.fn(),
  cancelGathering: vi.fn(),
  postInvite: vi.fn(),
  report: vi.fn(),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    gatherings: {
      get: 'gatherings.get',
      requestJoin: 'gatherings.requestJoin',
      leave: 'gatherings.leave',
      decideParticipant: 'gatherings.decideParticipant',
      cancel: 'gatherings.cancel',
      postInvite: 'gatherings.postInvite',
    },
    reports: { create: 'reports.create' },
  },
}))
vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mocks.query(...args),
  useMutation: (ref: string) => {
    if (ref === 'gatherings.decideParticipant') return mocks.decideParticipant
    if (ref === 'gatherings.requestJoin') return mocks.requestJoin
    if (ref === 'gatherings.leave') return mocks.leave
    if (ref === 'gatherings.cancel') return mocks.cancelGathering
    if (ref === 'gatherings.postInvite') return mocks.postInvite
    if (ref === 'reports.create') return mocks.report
    return vi.fn()
  },
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { GatheringWorkspacePage } from '../../src/features/gatherings/GatheringWorkspacePage'

function detail(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'gathering-new',
    hostUserId: 'user-host',
    hostDisplayName: 'Dana',
    companionProfileId: 'companion-1',
    companionUserId: 'user-companion',
    companionDisplayName: 'Rosa',
    companionCity: 'Cebu',
    circleId: undefined,
    category: 'Coffee or meal companion',
    mode: 'in_person' as const,
    startsAt: Date.now() + 86_400_000,
    durationMinutes: 60,
    capacity: 4,
    guestListVisibility: 'confirmed_only' as const,
    state: 'open' as const,
    bookingId: 'booking-1',
    bookingStatus: 'request_sent',
    memberTotalCentavos: 57_500,
    confirmedCount: 1,
    requestedCount: 1,
    seatsRemaining: 3,
    viewer: { isHost: true, isCompanion: false, participantState: null, canRequestJoin: false, canConfirm: true },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    participants: [
      { userId: 'guest-a', displayName: 'Alex', username: 'alex', profileImageUrl: undefined, state: 'requested' as const },
      { userId: 'guest-b', displayName: 'Bea', username: 'bea', profileImageUrl: undefined, state: 'confirmed' as const },
    ],
    ...overrides,
  }
}

afterEach(() => { cleanup(); vi.resetAllMocks() })

describe('Gathering workspace', () => {
  it('lets the host confirm a request and remove a confirmed guest', async () => {
    mocks.query.mockReturnValue(detail())
    mocks.decideParticipant.mockResolvedValue({})
    render(<GatheringWorkspacePage gatheringId="gathering-new" />)

    expect(screen.getByRole('heading', { name: 'Coffee or meal companion' })).toBeTruthy()
    expect(screen.getByText('You are hosting this Gathering.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Confirm/ }))
    await waitFor(() => expect(mocks.decideParticipant).toHaveBeenCalledWith({ gatheringId: 'gathering-new', userId: 'guest-a', decision: 'confirmed' }))

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(mocks.decideParticipant).toHaveBeenCalledWith({ gatheringId: 'gathering-new', userId: 'guest-b', decision: 'removed' }))
  })

  it('lets an eligible member request a seat', async () => {
    mocks.query.mockReturnValue(detail({
      viewer: { isHost: false, isCompanion: false, participantState: null, canRequestJoin: true, canConfirm: false },
      participants: [],
    }))
    mocks.requestJoin.mockResolvedValue({ status: 'requested' })
    render(<GatheringWorkspacePage gatheringId="gathering-new" />)

    fireEvent.click(screen.getByRole('button', { name: /Request to join/ }))
    await waitFor(() => expect(mocks.requestJoin).toHaveBeenCalledWith({ gatheringId: 'gathering-new' }))
  })

  it('cancels the Gathering after confirmation', async () => {
    mocks.query.mockReturnValue(detail())
    mocks.cancelGathering.mockResolvedValue({ status: 'cancelled', idempotent: false })
    render(<GatheringWorkspacePage gatheringId="gathering-new" />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Gathering' }))
    const confirm = screen.getAllByRole('button', { name: 'Cancel Gathering' }).at(-1)!
    fireEvent.click(confirm)
    await waitFor(() => expect(mocks.cancelGathering).toHaveBeenCalledWith(expect.objectContaining({ gatheringId: 'gathering-new' })))
  })

  it('shows a cancelled state without host controls', () => {
    mocks.query.mockReturnValue(detail({ state: 'cancelled', viewer: { isHost: true, isCompanion: false, participantState: null, canRequestJoin: false, canConfirm: false } }))
    render(<GatheringWorkspacePage gatheringId="gathering-new" />)

    expect(screen.getByText('Cancelled')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cancel Gathering' })).toBeNull()
    expect(screen.getByText('This Gathering was cancelled. Reserved host funds are released.')).toBeTruthy()
  })
})
