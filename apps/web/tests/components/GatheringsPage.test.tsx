// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn(), postInvite: vi.fn(), navigate: vi.fn() }))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    gatherings: { mine: 'gatherings.mine', get: 'gatherings.get', create: 'gatherings.create', postInvite: 'gatherings.postInvite' },
    companions: { listApproved: 'companions.listApproved' },
    circles: { mine: 'circles.mine' },
    reports: { create: 'reports.create' },
  },
}))
vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mocks.query(...args),
  useMutation: (ref: string) => (ref === 'gatherings.create' ? mocks.create : ref === 'gatherings.postInvite' ? mocks.postInvite : vi.fn()),
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mocks.navigate,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/design-system/organisms/Calendar', () => ({
  Calendar: ({ onChange }: { onChange: (date: Date) => void }) => (
    <button type="button" onClick={() => onChange(new Date(Date.now() + 86_400_000))}>Pick date</button>
  ),
}))

import { GatheringsPage } from '../../src/features/gatherings/GatheringsPage'

const companion = {
  _id: 'companion-1',
  displayName: 'Rosa',
  city: 'Cebu',
  categories: ['Coffee or meal companion'],
  mode: 'both' as const,
  bookable: true,
  viewerCanBook: true,
}

const hostingGathering = {
  _id: 'gathering-host',
  hostUserId: 'user-host',
  hostDisplayName: 'Dana',
  companionProfileId: 'companion-1',
  companionDisplayName: 'Rosa',
  companionCity: 'Cebu',
  category: 'Coffee or meal companion',
  mode: 'in_person' as const,
  startsAt: Date.now() + 86_400_000,
  durationMinutes: 90,
  capacity: 4,
  guestListVisibility: 'confirmed_only' as const,
  state: 'open' as const,
  confirmedCount: 2,
  requestedCount: 1,
  seatsRemaining: 2,
  viewer: { isHost: true, isCompanion: false, participantState: null, canRequestJoin: false, canConfirm: true },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const joinedGathering = {
  ...hostingGathering,
  _id: 'gathering-joined',
  category: 'Weekend photography',
  state: 'closed' as const,
  viewer: { isHost: false, isCompanion: false, participantState: 'confirmed' as const, canRequestJoin: false, canConfirm: false },
}

afterEach(() => { cleanup(); vi.resetAllMocks() })

function mockQueries() {
  mocks.query.mockImplementation((ref: string) => {
    if (ref === 'gatherings.mine') return [hostingGathering, joinedGathering]
    if (ref === 'companions.listApproved') return [companion]
    if (ref === 'circles.mine') return []
    return undefined
  })
}

describe('Gatherings index', () => {
  it('lists hosting and joined Gatherings with seat and state labels', () => {
    mockQueries()
    render(<GatheringsPage />)

    expect(screen.getByRole('heading', { name: 'Hosting' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Joined' })).toBeTruthy()
    expect(screen.getByText('Coffee or meal companion')).toBeTruthy()
    expect(screen.getByText('Weekend photography')).toBeTruthy()
    expect(screen.getAllByText('2/4 confirmed').length).toBeGreaterThan(0)
    expect(screen.getByText('Closed')).toBeTruthy()
  })

  it('creates a host-funded Gathering and posts a profile Invite', async () => {
    mockQueries()
    mocks.create.mockResolvedValue({ gatheringId: 'gathering-new', bookingId: 'booking-1', memberTotalCentavos: 57500 })
    mocks.postInvite.mockResolvedValue('post-1')
    mocks.navigate.mockResolvedValue(undefined)
    render(<GatheringsPage />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Create Gathering' })[0])
    fireEvent.change(screen.getByLabelText(/^Companion/), { target: { value: 'companion-1' } })
    expect((screen.getByLabelText('Experience') as HTMLSelectElement).value).toBe('Coffee or meal companion')
    fireEvent.click(screen.getByRole('button', { name: 'Pick date' }))
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Invite message (optional)'), { target: { value: 'Come join my coffee Gathering.' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Gathering' }).at(-1)!)

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      companionProfileId: 'companion-1',
      category: 'Coffee or meal companion',
      mode: 'online',
      durationMinutes: 60,
      capacity: 4,
    })))
    expect(mocks.postInvite).toHaveBeenCalledWith(expect.objectContaining({
      gatheringId: 'gathering-new',
      body: 'Come join my coffee Gathering.',
      circleId: undefined,
    }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/gatherings/$gatheringId', params: { gatheringId: 'gathering-new' } })
  })

  it('announces a creation failure without navigating', async () => {
    mockQueries()
    mocks.create.mockRejectedValue(new Error('Insufficient booking balance.'))
    render(<GatheringsPage />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Create Gathering' })[0])
    fireEvent.change(screen.getByLabelText(/^Companion/), { target: { value: 'companion-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pick date' }))
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '10:00' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Gathering' }).at(-1)!)

    expect((await screen.findByRole('alert')).textContent).toContain('Insufficient booking balance.')
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
