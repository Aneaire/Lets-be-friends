import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import type React from 'react'
import { canCancelBooking, canCompleteBooking, canReviewBooking, formatPhp } from '@lets-be-friends/shared'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { WorkspaceShell } from '../components/AppShell'
import { prepareEvidenceImage } from '../lib/chatAttachments'

export const Route = createFileRoute('/companion')({
  validateSearch: (search: Record<string, unknown>): { bookingId?: string } => typeof search.bookingId === 'string' ? { bookingId: search.bookingId } : {},
  component: CompanionWorkspacePage,
})

type CompanionBookingStatus =
  | 'verification_required'
  | 'pending_admin_review'
  | 'request_sent'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed'
  | 'review_window'
  | 'closed'

const statusCopy: Record<CompanionBookingStatus, { label: string; tone: 'self' | 'social' | 'success' | 'warning' | 'danger' }> = {
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

function CompanionWorkspacePage() {
  const { bookingId } = Route.useSearch()
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.companions.myApplication)
  const bookings = useQuery(api.bookings.forCompanion, viewer ? {} : 'skip')
  const finance = useQuery(api.finance.dashboard, viewer ? {} : 'skip')
  const decide = useMutation(api.bookings.companionDecision)
  const cancelBooking = useMutation(api.bookings.cancel)
  const complete = useMutation(api.bookings.markCompleted)
  const submitReview = useMutation(api.reviews.submit)
  const report = useMutation(api.reports.create)
  const updateHourlyRate = useMutation(api.companions.updateHourlyRate)
  const createTopUp = useAction(api.paymongo.createTopUp)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!bookingId || !bookings?.some((booking) => String(booking._id) === bookingId)) return
    requestAnimationFrame(() => document.getElementById(`companion-booking-${bookingId}`)?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }, [bookingId, bookings])

  if (!isSignedIn) {
    return (
      <main className="marketing-page">
        <h1 className="text-h1 mt-2">Sign in to manage your Companion profile.</h1>
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
      variant="companion"
      title="Your Companion space"
      status={
        <span className="workspace-status-item">
          <span>Companion profile</span>
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
          <a href="#fee-balance" className="workspace-mobile-nav-link"><span>Fee balance</span></a>
          <a href="#history" className="workspace-mobile-nav-link">
            <span>History</span>
            <span className="tabular">{historyCount}</span>
          </a>
        </>
      }
      rail={
        <>
          <div className="rail-section">
            <div className="rail-section-title">Companion tools</div>
            <a href="#requests" className="rail-link is-active">
              <span>Incoming requests</span>
              <span className="rail-link-count tabular">{pendingCount}</span>
            </a>
            <a href="#profile" className="rail-link">
              <span>Profile status</span>
            </a>
            <a href="#fee-balance" className="rail-link">
              <span>Earnings and legacy fee balance</span>
              {finance && <span className="rail-link-count tabular">{formatPhp(finance.availableBalanceCentavos)}</span>}
            </a>
            <a href="#history" className="rail-link">
              <span>History</span>
              <span className="rail-link-count tabular">{historyCount}</span>
            </a>
          </div>
          <div className="rail-section">
            <div className="rail-section-title">Setup</div>
            <Link to="/become-companion" className="rail-link">
              <span>Edit Companion profile</span>
            </Link>
            <Link to="/safety" className="rail-link">
              <span>How safety works</span>
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
            <p className="empty-state-title">Your Companion profile is ready to begin.</p>
            <p className="text-meta max-w-[44ch]">Share the everyday help and Strengths you can offer, set your boundaries, and send the profile for review.</p>
            <Link to="/become-companion" className="btn btn-self btn-sm mt-3">Create Companion profile</Link>
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
                <Link to="/become-companion" className="btn btn-self btn-sm">Edit</Link>
              </div>
              <p className="text-body muted max-w-[72ch]">{application.intro}</p>
            </article>
          </div>
        )}
      </section>

      {application && (
        <FinancePanel
          application={application}
          finance={finance}
          onUpdateRate={async (hourlyRateCentavos) => {
            await updateHourlyRate({ hourlyRateCentavos })
            setNotice(`Hourly cash rate updated to ${formatPhp(hourlyRateCentavos)}.`)
          }}
          onCreateTopUp={async (amountCentavos) => {
            const result = await createTopUp({ amountCentavos })
            setNotice(result.qrImageUrl
              ? `QR Ph top-up for ${formatPhp(result.amountCentavos)} is ready to scan.`
              : 'PayMongo is confirming the QR Ph top-up. This screen will update automatically.')
          }}
        />
      )}

      <section id="requests">
        <header className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-h2">Incoming requests</h2>
          <span className="text-meta tabular">{activeCount} active</span>
        </header>
        {bookings === undefined && <div className="empty-state">Loading requests…</div>}
        {bookings && bookings.filter((booking) => ['request_sent', 'accepted', 'verification_required', 'pending_admin_review'].includes(booking.status)).length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">No one is waiting on you right now.</p>
            <p className="text-meta">New booking requests from verified members will appear here.</p>
          </div>
        )}
        {bookings && bookings.filter((booking) => ['request_sent', 'accepted', 'verification_required', 'pending_admin_review'].includes(booking.status)).length > 0 && (
          <div className="panel">
            <div className="worklist">
              {bookings
                .filter((booking) => ['request_sent', 'accepted', 'verification_required', 'pending_admin_review'].includes(booking.status))
                .map((booking) => (
                  <CompanionBookingRow
                    key={booking._id}
                    booking={booking}
                    onAccept={async () => {
                      await decide({ bookingId: booking._id, decision: 'accepted', note: 'Accepted by Companion.' })
                      setNotice('Booking accepted. Chat is open for safe coordination.')
                    }}
                    onDecline={async () => {
                      await decide({ bookingId: booking._id, decision: 'declined', note: 'Declined by Companion.' })
                      setNotice('Booking declined.')
                    }}
                    onCancel={async () => {
                      await cancelBooking({ bookingId: booking._id, reason: 'Cancelled by Companion.' })
                      setNotice('Booking cancelled.')
                    }}
                    onComplete={async () => {
                      const result = await complete({ bookingId: booking._id })
                      setNotice(result.awaitingOtherConfirmation
                        ? 'Completion confirmed. Waiting for the member to confirm separately.'
                        : 'Both people confirmed completion. The review window is open and member-wallet funds moved to pending earnings once.')
                    }}
                    onReview={async (rating, body) => {
                      await submitReview({ bookingId: booking._id, rating, body })
                      setNotice('Review submitted.')
                    }}
                    onReport={async () => {
                      await report({ targetType: 'booking', targetId: booking._id, reason: 'Companion flagged this booking for safety review' })
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
                  <CompanionBookingRow
                    key={booking._id}
                    booking={booking}
                    onAccept={async () => undefined}
                    onDecline={async () => undefined}
                    onCancel={async () => {
                      await cancelBooking({ bookingId: booking._id, reason: 'Cancelled by Companion.' })
                      setNotice('Booking cancelled.')
                    }}
                    onComplete={async () => {
                      const result = await complete({ bookingId: booking._id })
                      setNotice(result.awaitingOtherConfirmation
                        ? 'Completion confirmed. Waiting for the member to confirm separately.'
                        : 'Both people confirmed completion. The review window is open and member-wallet funds moved to pending earnings once.')
                    }}
                    onReview={async (rating, body) => {
                      await submitReview({ bookingId: booking._id, rating, body })
                      setNotice('Review submitted.')
                    }}
                    onReport={async () => {
                      await report({ targetType: 'booking', targetId: booking._id, reason: 'Companion flagged this booking for safety review' })
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

type CompanionApplication = NonNullable<ReturnType<typeof useQuery<typeof api.companions.myApplication>>>
type FinanceDashboard = NonNullable<ReturnType<typeof useQuery<typeof api.finance.dashboard>>>

function FinancePanel({
  application,
  finance,
  onUpdateRate,
  onCreateTopUp,
}: {
  application: CompanionApplication
  finance: FinanceDashboard | null | undefined
  onUpdateRate: (hourlyRateCentavos: number) => Promise<void>
  onCreateTopUp: (amountCentavos: number) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const now = Date.now()
  const activeTopUp = finance?.topUps.find((topUp) =>
    ['creating', 'awaiting_payment', 'processing'].includes(topUp.status)
    && (topUp.expiresAt === undefined || topUp.expiresAt > now),
  )
  const qrTopUp = activeTopUp ?? finance?.topUps.find((topUp) => topUp.qrImageUrl && topUp.status !== 'paid')

  return (
    <section id="fee-balance" className="mb-10">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-h2">Earnings and legacy fee balance</h2>
          <p className="text-meta mt-1">Track member-wallet earnings and keep older companion-fee obligations funded separately.</p>
        </div>
        {finance && (
          <span className="status-pill" data-tone={finance.pastDueCentavos > 0 ? 'danger' : 'success'}>
            {finance.pastDueCentavos > 0 ? 'Legacy fee past due' : 'Legacy fees current'}
          </span>
        )}
      </header>

      {error && <div className="notice notice-danger mb-3" role="alert"><span className="notice-icon">!</span><span>{error}</span></div>}
      {!finance && <div className="empty-state">Loading fee balance…</div>}
      {finance && (
        <div className="panel p-5 space-y-5">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <div><p className="text-h3">Member-wallet earnings</p><p className="text-meta mt-1">Companion entitlement is 100% of each listed service subtotal.</p></div>
              <span className="status-pill" data-tone="self">Internal balance</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              <FinanceMetric label="Pending earnings" value={formatPhp(finance.pendingEarningsCentavos)} tone="social" />
              <FinanceMetric label="Available earnings" value={formatPhp(finance.availableEarningsCentavos)} tone="self" />
            </div>
            <p className="text-meta mt-3">{finance.payoutNotice}</p>
          </div>

          <div className="border-t border-[color:var(--rule)] pt-4">
            <p className="text-h3">Legacy platform-fee balance</p>
            <p className="text-meta mt-1">Retained only for commission obligations created by older cash bookings.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <FinanceMetric label="Available" value={formatPhp(finance.availableBalanceCentavos)} tone="self" />
            <FinanceMetric label="Due this Saturday" value={formatPhp(finance.dueThisSaturdayCentavos)} tone="social" />
            <FinanceMetric label="Past due" value={formatPhp(finance.pastDueCentavos)} tone={finance.pastDueCentavos > 0 ? 'danger' : 'self'} />
          </div>
          <p className="text-meta">
            Next collection: <strong className="tabular">{formatManilaDate(finance.dueAt)}</strong>. Available credit is applied automatically; partial payments carry the remainder as past due.
          </p>

          <div className="grid gap-5 lg:grid-cols-2">
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault()
                setBusy(true)
                setError('')
                try {
                  const form = new FormData(event.currentTarget)
                  await onCreateTopUp(Math.round(Number(form.get('topUpPesos')) * 100))
                } catch (submitError) {
                  setError(submitError instanceof Error ? submitError.message : 'Top-up could not be started.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <div>
                <p className="text-h3">Top up with PayMongo QR Ph</p>
                <p className="text-meta mt-1">Paid QR amounts credit this fee balance, then settle already past-due commission FIFO.</p>
              </div>
              <label className="field-row">
                <span className="label">Top-up amount <span className="label-aux">PHP</span></span>
                <input name="topUpPesos" type="number" min="100" max="100000" step="0.01" defaultValue="500" required className="field" disabled={busy || Boolean(activeTopUp)} />
              </label>
              <button className="btn btn-social" disabled={busy || Boolean(activeTopUp)}>
                {busy ? 'Creating QR…' : activeTopUp ? 'QR attempt still active' : 'Create QR Ph top-up'}
              </button>
            </form>

            <div className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-4">
              <p className="text-h3">Current QR attempt</p>
              {!qrTopUp && <p className="text-meta mt-2">No QR Ph top-up attempt yet.</p>}
              {qrTopUp && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="tabular">{formatPhp(qrTopUp.amountCentavos)}</strong>
                    <span className="status-pill" data-tone={topUpTone(qrTopUp.status)}>{qrTopUp.status.replace('_', ' ')}</span>
                  </div>
                  {qrTopUp.qrImageUrl && qrTopUp.status === 'awaiting_payment' && (
                    <img src={qrTopUp.qrImageUrl} alt={`QR Ph code for ${formatPhp(qrTopUp.amountCentavos)} top-up`} className="mx-auto max-w-64 rounded-lg bg-white p-3" />
                  )}
                  {qrTopUp.expiresAt && <p className="text-meta tabular">Expires {formatManilaDate(qrTopUp.expiresAt)}</p>}
                  {qrTopUp.status === 'expired' && <p className="text-meta">This attempt is preserved in history. Start a new QR above.</p>}
                </div>
              )}
            </div>
          </div>

          <form
            className="flex items-end gap-3 flex-wrap border-t border-[color:var(--rule)] pt-4"
            onSubmit={async (event) => {
              event.preventDefault()
              setBusy(true)
              setError('')
              try {
                const form = new FormData(event.currentTarget)
                await onUpdateRate(Math.round(Number(form.get('hourlyRatePesos')) * 100))
              } catch (submitError) {
                setError(submitError instanceof Error ? submitError.message : 'Hourly rate could not be updated.')
              } finally {
                setBusy(false)
              }
            }}
          >
            <label className="field-row flex-1 min-w-56">
              <span className="label">Listed hourly rate <span className="label-aux">PHP</span></span>
              <input name="hourlyRatePesos" type="number" min="100" max="10000" step="0.01" defaultValue={(application.hourlyRateCentavos ?? 50_000) / 100} required className="field" disabled={busy} />
            </label>
            <button className="btn btn-self" disabled={busy}>Update rate</button>
          </form>

          <div className="grid gap-5 lg:grid-cols-2 border-t border-[color:var(--rule)] pt-4">
            <div>
              <p className="text-h3">Recent ledger</p>
              <div className="mt-2 space-y-2">
                {finance.ledger.length === 0 && <p className="text-meta">No ledger entries yet.</p>}
                {finance.ledger.slice(0, 8).map((entry) => (
                  <div key={entry._id} className="flex items-center justify-between gap-3 text-meta">
                    <span>{entry.kind === 'top_up_credit' ? 'QR Ph top-up credit' : 'Commission collected'}</span>
                    <strong className="tabular">{entry.direction === 'credit' ? '+' : '−'}{formatPhp(entry.amountCentavos)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-h3">Top-up history</p>
              <div className="mt-2 space-y-2">
                {finance.topUps.length === 0 && <p className="text-meta">No top-ups yet.</p>}
                {finance.topUps.slice(0, 8).map((topUp) => (
                  <div key={topUp._id} className="flex items-center justify-between gap-3 text-meta">
                    <span className="tabular">{formatManilaDate(topUp.createdAt)}</span>
                    <span>{formatPhp(topUp.amountCentavos)} · {topUp.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function FinanceMetric({ label, value, tone }: { label: string; value: string; tone: 'self' | 'social' | 'danger' }) {
  return (
    <div className="rounded-lg border border-[color:var(--rule)] p-4">
      <p className="text-meta">{label}</p>
      <p className="text-h2 tabular mt-1" style={{ color: tone === 'social' ? 'var(--accent-social)' : tone === 'danger' ? 'var(--danger)' : 'var(--accent-self)' }}>{value}</p>
    </div>
  )
}

function topUpTone(status: string): 'self' | 'social' | 'success' | 'warning' | 'danger' {
  if (status === 'paid') return 'success'
  if (status === 'failed' || status === 'expired') return 'danger'
  if (status === 'awaiting_payment') return 'social'
  return 'warning'
}

function formatManilaDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

type CompanionBooking = NonNullable<ReturnType<typeof useQuery<typeof api.bookings.forCompanion>>>[number]

function CompanionBookingRow({
  booking,
  onAccept,
  onDecline,
  onCancel,
  onComplete,
  onReview,
  onReport,
}: {
  booking: CompanionBooking
  onAccept: () => Promise<void>
  onDecline: () => Promise<void>
  onCancel: () => Promise<void>
  onComplete: () => Promise<void>
  onReview: (rating: number, body?: string) => Promise<void>
  onReport: () => Promise<void>
}) {
  const status = statusCopy[booking.status as CompanionBookingStatus] ?? { label: booking.status, tone: 'self' as const }
  const canDecide = booking.status === 'request_sent'
  const canCancel = canCancelBooking(booking.status)
  const canComplete = canCompleteBooking(booking.status)
  const canReview = canReviewBooking(booking.status) && !booking.viewerHasReviewed
  const conversationId = useQuery(api.conversations.between, { otherUserId: booking.memberId })

  return (
    <article id={`companion-booking-${booking._id}`} className="worklist-row">
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

      {booking.pricingModel === 'member_wallet_v2' && booking.memberTotalCentavos !== undefined ? (
        <p className="text-meta">
          Your entitlement: <strong className="tabular text-[color:var(--text)]">{formatPhp(booking.companionEarningsCentavos ?? 0)}</strong>
          {' · '}Member total {formatPhp(booking.memberTotalCentavos)} includes the service fee paid by the member.
          {booking.settlementState === 'blocked' && ' Settlement is blocked for full-admin resolution.'}
        </p>
      ) : booking.grossPriceCentavos !== undefined && booking.currency === 'PHP' ? (
        <p className="text-meta">Legacy cash amount: <strong className="tabular text-[color:var(--text)]">{formatPhp(booking.grossPriceCentavos)}</strong> · Legacy commission {formatPhp(booking.commissionCentavos ?? 0)}</p>
      ) : null}
      {booking.notes && <p className="text-body muted max-w-[72ch]">{booking.notes}</p>}

      {booking.pricingModel === 'member_wallet_v2' && booking.status === 'accepted' && (
        <EvidenceDecision bookingId={booking._id} />
      )}

      <div className="worklist-row-actions">
        {canDecide && (
          <>
            <button onClick={onAccept} className="btn btn-neutral btn-sm">Accept</button>
            <button onClick={onDecline} className="btn btn-danger btn-sm">Decline</button>
          </>
        )}
        {canComplete && !booking.companionCompletedAt && <button onClick={onComplete} className="btn btn-neutral btn-sm">Confirm completion</button>}
        {canComplete && booking.companionCompletedAt && <span className="text-meta">You confirmed completion · waiting for member</span>}
        {canReview && <ReviewForm onReview={onReview} />}
        {booking.viewerHasReviewed && canReviewBooking(booking.status) && <span className="text-meta">Review submitted</span>}
        {canCancel && <button type="button" onClick={onCancel} className="btn btn-danger btn-sm">Cancel booking</button>}
        {conversationId && (
          <Link to="/messages" search={{ conversationId }} className="btn btn-social btn-sm">Open conversation</Link>
        )}
        <button onClick={onReport} className="btn btn-danger btn-sm">Report</button>
      </div>
    </article>
  )
}

function EvidenceDecision({ bookingId }: { bookingId: Id<'bookings'> }) {
  const evidence = useQuery(api.bookingEvidence.status, { bookingId })
  const uploadImage = useAction(api.bookingEvidence.uploadImage)
  const skip = useMutation(api.bookingEvidence.skip)
  const [busy, setBusy] = useState(false)
  const [evidenceError, setEvidenceError] = useState('')

  if (evidence?.decision) {
    return <div className="evidence-decision"><p className="text-meta"><strong>Start evidence:</strong> {evidence.decision === 'uploaded' ? 'Private image saved' : 'Skipped after warning acknowledgement'}.</p></div>
  }

  return (
    <div className="evidence-decision">
      <div><p className="text-h3">Start evidence</p><p className="text-meta mt-1">You make the start decision. The image is optional and private; a reviewer or admin can retrieve it only with an active linked booking report, and each retrieval is audited. The member cannot access it.</p></div>
      {evidenceError && <p className="text-meta text-[color:var(--danger)]">{evidenceError}</p>}
      <div className="flex gap-2 flex-wrap">
        <label className={`btn btn-social-quiet btn-sm ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {busy ? 'Processing image…' : 'Upload private image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            disabled={busy}
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (!file) return
              setBusy(true)
              setEvidenceError('')
              try {
                const processed = await prepareEvidenceImage(file)
                await uploadImage({
                  bookingId,
                  bytes: await processed.arrayBuffer(),
                  contentType: processed.type,
                })
              } catch (error) {
                setEvidenceError(error instanceof Error ? error.message : 'Evidence image could not be saved.')
              } finally {
                setBusy(false)
              }
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm('Strict warning: skipping means no private start image will be available to help reviewers evaluate a later booking report. Skip anyway?')) return
            setBusy(true)
            setEvidenceError('')
            try {
              await skip({ bookingId, warningAcknowledged: true })
            } catch (error) {
              setEvidenceError(error instanceof Error ? error.message : 'Evidence decision could not be saved.')
            } finally {
              setBusy(false)
            }
          }}
        >
          Skip after warning
        </button>
      </div>
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
