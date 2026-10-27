// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manilaDateParts } from '@lets-be-friends/shared'
import { formatManilaDayLabel, formatManilaTime, getManilaMonth, schedulingMonthKey } from '../../src/features/scheduling/scheduling'

const companionProfile = {
  _id: 'companion-1',
  userId: 'user-companion',
  displayName: 'Dana Cruz',
  firstName: 'Dana',
  username: 'dana',
  city: 'Manila',
  mode: 'both',
  intro: 'I can help with errands and everyday plans.',
  bio: '',
  profileImageUrl: undefined,
  hourlyRateCentavos: 50_000,
  strengths: ['Errands'],
  categories: ['Coffee walks'],
  boundaries: [],
  rating: 5,
  reviewCount: 2,
  bookable: true,
  viewerCanBook: true,
  viewerBookingEligibility: 'eligible',
  saved: false,
  following: false,
}

const state = vi.hoisted(() => ({
  companion: undefined as Record<string, unknown> | null | undefined,
  navigate: vi.fn(),
  createDraft: vi.fn(),
  availability: 'available' as string | undefined,
  slots: { timezone: 'Asia/Manila', scheduleConfigured: true, days: [] as Array<{ date: string; startsAt: number[] }> },
  queries: [] as string[],
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    users: { viewer: 'users.viewer', latestMemberVerification: 'users.latestMemberVerification' },
    bookings: { createDraft: 'bookings.createDraft', availableSlots: 'bookings.availableSlots' },
    notificationMutes: { mine: 'notificationMutes.mine', setMuted: 'notificationMutes.setMuted' },
    companions: {
      getPublic: 'companions.getPublic',
      bookingAvailability: 'companions.bookingAvailability',
      toggleSaveProfile: 'companions.toggleSaveProfile',
    },
    reviews: {
      forCompanion: 'reviews.forCompanion',
      requested: 'reviews.requested',
      toggleSave: 'reviews.toggleSave',
      toggleLike: 'reviews.toggleLike',
      createComment: 'reviews.createComment',
      deleteComment: 'reviews.deleteComment',
    },
    social: {
      byUser: 'social.byUser',
      toggleFollow: 'social.toggleFollow',
      toggleLike: 'social.toggleLike',
      toggleSavePost: 'social.toggleSavePost',
      createPost: 'social.createPost',
      editPost: 'social.editPost',
      deletePost: 'social.deletePost',
      voteOnPoll: 'social.voteOnPoll',
    },
    reports: { create: 'reports.create' },
    conversations: { start: 'conversations.start' },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: (query: string) => {
    state.queries.push(query)
    if (query === 'companions.getPublic') return state.companion
    if (query === 'companions.bookingAvailability') return state.availability
    if (query === 'bookings.availableSlots') return state.slots
    if (query === 'reviews.forCompanion') return []
    if (query === 'reviews.requested') return null
    if (query === 'social.byUser') return []
    return undefined
  },
  useMutation: (name: string) => (name === 'bookings.createDraft' ? state.createDraft : vi.fn(async () => undefined)),
}))

vi.mock('@clerk/react', () => ({
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ isSignedIn: true, userId: 'user-1' }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({ ...options, useSearch: () => ({ companionProfileId: 'companion-1' }) }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => state.navigate,
}))

vi.mock('../../src/features/profile/ProfileContentPanel', () => ({
  ProfileContentPanel: () => <div data-testid="profile-content" />,
}))

import { Route } from '../../src/routes/companion-profile'

const CompanionProfilePage = (Route as unknown as { component: () => ReactNode }).component

function planFutureStart() {
  // Slots are 15-minute Manila starts, so align the fixture the same way.
  const stepMs = 15 * 60 * 1000
  const start = Math.ceil((Date.now() + 24 * 60 * 60 * 1000) / stepMs) * stepMs
  const parts = manilaDateParts(start)
  return {
    start,
    date: parts.date,
    monthKey: `${parts.year}-${String(parts.month).padStart(2, '0')}`,
  }
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Book a time' }))
}

async function chooseAvailableStart(start: number, date: string, monthKey: string) {
  if (schedulingMonthKey(getManilaMonth()) !== monthKey) {
    fireEvent.click(await screen.findByRole('button', { name: 'Next month' }))
  }
  const dayLabel = formatManilaDayLabel(date)
  fireEvent.click(await screen.findByRole('gridcell', { name: `${dayLabel}, 1 open time` }))
  fireEvent.click(await screen.findByRole('button', { name: `${formatManilaTime(start)}, 1 hr session` }))
}

beforeEach(() => {
  state.companion = { ...companionProfile }
  state.availability = 'available'
  state.slots = { timezone: 'Asia/Manila', scheduleConfigured: true, days: [] }
  state.queries = []
  state.createDraft = vi.fn(async () => ({
    bookingId: 'booking-123456',
    memberTotalCentavos: 60_000,
    serviceSubtotalCentavos: 55_000,
    memberBookingFeeCentavos: 5_000,
    currency: 'PHP',
  }))
  state.navigate = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Companion profile booking dialog', () => {
  it('opens the shared booking dialog on the profile without navigating and without the discovery list', async () => {
    render(<CompanionProfilePage />)

    openDialog()

    expect(state.navigate).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog', { name: 'Book with Dana' })).toBeTruthy()
    // The availability calendar is visible before any interaction with the profile.
    expect(await screen.findByRole('region', { name: /availability calendar/i })).toBeTruthy()
    expect(state.queries).not.toContain('companions.listApproved')
    // The free-text Date and Time controls were removed in favor of the picker.
    expect(screen.queryByLabelText('Booking date')).toBeNull()
    expect(screen.queryByLabelText('Time')).toBeNull()
  })

  it('closes on Escape, restores focus to the trigger, and stays on the profile', async () => {
    render(<CompanionProfilePage />)

    const trigger = screen.getByRole('button', { name: 'Book a time' })
    fireEvent.click(trigger)
    expect(await screen.findByRole('dialog', { name: 'Book with Dana' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('sends the exact chosen start and stays on the profile after success', async () => {
    const plan = planFutureStart()
    state.slots = {
      timezone: 'Asia/Manila',
      scheduleConfigured: true,
      days: [{ date: plan.date, startsAt: [plan.start] }],
    }

    render(<CompanionProfilePage />)
    openDialog()
    await chooseAvailableStart(plan.start, plan.date, plan.monthKey)

    const send = screen.getByRole('button', { name: 'Send booking' })
    expect((send as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(send)

    await waitFor(() => expect(state.createDraft).toHaveBeenCalledTimes(1))
    expect(state.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      companionProfileId: 'companion-1',
      requestedAt: plan.start,
      durationMinutes: 60,
    }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(state.navigate).not.toHaveBeenCalled()
    expect(await screen.findByText(/sent for/)).toBeTruthy()
  })

  it('keeps the dialog open and surfaces a failed submission without navigating', async () => {
    const plan = planFutureStart()
    state.slots = {
      timezone: 'Asia/Manila',
      scheduleConfigured: true,
      days: [{ date: plan.date, startsAt: [plan.start] }],
    }
    state.createDraft = vi.fn(async () => {
      throw new Error('Companion is not available for booking')
    })

    render(<CompanionProfilePage />)
    openDialog()
    await chooseAvailableStart(plan.start, plan.date, plan.monthKey)

    fireEvent.click(screen.getByRole('button', { name: 'Send booking' }))

    expect(await screen.findByText('Companion is not available for booking')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Book with Dana' })).toBeTruthy()
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('blocks a direct form submit while the Companion availability query is still pending', async () => {
    const plan = planFutureStart()
    state.slots = {
      timezone: 'Asia/Manila',
      scheduleConfigured: true,
      days: [{ date: plan.date, startsAt: [plan.start] }],
    }
    state.availability = undefined

    render(<CompanionProfilePage />)
    openDialog()
    const form = document.querySelector('form.booking-dialog-body') as HTMLFormElement
    fireEvent.submit(form)

    expect(state.createDraft).not.toHaveBeenCalled()
    expect(await screen.findByText('Wait for the Companion availability to finish loading before sending this booking.')).toBeTruthy()
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('blocks a direct form submit while the Companion is confirmed unavailable', async () => {
    const plan = planFutureStart()
    state.slots = {
      timezone: 'Asia/Manila',
      scheduleConfigured: true,
      days: [{ date: plan.date, startsAt: [plan.start] }],
    }
    state.availability = 'unavailable'

    render(<CompanionProfilePage />)
    openDialog()
    const form = document.querySelector('form.booking-dialog-body') as HTMLFormElement
    fireEvent.submit(form)

    expect(state.createDraft).not.toHaveBeenCalled()
    expect(await screen.findByText('This Companion is not available for new bookings right now.')).toBeTruthy()
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('ignores a second direct form submit while the first send is in flight', async () => {
    const plan = planFutureStart()
    state.slots = {
      timezone: 'Asia/Manila',
      scheduleConfigured: true,
      days: [{ date: plan.date, startsAt: [plan.start] }],
    }
    let resolveDraft: (value: unknown) => void = () => {}
    state.createDraft = vi.fn(() => new Promise((resolve) => { resolveDraft = resolve }))

    render(<CompanionProfilePage />)
    openDialog()
    await chooseAvailableStart(plan.start, plan.date, plan.monthKey)

    const form = document.querySelector('form.booking-dialog-body') as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)

    await waitFor(() => expect(state.createDraft).toHaveBeenCalledTimes(1))

    resolveDraft({ bookingId: 'booking-123456', memberTotalCentavos: 60_000, serviceSubtotalCentavos: 55_000, memberBookingFeeCentavos: 5_000, currency: 'PHP' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('drops a chosen start when the Companion availability query turns unavailable', async () => {
    const plan = planFutureStart()
    state.slots = {
      timezone: 'Asia/Manila',
      scheduleConfigured: true,
      days: [{ date: plan.date, startsAt: [plan.start] }],
    }

    const view = render(<CompanionProfilePage />)
    openDialog()
    await chooseAvailableStart(plan.start, plan.date, plan.monthKey)
    expect((screen.getByRole('button', { name: 'Send booking' }) as HTMLButtonElement).disabled).toBe(false)

    state.availability = 'unavailable'
    view.rerender(<CompanionProfilePage />)

    await waitFor(() => expect((screen.getByRole('button', { name: 'Send booking' }) as HTMLButtonElement).disabled).toBe(true))
  })

  it('clears the chosen start when the session length changes', async () => {
    const plan = planFutureStart()
    state.slots = {
      timezone: 'Asia/Manila',
      scheduleConfigured: true,
      days: [{ date: plan.date, startsAt: [plan.start] }],
    }

    render(<CompanionProfilePage />)
    openDialog()
    await chooseAvailableStart(plan.start, plan.date, plan.monthKey)
    expect((screen.getByRole('button', { name: 'Send booking' }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.change(screen.getByRole('combobox', { name: /Duration/i }), { target: { value: '120' } })

    expect((screen.getByRole('button', { name: 'Send booking' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('never offers a sendable time while the Companion has no shared schedule', async () => {
    state.slots = { timezone: 'Asia/Manila', scheduleConfigured: false, days: [] }

    render(<CompanionProfilePage />)
    openDialog()

    expect(await screen.findByText('This Companion has not shared a weekly schedule yet.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send booking' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows a rate notice instead of a booking button before a rate is configured', () => {
    state.companion = { ...companionProfile, bookable: false }

    render(<CompanionProfilePage />)

    expect(screen.getByText('Rate not configured')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Book a time' })).toBeNull()
  })

  it('keeps verification and sign-in gating on the profile action', () => {
    state.companion = { ...companionProfile, viewerBookingEligibility: 'verification_required' }
    const { unmount } = render(<CompanionProfilePage />)
    expect(screen.getByRole('link', { name: 'Verify before booking' }).getAttribute('href')).toBe('/verify-identity')
    unmount()
  })
})
