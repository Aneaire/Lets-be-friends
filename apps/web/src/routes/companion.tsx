import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import type React from 'react'
import { formatPhp } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import { WorkspaceShell } from '../design-system/templates/AppShell'
import { CompanionWithdrawalPanel } from '../features/wallet/CompanionWithdrawalPanel'
import { OpenableImage } from '../design-system/molecules/OpenableImage'
import { BookingsView, type BookingsViewMode } from '../features/booking/BookingsView'
import { BookingsViewSkeleton } from '../features/booking/AppPageSkeleton'
import { CompanionBookingRow, companionStatusPresentation } from '../features/booking/CompanionBookingRow'
import type { CompanionBooking } from '../features/booking/combinedBookings'

export const Route = createFileRoute('/companion')({
  validateSearch: (search: Record<string, unknown>): { bookingId?: string } => typeof search.bookingId === 'string' ? { bookingId: search.bookingId } : {},
  component: CompanionWorkspacePage,
})

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
  const [bookingsView, setBookingsView] = useState<BookingsViewMode>('calendar')

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

  const bookingsReady = bookings !== undefined
  const pendingCount = (bookings ?? []).filter((booking) => booking.status === 'request_sent').length
  const activeCount = (bookings ?? []).filter((booking) => ['request_sent', 'accepted'].includes(booking.status)).length
  const historyCount = (bookings ?? []).filter((booking) => ['declined', 'cancelled', 'completed', 'review_window', 'closed'].includes(booking.status)).length
  const activeBookings = (bookings ?? []).filter((booking) => ['request_sent', 'accepted', 'verification_required', 'pending_admin_review'].includes(booking.status))
  const historyBookings = (bookings ?? []).filter((booking) => ['declined', 'cancelled', 'completed', 'review_window', 'closed'].includes(booking.status))

  const renderCompanionBooking = (booking: CompanionBooking) => (
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
      onReview={async (rating, body, imageUploadId) => {
        await submitReview({ bookingId: booking._id, rating, body, imageUploadId })
        setNotice('Review submitted.')
      }}
      onReport={async () => {
        await report({ targetType: 'booking', targetId: booking._id, reason: 'Companion flagged this booking for safety review' })
        setNotice('Report sent to safety review.')
      }}
    />
  )

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
          <a href="#bookings" className="workspace-mobile-nav-link is-active" onClick={() => setBookingsView('cards')}>
            <span>Requests</span>
            <BookingCount ready={bookingsReady} value={activeCount} className="tabular" />
          </a>
          <a href="#profile" className="workspace-mobile-nav-link"><span>Profile</span></a>
          <a href="#fee-balance" className="workspace-mobile-nav-link"><span>Fee balance</span></a>
          <a href="#history" className="workspace-mobile-nav-link" onClick={() => setBookingsView('cards')}>
            <span>History</span>
            <BookingCount ready={bookingsReady} value={historyCount} className="tabular" />
          </a>
        </>
      }
      rail={
        <>
          <div className="rail-section">
            <div className="rail-section-title">Companion tools</div>
            <a href="#requests" className="rail-link is-active" onClick={() => setBookingsView('cards')}>
              <span>Incoming requests</span>
              <BookingCount ready={bookingsReady} value={pendingCount} className="rail-link-count tabular" />
            </a>
            <a href="#profile" className="rail-link">
              <span>Profile status</span>
            </a>
            <a href="#fee-balance" className="rail-link">
              <span>Earnings and legacy fee balance</span>
              {finance && <span className="rail-link-count tabular">{formatPhp(finance.availableBalanceCentavos)}</span>}
            </a>
            <a href="#history" className="rail-link" onClick={() => setBookingsView('cards')}>
              <span>History</span>
              <BookingCount ready={bookingsReady} value={historyCount} className="rail-link-count tabular" />
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

      <section id="bookings">
        <header className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-h2">Bookings</h2>
          {bookingsReady
            ? <span className="text-meta tabular">{activeCount} active</span>
            : <span className="skeleton skeleton-line app-page-skeleton-count-label" aria-hidden="true" />}
        </header>

        {!bookingsReady && (
          <div className="app-page-skeleton">
            <p className="sr-only" role="status">Loading your bookings.</p>
            <div aria-hidden="true"><BookingsViewSkeleton /></div>
          </div>
        )}

        {bookings && bookings.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">No one is waiting on you right now.</p>
            <p className="text-meta">New booking requests from verified members will appear here.</p>
          </div>
        )}

        {bookings && bookings.length > 0 && (
          <BookingsView
            bookings={bookings}
            bookingId={bookingId}
            view={bookingsView}
            onViewChange={setBookingsView}
            renderBooking={renderCompanionBooking}
            participantName={(booking) => booking.memberDisplayName}
            statusPresentation={(status) => companionStatusPresentation(status)}
            cards={
              <>
                <section id="requests" aria-labelledby="companion-requests-title">
                  <header className="flex items-baseline justify-between gap-3 mb-3">
                    <h2 id="companion-requests-title" className="text-h2">Incoming requests</h2>
                    <span className="text-meta tabular">{activeCount} active</span>
                  </header>
                  {activeBookings.length > 0 ? (
                    <div className="panel">
                      <div className="worklist">{activeBookings.map(renderCompanionBooking)}</div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p className="empty-state-title">No one is waiting on you right now.</p>
                      <p className="text-meta">New booking requests from verified members will appear here.</p>
                    </div>
                  )}
                </section>

                {historyBookings.length > 0 && (
                  <section id="history" className="mt-10">
                    <header className="flex items-baseline justify-between gap-3 mb-3">
                      <h2 className="text-h2">History</h2>
                      <span className="text-meta tabular">{historyCount}</span>
                    </header>
                    <div className="panel">
                      <div className="worklist">{historyBookings.map(renderCompanionBooking)}</div>
                    </div>
                  </section>
                )}
              </>
            }
          />
        )}
      </section>
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
  const payouts = useQuery(api.withdrawals.dashboard, {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const now = Date.now()
  const activeTopUp = finance?.topUps.find((topUp) =>
    ['creating', 'awaiting_payment', 'processing'].includes(topUp.status)
    && (topUp.expiresAt === undefined || topUp.expiresAt > now),
  )
  const qrTopUp = activeTopUp ?? finance?.topUps[0]

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
              <span className="status-pill" data-tone={payouts?.enabled ? 'success' : 'warning'}>
                {payouts?.enabled ? 'Withdrawals available' : 'Internal balance'}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 mt-3">
              <FinanceMetric label="Available wallet balance" value={formatPhp(finance.availableEarningsCentavos)} tone="self" />
              <FinanceMetric label="In transfer" value={formatPhp(finance.inTransferEarningsCentavos)} tone="self" />
              <FinanceMetric label="Pending earnings" value={formatPhp(finance.pendingEarningsCentavos)} tone="self" />
            </div>
            <p className="text-meta mt-3">{finance.payoutNotice}</p>
          </div>

          <CompanionWithdrawalPanel />

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
                <input name="topUpPesos" type="number" min="1" max="100000" step="0.01" defaultValue="500" required className="field" disabled={busy} />
              </label>
              <button className="btn btn-social" disabled={busy}>
                {busy ? 'Creating QR…' : activeTopUp ? 'Regenerate QR Ph top-up' : 'Create QR Ph top-up'}
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
                    <OpenableImage src={qrTopUp.qrImageUrl} alt={`QR Ph code for ${formatPhp(qrTopUp.amountCentavos)} top-up`} className="mx-auto max-w-64 rounded-lg bg-white p-3" />
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

function BookingCount({ ready, value, className }: { ready: boolean; value: number; className: string }) {
  if (!ready) return <span className="skeleton app-page-skeleton-count" aria-hidden="true" />
  return <span className={className}>{value}</span>
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
