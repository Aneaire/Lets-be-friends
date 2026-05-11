import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import type React from 'react'
import { api } from '../../convex/_generated/api'
import { WorkspaceShell } from '../components/AppShell'

export const Route = createFileRoute('/host')({ component: HostWorkspacePage })

type HostBookingStatus =
  | 'verification_required'
  | 'pending_admin_review'
  | 'request_sent'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed'
  | 'review_window'
  | 'closed'

const statusCopy: Record<HostBookingStatus, { label: string; tone: 'self' | 'social' | 'success' | 'warning' | 'danger' }> = {
  verification_required: { label: 'Verification required', tone: 'warning' },
  pending_admin_review: { label: 'Pending safety review', tone: 'warning' },
  request_sent: { label: 'Needs decision', tone: 'social' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  completed: { label: 'Completed', tone: 'success' },
  review_window: { label: 'Review window open', tone: 'social' },
  closed: { label: 'Closed', tone: 'self' },
}

function HostWorkspacePage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.hosts.myApplication)
  const bookings = useQuery(api.bookings.forHost, viewer ? {} : 'skip')
  const ensureUser = useMutation(api.users.ensureViewer)
  const decide = useMutation(api.bookings.hostDecision)
  const complete = useMutation(api.bookings.markCompleted)
  const sendMessage = useMutation(api.bookings.sendMessage)
  const report = useMutation(api.reports.create)
  const [notice, setNotice] = useState('')

  if (!isSignedIn) {
    return (
      <main className="marketing-page">
        <p className="eyebrow">Host workspace</p>
        <h1 className="text-h1 mt-2">Sign in to manage host requests.</h1>
        <p className="lede mt-2">Applications, booking decisions, and host messages stay behind your account.</p>
        <div className="mt-6">
          <SignInButton mode="modal">
            <button className="btn btn-self">Sign in</button>
          </SignInButton>
        </div>
      </main>
    )
  }

  const pendingCount = (bookings ?? []).filter((booking) => booking.status === 'request_sent').length
  const activeCount = (bookings ?? []).filter((booking) => ['request_sent', 'accepted'].includes(booking.status)).length
  const historyCount = (bookings ?? []).filter((booking) => ['declined', 'cancelled', 'completed', 'review_window', 'closed'].includes(booking.status)).length

  return (
    <WorkspaceShell
      eyebrow="Friend Host workspace"
      title="Requests and host profile"
      description={
        viewer
          ? `Signed in as ${viewer.displayName}. Host visibility depends on application and safety review status.`
          : 'Sync your profile before managing host requests.'
      }
      actions={
        <button
          onClick={() => ensureUser({ displayName: viewer?.displayName ?? user?.fullName ?? user?.username ?? 'New friend' })}
          className="btn btn-neutral btn-sm"
        >
          Sync profile
        </button>
      }
      rail={
        <>
          <div className="rail-section">
            <div className="rail-section-title">Host</div>
            <a href="#requests" className="rail-link is-active">
              <span>Incoming requests</span>
              <span className="rail-link-count tabular">{pendingCount}</span>
            </a>
            <a href="#profile" className="rail-link">
              <span>Profile status</span>
            </a>
            <a href="#history" className="rail-link">
              <span>History</span>
              <span className="rail-link-count tabular">{historyCount}</span>
            </a>
          </div>
          <div className="rail-section">
            <div className="rail-section-title">Setup</div>
            <Link to="/become-host" className="rail-link">
              <span>Edit application</span>
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

      <section id="profile" className="mb-10">
        <header className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-h2">Profile status</h2>
          {application && <span className="status-pill" data-tone={statusTone(application.status)}>{application.status}</span>}
        </header>
        {!viewer && <div className="empty-state">Sync your profile first.</div>}
        {viewer && !application && (
          <div className="empty-state">
            <p className="empty-state-title">No host application yet.</p>
            <p className="text-meta max-w-[44ch]">Create a host profile before receiving booking requests.</p>
            <Link to="/become-host" className="btn btn-self btn-sm mt-3">Apply as a Friend Host</Link>
          </div>
        )}
        {application && (
          <div className="panel">
            <article className="worklist-row">
              <div className="worklist-row-head">
                <div className="min-w-0">
                  <h3 className="text-h3">{application.displayName}</h3>
                  <div className="worklist-row-meta">
                    <span>{application.city}</span>
                    <span className="dot" aria-hidden="true" />
                    <span>{formatMode(application.mode)}</span>
                    <span className="dot" aria-hidden="true" />
                    <span>{application.reviewCount} reviews</span>
                  </div>
                </div>
                <Link to="/become-host" className="btn btn-self btn-sm">Edit</Link>
              </div>
              <p className="text-body muted max-w-[72ch]">{application.intro}</p>
            </article>
          </div>
        )}
      </section>

      <section id="requests">
        <header className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-h2">Incoming requests</h2>
          <span className="text-meta tabular">{activeCount} active</span>
        </header>
        {bookings === undefined && <div className="empty-state">Loading requests…</div>}
        {bookings && bookings.filter((booking) => ['request_sent', 'accepted', 'verification_required', 'pending_admin_review'].includes(booking.status)).length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">No active host requests.</p>
            <p className="text-meta">Approved hosts will see booking requests here after member verification clears.</p>
          </div>
        )}
        {bookings && bookings.filter((booking) => ['request_sent', 'accepted', 'verification_required', 'pending_admin_review'].includes(booking.status)).length > 0 && (
          <div className="panel">
            <div className="worklist">
              {bookings
                .filter((booking) => ['request_sent', 'accepted', 'verification_required', 'pending_admin_review'].includes(booking.status))
                .map((booking) => (
                  <HostBookingRow
                    key={booking._id}
                    booking={booking}
                    onAccept={async () => {
                      await decide({ bookingId: booking._id, decision: 'accepted', note: 'Accepted by Friend Host.' })
                      setNotice('Booking accepted. Chat is open for safe coordination.')
                    }}
                    onDecline={async () => {
                      await decide({ bookingId: booking._id, decision: 'declined', note: 'Declined by Friend Host.' })
                      setNotice('Booking declined.')
                    }}
                    onComplete={async () => {
                      await complete({ bookingId: booking._id })
                      setNotice('Booking marked completed. Review window is open.')
                    }}
                    onSendMessage={async (body) => {
                      await sendMessage({ bookingId: booking._id, body })
                      setNotice('Message sent.')
                    }}
                    onReport={async () => {
                      await report({ targetType: 'booking', targetId: booking._id, reason: 'Host flagged this booking for safety review' })
                      setNotice('Report sent to safety review.')
                    }}
                  />
                ))}
            </div>
          </div>
        )}
      </section>

      {bookings && bookings.filter((booking) => ['declined', 'cancelled', 'completed', 'review_window', 'closed'].includes(booking.status)).length > 0 && (
        <section id="history" className="mt-10">
          <header className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="text-h2">History</h2>
            <span className="text-meta tabular">{historyCount}</span>
          </header>
          <div className="panel">
            <div className="worklist">
              {bookings
                .filter((booking) => ['declined', 'cancelled', 'completed', 'review_window', 'closed'].includes(booking.status))
                .map((booking) => (
                  <HostBookingRow
                    key={booking._id}
                    booking={booking}
                    onAccept={async () => undefined}
                    onDecline={async () => undefined}
                    onComplete={async () => undefined}
                    onSendMessage={async (body) => {
                      await sendMessage({ bookingId: booking._id, body })
                      setNotice('Message sent.')
                    }}
                    onReport={async () => {
                      await report({ targetType: 'booking', targetId: booking._id, reason: 'Host flagged this booking for safety review' })
                      setNotice('Report sent to safety review.')
                    }}
                  />
                ))}
            </div>
          </div>
        </section>
      )}
    </WorkspaceShell>
  )
}

type HostBooking = NonNullable<ReturnType<typeof useQuery<typeof api.bookings.forHost>>>[number]

function HostBookingRow({
  booking,
  onAccept,
  onDecline,
  onComplete,
  onSendMessage,
  onReport,
}: {
  booking: HostBooking
  onAccept: () => Promise<void>
  onDecline: () => Promise<void>
  onComplete: () => Promise<void>
  onSendMessage: (body: string) => Promise<void>
  onReport: () => Promise<void>
}) {
  const status = statusCopy[booking.status as HostBookingStatus] ?? { label: booking.status, tone: 'self' as const }
  const canDecide = booking.status === 'request_sent'
  const canComplete = booking.status === 'accepted'
  const canChat = ['request_sent', 'accepted', 'completed', 'review_window'].includes(booking.status)
  const messages = useQuery(api.bookings.messages, canChat ? { bookingId: booking._id } : 'skip')

  return (
    <article className="worklist-row">
      <div className="worklist-row-head">
        <div className="flex items-center gap-3 min-w-0">
          <span className="avatar" aria-hidden="true">{initials(booking.memberDisplayName)}</span>
          <div className="min-w-0">
            <h3 className="text-h3">{booking.memberDisplayName}</h3>
            <div className="worklist-row-meta">
              <span>{booking.category}</span>
              <span className="dot" aria-hidden="true" />
              <span>{formatMode(booking.mode)}</span>
              <span className="dot" aria-hidden="true" />
              <span className="tabular">{formatRequestedAt(booking.requestedAt)}</span>
            </div>
          </div>
        </div>
        <span className="status-pill" data-tone={status.tone}>{status.label}</span>
      </div>

      {booking.notes && <p className="text-body muted max-w-[72ch]">{booking.notes}</p>}

      {canChat && <MessageThread messages={messages ?? []} viewerLabel="Host" />}

      <div className="worklist-row-actions">
        {canDecide && (
          <>
            <button onClick={onAccept} className="btn btn-neutral btn-sm">Accept</button>
            <button onClick={onDecline} className="btn btn-danger btn-sm">Decline</button>
          </>
        )}
        {canComplete && <button onClick={onComplete} className="btn btn-neutral btn-sm">Mark completed</button>}
        {canChat && <MessageForm onSend={onSendMessage} />}
        <button onClick={onReport} className="btn btn-danger btn-sm">Report</button>
      </div>
    </article>
  )
}

function MessageThread({ messages, viewerLabel }: { messages: Array<{ _id: string; body: string; createdAt: number }>; viewerLabel: string }) {
  if (messages.length === 0) {
    return <p className="text-meta">No messages yet. Chat opens only after the booking is allowed.</p>
  }
  return (
    <div className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-3 space-y-2">
      <p className="text-tiny uppercase tracking-wide text-[color:var(--text-soft)]">Messages · {viewerLabel}</p>
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

function MessageForm({ onSend }: { onSend: (body: string) => Promise<void> }) {
  return (
    <form
      className="flex items-center gap-2 flex-1 min-w-[260px]"
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        const body = String(data.get('body') ?? '').trim()
        if (!body) return
        await onSend(body)
        form.reset()
      }}
    >
      <input name="body" className="field" placeholder="Send a chat message" />
      <button className="btn btn-social btn-sm">Send</button>
    </form>
  )
}

function statusTone(status: string): 'self' | 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success'
  if (status === 'rejected' || status === 'suspended') return 'danger'
  if (status === 'pending_review') return 'warning'
  return 'self'
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
