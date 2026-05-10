import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { activityCategories } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { WorkspaceShell } from '../components/AppShell'

export const Route = createFileRoute('/app')({
  validateSearch: (search: Record<string, unknown>): { hostProfileId?: string } => (
    typeof search.hostProfileId === 'string' ? { hostProfileId: search.hostProfileId } : {}
  ),
  component: AppPage,
})

type ApprovedHostOption = {
  _id: string
  displayName: string
  city: string
  mode: 'online' | 'in_person' | 'both'
  categories?: string[]
  bookable?: boolean
  demo?: boolean
}

type BookingStatus =
  | 'verification_required'
  | 'request_sent'
  | 'accepted'
  | 'declined'
  | 'completed'
  | 'review_window'
  | 'closed'

const statusCopy: Record<BookingStatus, { label: string; tone: 'self' | 'social' | 'success' | 'warning' | 'danger' }> = {
  verification_required: { label: 'Verification required', tone: 'warning' },
  request_sent: { label: 'Request sent', tone: 'social' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  completed: { label: 'Completed', tone: 'success' },
  review_window: { label: 'Review window open', tone: 'social' },
  closed: { label: 'Closed', tone: 'self' },
}

function AppPage() {
  const { hostProfileId } = Route.useSearch()
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const viewer = useQuery(api.users.viewer)
  const bookings = useQuery(api.bookings.mine, viewer ? {} : 'skip')
  const approvedHosts = useQuery(api.hosts.listApproved) as ApprovedHostOption[] | undefined
  const bookableHosts = useMemo(() => (approvedHosts ?? []).filter((host) => host.bookable && !host.demo), [approvedHosts])
  const ensureUser = useMutation(api.users.ensureViewer)
  const createDraft = useMutation(api.bookings.createDraft)
  const sendMessage = useMutation(api.bookings.sendMessage)
  const submitReview = useMutation(api.reviews.submit)
  const report = useMutation(api.reports.create)
  const [notice, setNotice] = useState('')

  if (!isSignedIn) {
    return (
      <main className="marketing-page">
        <p className="eyebrow">Sign in required</p>
        <h1 className="text-h1 mt-2">Sign in to open your workspace.</h1>
        <p className="lede mt-2">Bookings, messages, and verification status live behind a verified account.</p>
        <div className="mt-6">
          <SignInButton mode="modal">
            <button className="btn btn-self">Sign in</button>
          </SignInButton>
        </div>
      </main>
    )
  }

  const openBookings = (bookings ?? []).filter((booking) =>
    ['request_sent', 'accepted', 'verification_required'].includes(booking.status),
  ).length
  const completedBookings = (bookings ?? []).filter((booking) =>
    ['completed', 'review_window', 'closed', 'declined'].includes(booking.status),
  ).length

  const verificationLabel = viewer
    ? viewer.verificationStatus === 'approved'
      ? 'Verified'
      : viewer.verificationStatus === 'pending'
        ? 'Pending review'
        : 'Not started'
    : 'Loading'

  const verificationTone =
    viewer?.verificationStatus === 'approved' ? 'success'
    : viewer?.verificationStatus === 'pending' ? 'warning'
    : 'self'

  return (
    <WorkspaceShell
      eyebrow="Member workspace"
      title="Bookings and messages"
      description={
        viewer
          ? `Signed in as ${viewer.displayName}. Identity status visible on the right.`
          : 'Sync your profile to Convex to start booking.'
      }
      actions={
        <button
          onClick={() => ensureUser({ displayName: user?.fullName ?? user?.username ?? 'New friend' })}
          className="btn btn-neutral btn-sm"
        >
          Sync profile
        </button>
      }
      rail={
        <>
          <div className="rail-section">
            <div className="rail-section-title">Workspace</div>
            <a href="#bookings" className="rail-link is-active">
              <span>Bookings</span>
              <span className="rail-link-count tabular">{openBookings}</span>
            </a>
            <a href="#new-booking" className="rail-link">
              <span>Start a booking</span>
            </a>
            <a href="#archive" className="rail-link">
              <span>Past bookings</span>
              <span className="rail-link-count tabular">{completedBookings}</span>
            </a>
          </div>
          <div className="rail-section">
            <div className="rail-section-title">Account</div>
            <div className="rail-link" aria-disabled="true" style={{ cursor: 'default' }}>
              <span>Identity</span>
              <span className="status-pill" data-tone={verificationTone}>{verificationLabel}</span>
            </div>
            <Link to="/become-host" className="rail-link">
              <span>Host application</span>
            </Link>
            <Link to="/safety" className="rail-link">
              <span>Safety model</span>
            </Link>
          </div>
        </>
      }
    >
      {notice && (
        <div className="notice notice-success mb-6">
          <span className="notice-icon">✓</span>
          <span>{notice}</span>
        </div>
      )}

      <div className="drawer-host">
        <div className="min-w-0">
          <section id="bookings">
            <header className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="text-h2">Open bookings</h2>
              <span className="text-meta tabular">{openBookings} active</span>
            </header>
            {viewer === undefined && <div className="empty-state">Loading your profile…</div>}
            {viewer === null && (
              <div className="notice notice-warning">
                <span className="notice-icon">!</span>
                <span>Sync your profile first. Bookings appear here once your Convex profile exists.</span>
              </div>
            )}
            {viewer && (bookings ?? []).length === 0 && (
              <div className="empty-state">
                <p className="empty-state-title">No bookings yet.</p>
                <p className="text-meta max-w-[44ch]">
                  Pick an approved Friend Host on the right to send your first request.
                </p>
              </div>
            )}
            {(bookings ?? []).filter((booking) =>
              ['request_sent', 'accepted', 'verification_required'].includes(booking.status),
            ).length > 0 && (
              <div className="panel mt-2">
                <div className="worklist">
                  {(bookings ?? [])
                    .filter((booking) =>
                      ['request_sent', 'accepted', 'verification_required'].includes(booking.status),
                    )
                    .map((booking) => (
                      <BookingRow
                        key={booking._id}
                        booking={booking}
                        onSendMessage={async (body) => {
                          await sendMessage({ bookingId: booking._id, body })
                          setNotice('Message sent.')
                        }}
                        onReview={async (rating, body) => {
                          await submitReview({ bookingId: booking._id, rating, body })
                          setNotice('Review submitted.')
                        }}
                        onReport={async () => {
                          await report({ targetType: 'booking', targetId: booking._id, reason: 'Needs admin review' })
                          setNotice('Report sent to the admin queue.')
                        }}
                      />
                    ))}
                </div>
              </div>
            )}
          </section>

          {(bookings ?? []).filter((booking) =>
            ['completed', 'review_window', 'closed', 'declined'].includes(booking.status),
          ).length > 0 && (
            <section id="archive" className="mt-10">
              <header className="flex items-baseline justify-between gap-3 mb-3">
                <h2 className="text-h2">Past bookings</h2>
                <span className="text-meta tabular">{completedBookings}</span>
              </header>
              <div className="panel">
                <div className="worklist">
                  {(bookings ?? [])
                    .filter((booking) =>
                      ['completed', 'review_window', 'closed', 'declined'].includes(booking.status),
                    )
                    .map((booking) => (
                      <BookingRow
                        key={booking._id}
                        booking={booking}
                        onSendMessage={async (body) => {
                          await sendMessage({ bookingId: booking._id, body })
                          setNotice('Message sent.')
                        }}
                        onReview={async (rating, body) => {
                          await submitReview({ bookingId: booking._id, rating, body })
                          setNotice('Review submitted.')
                        }}
                        onReport={async () => {
                          await report({ targetType: 'booking', targetId: booking._id, reason: 'Needs admin review' })
                          setNotice('Report sent to the admin queue.')
                        }}
                      />
                    ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <BookingDrawer
          createDraft={createDraft}
          ensureUser={ensureUser}
          hosts={bookableHosts}
          hostsLoading={approvedHosts === undefined}
          initialHostProfileId={hostProfileId}
          userName={user?.fullName ?? user?.username ?? 'New friend'}
          setNotice={setNotice}
        />
      </div>
    </WorkspaceShell>
  )
}

type Booking = NonNullable<ReturnType<typeof useQuery<typeof api.bookings.mine>>>[number]

function BookingRow({
  booking,
  onSendMessage,
  onReview,
  onReport,
}: {
  booking: Booking
  onSendMessage: (body: string) => Promise<void>
  onReview: (rating: number, body?: string) => Promise<void>
  onReport: () => Promise<void>
}) {
  const status = statusCopy[booking.status as BookingStatus] ?? { label: booking.status, tone: 'self' as const }
  const canChat = ['request_sent', 'accepted', 'completed', 'review_window'].includes(booking.status)
  const canReview = ['completed', 'review_window'].includes(booking.status)
  const messages = useQuery(api.bookings.messages, canChat ? { bookingId: booking._id } : 'skip')

  return (
    <article className="worklist-row">
      <div className="worklist-row-head">
        <div className="flex items-center gap-3 min-w-0">
          <span className="avatar" aria-hidden="true">
            {'hostDisplayName' in booking ? initials(booking.hostDisplayName as string) : '?'}
          </span>
          <div className="min-w-0">
            <h3 className="text-h3">{'hostDisplayName' in booking ? booking.hostDisplayName : 'Friend Host'}</h3>
            <div className="worklist-row-meta">
              <span>{booking.category}</span>
              <span className="dot" aria-hidden="true" />
              <span>{formatMode(booking.mode)}</span>
              {'hostCity' in booking && (
                <>
                  <span className="dot" aria-hidden="true" />
                  <span>{booking.hostCity}</span>
                </>
              )}
              <span className="dot" aria-hidden="true" />
              <span className="tabular">{formatRequestedAt(booking.requestedAt)}</span>
            </div>
          </div>
        </div>
        <span className="status-pill" data-tone={status.tone}>{status.label}</span>
      </div>

      {booking.status === 'verification_required' && (
        <div className="notice notice-warning text-meta">
          <span className="notice-icon">!</span>
          <span>Held until identity check passes. A placeholder Persona inquiry was created and is in the admin queue.</span>
        </div>
      )}

      {(canChat || canReview) && (
        <div className="worklist-row-actions">
          {canChat && (
            <form
              className="flex items-center gap-2 flex-1 min-w-[260px]"
              onSubmit={async (event) => {
                event.preventDefault()
                const form = event.currentTarget
                const data = new FormData(form)
                const body = String(data.get('body') ?? '').trim()
                if (!body) return
                await onSendMessage(body)
                form.reset()
              }}
            >
              <input name="body" className="field" placeholder="Send a chat message" />
              <button className="btn btn-social btn-sm">Send</button>
            </form>
          )}
          {canReview && <ReviewForm onReview={onReview} />}
          <button onClick={onReport} className="btn btn-danger btn-sm">
            Report
          </button>
        </div>
      )}
      {canChat && <MessageThread messages={messages ?? []} />}
    </article>
  )
}

function MessageThread({ messages }: { messages: Array<{ _id: string; body: string; createdAt: number }> }) {
  if (messages.length === 0) return null
  return (
    <div className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-3 space-y-2">
      <p className="text-tiny uppercase tracking-wide text-[color:var(--text-soft)]">Messages</p>
      {messages.slice(-5).map((message) => (
        <div key={message._id} className="text-meta">
          <span className="tabular text-soft">{formatRequestedAt(message.createdAt)}</span>
          <span className="mx-2 text-soft">·</span>
          <span>{message.body}</span>
        </div>
      ))}
    </div>
  )
}

function ReviewForm({ onReview }: { onReview: (rating: number, body?: string) => Promise<void> }) {
  return (
    <form
      className="flex items-center gap-2 flex-wrap"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        await onReview(Number(data.get('rating')), String(data.get('body') || '') || undefined)
        form.reset()
      }}
    >
      <select name="rating" className="field max-w-24" defaultValue="5" aria-label="Review rating">
        <option value="5">5★</option>
        <option value="4">4★</option>
        <option value="3">3★</option>
        <option value="2">2★</option>
        <option value="1">1★</option>
      </select>
      <input name="body" className="field min-w-[220px]" placeholder="Review note" />
      <button className="btn btn-social-quiet btn-sm">Leave review</button>
    </form>
  )
}

type BookingDrawerProps = {
  hosts: ApprovedHostOption[]
  hostsLoading: boolean
  initialHostProfileId?: string
  createDraft: (args: {
    hostProfileId: Id<'hostProfiles'>
    category: string
    mode: 'online' | 'in_person'
    requestedAt: number
    durationMinutes: number
    notes?: string
  }) => Promise<Id<'bookings'>>
  ensureUser: (args: { displayName: string }) => Promise<Id<'users'>>
  userName: string
  setNotice: (notice: string) => void
}

function BookingDrawer({ hosts, hostsLoading, initialHostProfileId, createDraft, ensureUser, userName, setNotice }: BookingDrawerProps) {
  const [selectedHostProfileId, setSelectedHostProfileId] = useState('')
  const selectedHost = hosts.find((host) => host._id === selectedHostProfileId)
  const categoryOptions = selectedHost?.categories?.length ? selectedHost.categories : activityCategories
  const [selectedMode, setSelectedMode] = useState<'online' | 'in_person'>('online')
  const modeOptions = useMemo<Array<'online' | 'in_person'>>(() => {
    if (selectedHost?.mode === 'in_person') return ['in_person']
    if (selectedHost?.mode === 'online') return ['online']
    return ['online', 'in_person']
  }, [selectedHost?.mode])

  useEffect(() => {
    setSelectedHostProfileId((current) => {
      if (current && hosts.some((host) => host._id === current)) return current
      if (initialHostProfileId && hosts.some((host) => host._id === initialHostProfileId)) return initialHostProfileId
      return hosts[0]?._id ?? ''
    })
  }, [hosts, initialHostProfileId])

  useEffect(() => {
    if (!modeOptions.includes(selectedMode)) setSelectedMode(modeOptions[0])
  }, [modeOptions, selectedMode])

  const canSubmit = selectedHostProfileId.length > 0

  return (
    <aside id="new-booking" className="drawer">
      <div className="drawer-header">
        <h2 className="text-h3">Start a booking</h2>
        <span className="text-meta">Step 1 of 1</span>
      </div>
      <form
        className="drawer-body"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!selectedHostProfileId) {
            setNotice('Choose an approved Friend Host before saving a booking.')
            return
          }
          const form = new FormData(event.currentTarget)
          await ensureUser({ displayName: userName })
          const bookingId = await createDraft({
            hostProfileId: selectedHostProfileId as Id<'hostProfiles'>,
            category: String(form.get('category')),
            mode: selectedMode,
            requestedAt: new Date(String(form.get('requestedAt'))).getTime(),
            durationMinutes: Number(form.get('durationMinutes')),
            notes: String(form.get('notes') || '') || undefined,
          })
          setNotice(`Booking ${bookingId.toString().slice(-6)} saved. Check the bookings list for next steps.`)
        }}
      >
        {!hostsLoading && hosts.length === 0 && (
          <div className="notice notice-warning text-meta">
            <span className="notice-icon">!</span>
            <span>No approved hosts yet. Approve one in the admin queue first.</span>
          </div>
        )}

        <label className="field-row">
          <span className="label">Friend Host</span>
          <select
            name="hostProfileId"
            value={selectedHostProfileId}
            onChange={(event) => setSelectedHostProfileId(event.currentTarget.value)}
            disabled={hostsLoading || hosts.length === 0}
            className="field"
            required
          >
            {hostsLoading && <option value="">Loading…</option>}
            {!hostsLoading && hosts.length === 0 && <option value="">No approved hosts</option>}
            {hosts.map((host) => (
              <option key={host._id} value={host._id}>
                {host.displayName} · {host.city}
              </option>
            ))}
          </select>
        </label>

        <label className="field-row">
          <span className="label">Category</span>
          <select name="category" className="field">
            {categoryOptions.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>

        <div className="grid gap-3 grid-cols-2">
          <label className="field-row">
            <span className="label">Mode</span>
            <select
              value={selectedMode}
              onChange={(event) => setSelectedMode(event.currentTarget.value as 'online' | 'in_person')}
              name="mode"
              className="field"
            >
              {modeOptions.includes('online') && <option value="online">Online</option>}
              {modeOptions.includes('in_person') && <option value="in_person">In person</option>}
            </select>
          </label>
          <label className="field-row">
            <span className="label">Duration <span className="label-aux">min</span></span>
            <input name="durationMinutes" type="number" min={15} step={15} required defaultValue="60" className="field" />
          </label>
        </div>

        <label className="field-row">
          <span className="label">When</span>
          <input
            name="requestedAt"
            type="datetime-local"
            required
            defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 16)}
            className="field"
          />
        </label>

        <label className="field-row">
          <span className="label">Notes <span className="label-aux">visible to host on accept</span></span>
          <textarea name="notes" className="field min-h-20" />
        </label>

        <button disabled={!canSubmit} className="btn btn-social btn-block">
          Send booking request
        </button>
        <p className="text-tiny">
          If identity is unverified, the booking is held in <code>verification_required</code> until
          admin review approves the placeholder Persona inquiry.
        </p>
      </form>
    </aside>
  )
}

function formatMode(mode: string) {
  if (mode === 'both') return 'Online and in-person'
  if (mode === 'in_person') return 'In-person'
  return 'Online'
}

function formatRequestedAt(timestamp: number) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
