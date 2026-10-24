import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { User } from 'lucide-react'
import { toast } from 'sonner'
import type React from 'react'
import { canCancelBooking, canCompleteBooking, canReviewBooking, formatPhp } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { WorkspaceShell } from '../design-system/templates/AppShell'
import { BookingDialog, type ApprovedCompanionOption } from '../features/booking/BookingDialog'
import { BookingTransactionsPreview } from '../features/booking/BookingTransactionList'
import { BookingRequestEditor, type EditableBookingRequest } from '../features/booking/BookingRequestEditor'
import { BookingActionsMenu } from '../features/booking/BookingActionsMenu'
import { AppPageSkeleton } from '../features/booking/AppPageSkeleton'
import { BookingCompletionAction } from '../features/booking/BookingCompletionAction'
import { BookingsView, type BookingsViewMode } from '../features/booking/BookingsView'
import { CompanionBookingRow, companionStatusPresentation } from '../features/booking/CompanionBookingRow'
import {
  calendarParticipantName,
  combineCalendarBookings,
  isActiveCalendarBooking,
  type CombinedCalendarBooking,
  type CompanionPerspectiveBooking,
} from '../features/booking/combinedBookings'
import { EvidenceDecision } from '../features/booking/EvidenceDecision'
import { identityEntitlementStatus, memberVerificationPresentation } from '../lib/memberVerification'
import { useIdentityVerification } from '../features/identity/IdentityVerificationFlow'
import { ReviewForm } from '../features/profile/ReviewForm';
import { ReviewSubmittedLink } from '../features/booking/ReviewSubmittedLink';

export const Route = createFileRoute('/app')({
  validateSearch: (search: Record<string, unknown>): { companionProfileId?: string; bookingId?: string } => ({
    ...(typeof search.companionProfileId === 'string' ? { companionProfileId: search.companionProfileId } : {}),
    ...(typeof search.bookingId === 'string' ? { bookingId: search.bookingId } : {}),
  }),
  component: AppPage,
})

type BookingStatus =
  | 'verification_required'
  | 'request_sent'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed'
  | 'review_window'
  | 'closed'

const statusCopy: Record<BookingStatus, { label: string; tone: 'self' | 'social' | 'success' | 'warning' | 'danger' }> = {
  verification_required: { label: 'Verification required', tone: 'warning' },
  request_sent: { label: 'Request sent', tone: 'social' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  completed: { label: 'Completed', tone: 'success' },
  review_window: { label: 'Review window open', tone: 'social' },
  closed: { label: 'Closed', tone: 'self' },
}

function AppPage() {
  const { companionProfileId, bookingId } = Route.useSearch()
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer)
  const latestMemberVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const bookings = useQuery(api.bookings.mine, viewer ? {} : 'skip')
  const companionBookings = useQuery(api.bookings.forCompanion, viewer ? {} : 'skip')
  const recentBookingTransactions = useQuery(api.finance.memberBookingTransactions, viewer ? { limit: 5 } : 'skip')
  const memberFinance = useQuery(api.finance.memberDashboard, viewer ? {} : 'skip')
  const identityFlow = useIdentityVerification('member')
  const createDraft = useMutation(api.bookings.createDraft)
  const cancelBooking = useMutation(api.bookings.cancel)
  const completeBooking = useMutation(api.bookings.markCompleted)
  const decideCompanionBooking = useMutation(api.bookings.companionDecision)
  const submitReview = useMutation(api.reviews.submit)
  const report = useMutation(api.reports.create)
  const updateBookingRequest = useMutation(api.bookings.editRequest)
  const navigate = useNavigate()
  const setNotice = useCallback((message: string) => toast.success(message), [])
  const [error, setError] = useState('')
  const [editingBooking, setEditingBooking] = useState<EditableBookingRequest | null>(null)
  const editingCompanion = useQuery(api.companions.getPublic, editingBooking?.companionProfileId ? { companionProfileId: editingBooking.companionProfileId } : 'skip')
  const [identityDetailsOpen, setIdentityDetailsOpen] = useState(false)
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [bookingsView, setBookingsView] = useState<BookingsViewMode>('calendar')
  const bookingTriggerRef = useRef<HTMLButtonElement>(null)
  const bookingOpenerRef = useRef<HTMLElement | null>(null)

  const verification = viewer
      ? memberVerificationPresentation(
        identityEntitlementStatus(viewer.verificationStatus, viewer.identityEligible),
        latestMemberVerification,
      )
    : { state: 'not_started' as const, label: 'Loading', tone: 'self' as const, guidance: 'Loading identity status…', action: 'none' as const }
  const canBook = verification.state === 'approved'
  const coreDataReady = viewer === undefined
    ? false
    : viewer === null || (latestMemberVerification !== undefined && bookings !== undefined && companionBookings !== undefined && memberFinance !== undefined)
  const approvedCompanions = useQuery(
    api.companions.listApproved,
    canBook ? {} : 'skip',
  ) as ApprovedCompanionOption[] | undefined
  const bookableCompanions = useMemo(
    () => (approvedCompanions ?? []).filter(
      (companion) => companion.bookable && companion.viewerBookingEligibility === 'eligible',
    ),
    [approvedCompanions],
  )
  const combinedBookings = useMemo(
    () => combineCalendarBookings(bookings, companionBookings),
    [bookings, companionBookings],
  )

  const openBookingDialog = useCallback((opener?: HTMLElement) => {
    if (!canBook) {
      setIdentityDetailsOpen(true)
      setError('Identity verification must be approved before you can start a booking.')
      return
    }
    setError('')
    bookingOpenerRef.current = opener ?? bookingTriggerRef.current
    setBookingDialogOpen(true)
  }, [canBook])

  const closeBookingDialog = useCallback(() => {
    setBookingDialogOpen(false)
    if (companionProfileId) {
      void navigate({ to: '/app', search: {}, replace: true })
    }
  }, [companionProfileId, navigate])

  useEffect(() => {
    if (!bookingId) return
    const linkedBooking = combinedBookings.find((booking) => String(booking._id) === bookingId)
    if (!linkedBooking) return
    const elementId = linkedBooking.perspective === 'companion' ? `companion-booking-${bookingId}` : `booking-${bookingId}`
    requestAnimationFrame(() => document.getElementById(elementId)?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
  }, [bookingId, combinedBookings])

  useEffect(() => {
    if (!companionProfileId || !coreDataReady) return

    if (!canBook) {
      setBookingDialogOpen(false)
      setIdentityDetailsOpen(true)
      setError('Verify your identity before requesting this booking. Your selected Companion will remain ready after approval.')
      return
    }

    bookingOpenerRef.current = bookingTriggerRef.current
    setBookingDialogOpen(true)
  }, [canBook, companionProfileId, coreDataReady, navigate])

  if (!isSignedIn) {
    return (
      <main className="marketing-page">
        <h1 className="text-h1 mt-2">Sign in to see your bookings.</h1>
        <div className="mt-6">
          <SignInButton mode="modal">
            <button className="btn btn-self">Sign in</button>
          </SignInButton>
        </div>
      </main>
    )
  }

  if (!coreDataReady) {
    return <AppPageSkeleton />
  }

  const openBookings = combinedBookings.filter((booking) => isActiveCalendarBooking(booking)).length
  const completedBookings = combinedBookings.filter((booking) => !isActiveCalendarBooking(booking)).length
  const memberActiveBookings = combinedBookings.filter((booking) => booking.perspective === 'member' && isActiveCalendarBooking(booking))
  const memberPastBookings = combinedBookings.filter((booking) => booking.perspective === 'member' && !isActiveCalendarBooking(booking))
  const companionSideBookings = combinedBookings.filter((booking) => booking.perspective === 'companion')

  const heldBooking = (bookings ?? []).find((booking) => booking.status === 'verification_required')

  const renderMemberBookingRow = (booking: Booking) => (
    <BookingRow
      key={booking._id}
      booking={booking}
      onCancel={async () => {
        await cancelBooking({ bookingId: booking._id, reason: 'Cancelled by member.' })
        setNotice('Booking cancelled.')
      }}
      onComplete={async () => {
        const result = await completeBooking({ bookingId: booking._id })
        setNotice(result.awaitingOtherConfirmation
          ? 'Completion confirmed. Waiting for the Companion to confirm separately.'
          : 'Both people confirmed completion. The review window is open.')
      }}
      onReview={async (rating, body, imageUploadIds) => {
        await submitReview({ bookingId: booking._id, rating, body, imageUploadIds })
        setNotice('Review submitted.')
      }}
      onReport={async () => {
        await report({ targetType: 'booking', targetId: booking._id, reason: 'Needs safety review' })
        setNotice('Report sent to the review queue.')
      }}
      onEditRequest={(bookingRequest) => setEditingBooking(bookingRequest)}
    />
  )

  const renderCompanionBookingRow = (booking: CompanionPerspectiveBooking) => (
    <CompanionBookingRow
      key={`companion-${booking._id}`}
      booking={booking}
      onAccept={async () => {
        await decideCompanionBooking({ bookingId: booking._id, decision: 'accepted', note: 'Accepted by Companion.' })
        setNotice('Booking accepted. Chat is open for safe coordination.')
      }}
      onDecline={async () => {
        await decideCompanionBooking({ bookingId: booking._id, decision: 'declined', note: 'Declined by Companion.' })
        setNotice('Booking declined.')
      }}
      onCancel={async () => {
        await cancelBooking({ bookingId: booking._id, reason: 'Cancelled by Companion.' })
        setNotice('Booking cancelled.')
      }}
      onComplete={async () => {
        const result = await completeBooking({ bookingId: booking._id })
        setNotice(result.awaitingOtherConfirmation
          ? 'Completion confirmed. Waiting for the member to confirm separately.'
          : 'Both people confirmed completion. The review window is open and your earnings are in your Companion wallet.')
      }}
      onReview={async (rating, body, imageUploadIds) => {
        await submitReview({ bookingId: booking._id, rating, body, imageUploadIds })
        setNotice('Review submitted.')
      }}
      onReport={async () => {
        await report({ targetType: 'booking', targetId: booking._id, reason: 'Companion flagged this booking for safety review' })
        setNotice('Report sent to safety review.')
      }}
    />
  )

  const renderBookingRow = (booking: CombinedCalendarBooking) => (
    booking.perspective === 'companion'
      ? renderCompanionBookingRow(booking)
      : renderMemberBookingRow(booking)
  )

  return (
    <WorkspaceShell
      variant="bookings"
      title="Your bookings"
      status={
        <button
          type="button"
          id="identity-status-trigger"
          className="workspace-status-item workspace-status-action"
          aria-expanded={identityDetailsOpen}
          aria-controls="identity-status-details"
          onClick={() => setIdentityDetailsOpen((open) => !open)}
        >
          <span>Identity</span>
          <span className="status-pill" data-tone={verification.tone}>{verification.label}</span>
        </button>
      }
      actions={canBook ? (
        <button
          ref={bookingTriggerRef}
          type="button"
          className="btn btn-social"
          onClick={(event) => openBookingDialog(event.currentTarget)}
          aria-haspopup="dialog"
          aria-expanded={bookingDialogOpen}
          aria-controls="booking-dialog"
        >
          Create booking
        </button>
      ) : verification.action === 'none' ? null : (
        <button
          type="button"
          className="btn btn-self"
          onClick={() => void identityFlow.begin()}
          disabled={!viewer || identityFlow.busy}
        >
          {identityFlow.busy
            ? 'Opening identity check...'
            : verification.action === 'continue'
              ? 'Continue identity check'
              : verification.action === 'retry'
                ? 'Start a new identity check'
                : 'Verify identity'}
        </button>
      )}
      mobileNavigation={
        <>
          <a href="#bookings" className="workspace-mobile-nav-link is-active" onClick={() => setBookingsView('cards')}>
            <span>Open</span>
            <span className="tabular">{openBookings}</span>
          </a>
          <a href="#archive" className="workspace-mobile-nav-link" onClick={() => setBookingsView('cards')}>
            <span>Past</span>
            <span className="tabular">{completedBookings}</span>
          </a>
        </>
      }
      rail={
        <>
          <div className="rail-section">
            <div className="rail-section-title">Your bookings</div>
            <a href="#bookings" className="rail-link is-active" aria-current="location" onClick={() => setBookingsView('cards')}>
              <span>Open</span>
              <span className="rail-link-count tabular">{openBookings}</span>
            </a>
            <a href="#archive" className="rail-link" onClick={() => setBookingsView('cards')}>
              <span>Past</span>
              <span className="rail-link-count tabular">{completedBookings}</span>
            </a>
          </div>
          <div className="rail-section">
            <div className="rail-section-title">Account</div>
            <Link to="/become-companion" className="rail-link">
              <span>Companion profile</span>
            </Link>
            <Link to="/safety" className="rail-link">
              <span>How safety works</span>
            </Link>
          </div>
        </>
      }
    >
      {identityDetailsOpen && (
        <section
          id="identity-status-details"
          className="panel identity-status-details mb-6"
          aria-labelledby="identity-status-trigger"
        >
          <div className="panel-body identity-status-details-body">
            <div>
              <p className="text-meta">Identity verification</p>
              <h2 className="text-h3 mt-1">{verification.label}</h2>
              <p className="text-body muted mt-1">{verification.guidance}</p>
              {verification.state === 'admin_pending' && (
                <p className="text-meta mt-2">No additional action is needed while the safety team reviews the completed identity submission.</p>
              )}
            </div>
            <div className="identity-status-details-actions">
              {verification.state === 'approved' && (
                <button
                  type="button"
                  className="btn btn-social btn-sm"
                  onClick={(event) => openBookingDialog(event.currentTarget)}
                  aria-haspopup="dialog"
                  aria-expanded={bookingDialogOpen}
                  aria-controls="booking-dialog"
                >
                  Create booking
                </button>
              )}
              {verification.action !== 'none' && (
                <button
                  type="button"
                  className="btn btn-self btn-sm"
                  onClick={() => void identityFlow.begin()}
                  disabled={!viewer || identityFlow.busy}
                >
                  {identityFlow.busy
                    ? 'Opening identity check...'
                    : verification.action === 'continue'
                      ? 'Continue identity check'
                      : verification.action === 'retry'
                        ? 'Start a new identity check'
                        : 'Verify identity'}
                </button>
              )}
              {verification.state === 'admin_pending' && heldBooking && (
                <a href={`#booking-${heldBooking._id}`} className="btn btn-neutral btn-sm">
                  View legacy held booking
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {identityFlow.message && (
        <div className="notice notice-success mb-6" role="status" aria-live="polite">
          <span className="notice-icon">✓</span>
          <span>{identityFlow.message}</span>
        </div>
      )}
      {(error || identityFlow.error) && (
        <div className="notice notice-danger mb-6" role="alert">
          <span className="notice-icon">!</span>
          <span>{identityFlow.error || error}</span>
        </div>
      )}

      <section id="bookings">
        <header className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-h2">Bookings</h2>
          <div className="flex items-center gap-2">
            <span className="text-meta tabular">{openBookings} active</span>
            <Link
              to="/wallet"
              className="btn btn-self-quiet btn-sm tabular"
            >
              Balance {memberFinance ? formatPhp(memberFinance.availableCentavos) : '…'}
            </Link>
          </div>
        </header>
        {viewer && (
          <BookingsView
            bookings={combinedBookings}
            bookingId={bookingId}
            view={bookingsView}
            onViewChange={setBookingsView}
            renderBooking={renderBookingRow}
            statusPresentation={(status, booking) =>
              booking.perspective === 'companion'
                ? companionStatusPresentation(status)
                : statusCopy[status as BookingStatus] ?? { label: status, tone: 'self' }
            }
            participantName={(booking) => calendarParticipantName(booking)}
            cards={combinedBookings.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">
                  {canBook ? 'No bookings yet.' : 'Verify once before sending a booking request.'}
                </p>
                <p className="text-meta max-w-[44ch]">
                  {canBook
                    ? 'Explore Companions, find the help or company that feels right, and request a time.'
                    : verification.guidance}
                </p>
                {canBook ? (
                  <button
                    type="button"
                    className="btn btn-social btn-sm mt-2"
                    onClick={(event) => openBookingDialog(event.currentTarget)}
                    aria-haspopup="dialog"
                    aria-expanded={bookingDialogOpen}
                    aria-controls="booking-dialog"
                  >
                    Find a Companion
                  </button>
                ) : verification.action !== 'none' ? (
                  <button
                    type="button"
                    className="btn btn-self btn-sm mt-2"
                    onClick={() => void identityFlow.begin()}
                    disabled={identityFlow.busy}
                  >
                    {identityFlow.busy
                      ? 'Opening identity check...'
                      : verification.action === 'continue'
                        ? 'Continue identity check'
                        : verification.action === 'retry'
                          ? 'Start a new identity check'
                          : 'Verify identity'}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <section aria-labelledby="open-bookings-title">
                  <header className="flex items-baseline justify-between gap-3 mb-3">
                    <h2 id="open-bookings-title" className="text-h2">Open bookings</h2>
                    <span className="text-meta tabular">{memberActiveBookings.length} active</span>
                  </header>
                  {memberActiveBookings.length > 0 ? (
                    <div className="panel">
                      <div className="worklist">
                        {memberActiveBookings.map(renderBookingRow)}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">No open bookings.</div>
                  )}
                </section>

                {memberPastBookings.length > 0 && (
                  <section id="archive" className="mt-10">
                    <header className="flex items-baseline justify-between gap-3 mb-3">
                      <h2 className="text-h2">Past bookings</h2>
                      <span className="text-meta tabular">{memberPastBookings.length}</span>
                    </header>
                    <div className="panel">
                      <div className="worklist">
                        {memberPastBookings.map(renderBookingRow)}
                      </div>
                    </div>
                  </section>
                )}

                {companionSideBookings.length > 0 && (
                  <section id="companion-bookings" className="mt-10" aria-labelledby="companion-bookings-title">
                    <header className="flex items-baseline justify-between gap-3 mb-3">
                      <h2 id="companion-bookings-title" className="text-h2">Bookings as Companion</h2>
                      <span className="text-meta tabular">{companionSideBookings.length}</span>
                    </header>
                    <div className="panel">
                      <div className="worklist">
                        {companionSideBookings.map(renderBookingRow)}
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          />
        )}
      </section>

      <BookingTransactionsPreview transactions={recentBookingTransactions} />

      {canBook && bookingDialogOpen && (
        <BookingDialog
          createDraft={createDraft}
          companions={bookableCompanions}
          companionsLoading={approvedCompanions === undefined}
          initialCompanionProfileId={companionProfileId}
          onClose={closeBookingDialog}
          restoreFocusTo={bookingOpenerRef.current ?? bookingTriggerRef.current}
          setNotice={setNotice}
        />
      )}
      {editingBooking && (
        <BookingRequestEditor
          booking={editingBooking}
          companion={editingCompanion ?? undefined}
          onClose={() => setEditingBooking(null)}
          onSave={async (request) => {
            await updateBookingRequest({ bookingId: editingBooking.bookingId, ...request })
            setNotice('Request updated. The Companion will see the new details.')
            setEditingBooking(null)
          }}
        />
      )}
    </WorkspaceShell>
  )
}

type Booking = NonNullable<ReturnType<typeof useQuery<typeof api.bookings.mine>>>[number]

function BookingRow({
  booking,
  onCancel,
  onComplete,
  onReview,
  onReport,
  onEditRequest,
}: {
  booking: Booking
  onCancel: () => Promise<void>
  onComplete: () => Promise<void>
  onReview: (rating: number, body: string | undefined, imageUploadIds: Id<'reviewMediaUploads'>[]) => Promise<void>
  onReport: () => Promise<void>
  onEditRequest?: (request: EditableBookingRequest) => void
}) {
  const status = statusCopy[booking.status as BookingStatus] ?? { label: booking.status, tone: 'self' as const }
  const canCancel = canCancelBooking(booking.status)
  const canComplete = canCompleteBooking(booking.status)
  const canReview = canReviewBooking(booking.status) && !booking.viewerHasReviewed
  const conversationId = useQuery(
    api.conversations.between,
    booking.companionUserId ? { otherUserId: booking.companionUserId } : 'skip',
  )

  return (
    <article id={`booking-${booking._id}`} className="worklist-row">
      <div className="worklist-row-head">
        <div className="flex items-center gap-3 min-w-0">
          <span className="avatar" aria-hidden="true">
            {'companionDisplayName' in booking ? <User aria-hidden="true" /> : '?'}
          </span>
          <div className="min-w-0">
            <h3 className="text-h3">{'companionDisplayName' in booking ? booking.companionDisplayName : 'Companion'}</h3>
            <div className="worklist-row-meta">
              <span>{booking.category}</span>
              <span className="dot" aria-hidden="true" />
              <span>{formatMode(booking.mode)}</span>
              {'companionCity' in booking && (
                <>
                  <span className="dot" aria-hidden="true" />
                  <span>{booking.companionCity}</span>
                </>
              )}
              <span className="dot" aria-hidden="true" />
              <span className="tabular">{formatRequestedAt(booking.requestedAt)}</span>
            </div>
          </div>
        </div>
        <div className="booking-card-head-actions">
          <span className="status-pill" data-tone={status.tone}>{status.label}</span>
          <BookingActionsMenu
            onCancel={canCancel ? () => void onCancel() : undefined}
            onEditRequest={booking.status === 'request_sent' && onEditRequest
              ? () => onEditRequest({
                  bookingId: booking._id,
                  companionProfileId: booking.companionProfileId,
                  companionDisplayName: 'companionDisplayName' in booking ? String(booking.companionDisplayName) : 'Companion',
                  category: booking.category,
                  mode: booking.mode,
                  requestedAt: booking.requestedAt,
                  durationMinutes: booking.durationMinutes,
                  notes: booking.notes,
                })
              : undefined}
            onReport={() => void onReport()}
          />
        </div>
      </div>

      <div className="booking-plan-context">
        <span>{status.label}</span>
      </div>

      {booking.pricingModel === 'member_wallet_v2' && booking.memberTotalCentavos !== undefined ? (
        <p className="text-meta">
          Booking total: <strong className="tabular text-[color:var(--text)]">{formatPhp(booking.memberTotalCentavos)}</strong>
          {' · '}Includes service fee.
          {booking.settlementState === 'blocked' && ' Funds are held for admin resolution because this booking has a report.'}
        </p>
      ) : booking.grossPriceCentavos !== undefined && booking.currency === 'PHP' ? (
        <p className="text-meta">Legacy locked cash amount: <strong className="tabular text-[color:var(--text)]">{formatPhp(booking.grossPriceCentavos)}</strong></p>
      ) : null}

      {booking.status === 'verification_required' && (
        <div className="notice notice-warning text-meta">
          <span className="notice-icon">!</span>
          <span>This is a legacy held booking from the earlier verification flow. Approval will send it to the Companion; rejection will cancel it.</span>
        </div>
      )}

      {booking.pricingModel === 'member_wallet_v2' && booking.status === 'accepted' && (
        <EvidenceDecision bookingId={booking._id} />
      )}

      <div className="worklist-row-actions">
        {conversationId && (
          <Link to="/messages" search={{ conversationId }} className="btn btn-social btn-sm">
            Open conversation
          </Link>
        )}
        {canComplete && !booking.memberCompletedAt && (
          <BookingCompletionAction
            onComplete={onComplete}
            requestedAt={booking.requestedAt}
            durationMinutes={booking.durationMinutes}
          />
        )}
        {canComplete && booking.memberCompletedAt && <span className="text-meta">You confirmed completion · waiting for Companion</span>}
        {canReview && (
          <ReviewForm
            onReview={onReview}
            preview={{ companionName: 'companionDisplayName' in booking ? String(booking.companionDisplayName) : 'this Companion' }}
          />
        )}
        {booking.viewerHasReviewed && <ReviewSubmittedLink reviewId={booking.viewerReviewId} />}
      </div>
    </article>
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
