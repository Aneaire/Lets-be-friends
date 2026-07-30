import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import type React from 'react'
import { canBookingChat, canCancelBooking, canCompleteBooking, canReadBookingMessages, canReviewBooking } from '@lets-be-friends/shared'
import type { Id } from '../../convex/_generated/dataModel'
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
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.hosts.myApplication)
  const bookings = useQuery(api.bookings.forHost, viewer ? {} : 'skip')
  const decide = useMutation(api.bookings.hostDecision)
  const cancelBooking = useMutation(api.bookings.cancel)
  const complete = useMutation(api.bookings.markCompleted)
  const sendMessage = useMutation(api.bookings.sendMessage)
  const submitReview = useMutation(api.reviews.submit)
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
      variant="hosting"
      eyebrow="Hosting"
      title="Requests and host profile"
      description={
        viewer
          ? 'Manage booking requests, conversations, and the profile members see.'
          : 'Loading your hosting workspace…'
      }
      status={
        <span className="workspace-status-item">
          <span>Host profile</span>
          <span className="status-pill" data-tone={application ? statusTone(application.status) : 'self'}>
            {application?.status ?? 'Not started'}
          </span>
        </span>
      }
      mobileNavigation={
        <>
          <a href="#requests" className="workspace-mobile-nav-link is-active">
            <span>Requests</span>
            <span className="tabular">{activeCount}</span>
          </a>
          <a href="#profile" className="workspace-mobile-nav-link"><span>Profile</span></a>
          <a href="#history" className="workspace-mobile-nav-link">
            <span>History</span>
            <span className="tabular">{historyCount}</span>
          </a>
        </>
      }
      rail={
        <>
          <div className="rail-section">
            <div className="rail-section-title">Hosting</div>
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
        <div className="notice notice-success mb-6" role="status" aria-live="polite">
          <span className="notice-icon">✓</span>
          <span>{notice}</span>
        </div>
      )}

      <section id="profile" className="mb-10">
        <header className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-h2">Profile status</h2>
          {application && <span className="status-pill" data-tone={statusTone(application.status)}>{application.status}</span>}
        </header>
        {!viewer && <div className="empty-state">Loading your profile…</div>}
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
            <p className="text-meta">Booking requests from verified members will appear here after they are sent.</p>
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
                    onCancel={async () => {
                      await cancelBooking({ bookingId: booking._id, reason: 'Cancelled by Friend Host.' })
                      setNotice('Booking cancelled.')
                    }}
                    onComplete={async () => {
                      await complete({ bookingId: booking._id })
                      setNotice('Booking marked complete. Review window is open.')
                    }}
                    onReview={async (rating, body) => {
                      await submitReview({ bookingId: booking._id, rating, body })
                      setNotice('Review submitted.')
                    }}
                    onSendMessage={async (body) => {
                      await sendMessage({ bookingId: booking._id, body })
                      setNotice('Message sent.')
                    }}
                    onReport={async () => {
                      await report({ targetType: 'booking', targetId: booking._id, reason: 'Host flagged this booking for safety review' })
                      setNotice('Report sent to safety review.')
                    }}
                    onReportMessage={async (messageId) => {
                      await report({ targetType: 'message', targetId: messageId, reason: 'Message needs safety review' })
                      setNotice('Message report sent to safety review.')
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
                    onCancel={async () => {
                      await cancelBooking({ bookingId: booking._id, reason: 'Cancelled by Friend Host.' })
                      setNotice('Booking cancelled.')
                    }}
                    onComplete={async () => {
                      await complete({ bookingId: booking._id })
                      setNotice('Booking marked complete. Review window is open.')
                    }}
                    onReview={async (rating, body) => {
                      await submitReview({ bookingId: booking._id, rating, body })
                      setNotice('Review submitted.')
                    }}
                    onSendMessage={async (body) => {
                      await sendMessage({ bookingId: booking._id, body })
                      setNotice('Message sent.')
                    }}
                    onReport={async () => {
                      await report({ targetType: 'booking', targetId: booking._id, reason: 'Host flagged this booking for safety review' })
                      setNotice('Report sent to safety review.')
                    }}
                    onReportMessage={async (messageId) => {
                      await report({ targetType: 'message', targetId: messageId, reason: 'Message needs safety review' })
                      setNotice('Message report sent to safety review.')
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
  onCancel,
  onComplete,
  onReview,
  onSendMessage,
  onReport,
  onReportMessage,
}: {
  booking: HostBooking
  onAccept: () => Promise<void>
  onDecline: () => Promise<void>
  onCancel: () => Promise<void>
  onComplete: () => Promise<void>
  onReview: (rating: number, body?: string) => Promise<void>
  onSendMessage: (body: string) => Promise<void>
  onReport: () => Promise<void>
  onReportMessage: (messageId: Id<'messages'>) => Promise<void>
}) {
  const status = statusCopy[booking.status as HostBookingStatus] ?? { label: booking.status, tone: 'self' as const }
  const canDecide = booking.status === 'request_sent'
  const canCancel = canCancelBooking(booking.status)
  const canComplete = canCompleteBooking(booking.status)
  const canReview = canReviewBooking(booking.status) && !booking.viewerHasReviewed
  const canChat = canBookingChat(booking.status)
  const canReadMessages = canReadBookingMessages(booking.status)
  const messages = useQuery(api.bookings.messages, canReadMessages ? { bookingId: booking._id } : 'skip')

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

      {canReadMessages && <MessageThread messages={messages ?? []} onReport={onReportMessage} />}

      <div className="worklist-row-actions">
        {canDecide && (
          <>
            <button onClick={onAccept} className="btn btn-neutral btn-sm">Accept</button>
            <button onClick={onDecline} className="btn btn-danger btn-sm">Decline</button>
          </>
        )}
        {canComplete && <button onClick={onComplete} className="btn btn-neutral btn-sm">Mark completed</button>}
        {canReview && <ReviewForm onReview={onReview} />}
        {booking.viewerHasReviewed && canReviewBooking(booking.status) && <span className="text-meta">Review submitted</span>}
        {canCancel && <button type="button" onClick={onCancel} className="btn btn-danger btn-sm">Cancel booking</button>}
        {canChat && <MessageForm onSend={onSendMessage} />}
        <button onClick={onReport} className="btn btn-danger btn-sm">Report</button>
      </div>
    </article>
  )
}

function MessageThread({ messages, onReport }: {
  messages: Array<{ _id: Id<'messages'>; body: string; createdAt: number; senderDisplayName: string; sentByViewer: boolean }>
  onReport: (messageId: Id<'messages'>) => Promise<void>
}) {
  if (messages.length === 0) {
    return <p className="text-meta">No messages yet. Chat opens only after the booking is allowed.</p>
  }
  return (
    <div className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-3 space-y-2">
      <p className="text-tiny uppercase tracking-wide text-[color:var(--text-soft)]">Messages</p>
      {messages.map((message) => (
        <div key={message._id} className="message-row text-meta">
          <div className="min-w-0">
            <strong>{message.sentByViewer ? 'You' : message.senderDisplayName}</strong>
            <span className="mx-2 text-soft">·</span>
            <span className="tabular text-soft">{formatRequestedAt(message.createdAt)}</span>
            <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
          </div>
          <button type="button" onClick={() => onReport(message._id)} className="btn btn-ghost btn-sm">Report</button>
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
