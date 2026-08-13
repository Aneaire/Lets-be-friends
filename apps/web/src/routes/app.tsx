import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { toast } from 'sonner'
import type React from 'react'
import { activityCategories, calculateMemberWalletBookingPrice, canCancelBooking, canCompleteBooking, canReviewBooking, formatPhp } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { WorkspaceShell } from '../components/AppShell'
import { BookingRequestEditor, type EditableBookingRequest } from '../components/BookingRequestEditor'
import { MeetingSeam } from '../components/AppNavigation'
import { BookingRequestFields } from '../components/BookingRequestFields'
import { BookingActionsMenu } from '../components/BookingActionsMenu'
import { identityEntitlementStatus, memberVerificationPresentation } from '../lib/memberVerification'
import { useIdentityVerification } from '../components/IdentityVerificationFlow'
import { prepareEvidenceImage } from '../lib/chatAttachments'
import { findCompanions } from '../lib/discoverySearch'

export const Route = createFileRoute('/app')({
  validateSearch: (search: Record<string, unknown>): { companionProfileId?: string } => (
    typeof search.companionProfileId === 'string' ? { companionProfileId: search.companionProfileId } : {}
  ),
  component: AppPage,
})

type ApprovedCompanionOption = {
  _id: string
  username?: string
  displayName: string
  city: string
  intro?: string
  bio?: string
  strengths?: string[]
  mode: 'online' | 'in_person' | 'both'
  categories?: string[]
  profileImageUrl?: string
  hourlyRateCentavos?: number
  bookable?: boolean
  viewerCanBook?: boolean
  viewerBookingEligibility?: 'eligible' | 'sign_in_required' | 'verification_required' | 'own_profile'
  demo?: boolean
}

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
  const { companionProfileId } = Route.useSearch()
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer)
  const latestMemberVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const bookings = useQuery(api.bookings.mine, viewer ? {} : 'skip')
  const memberFinance = useQuery(api.finance.memberDashboard, viewer ? {} : 'skip')
  const identityFlow = useIdentityVerification('member')
  const createDraft = useMutation(api.bookings.createDraft)
  const createMemberTopUp = useAction(api.paymongo.createMemberTopUp)
  const addTestCredit = useMutation(api.finance.addTestCredit)
  const cancelBooking = useMutation(api.bookings.cancel)
  const completeBooking = useMutation(api.bookings.markCompleted)
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
  const [walletDialogOpen, setWalletDialogOpen] = useState(false)
  const bookingTriggerRef = useRef<HTMLButtonElement>(null)
  const bookingOpenerRef = useRef<HTMLElement | null>(null)
  const walletTriggerRef = useRef<HTMLButtonElement>(null)

  const verification = viewer
    ? memberVerificationPresentation(
        identityEntitlementStatus(viewer.verificationStatus, viewer.identityEligible),
        latestMemberVerification,
        viewer.identityTestBypassActive,
      )
    : { state: 'not_started' as const, label: 'Loading', tone: 'self' as const, guidance: 'Loading identity status…', action: 'none' as const }
  const canBook = verification.state === 'approved'
  const viewerLoading = viewer === undefined
  const approvedCompanions = useQuery(
    api.companions.listApproved,
    canBook ? {} : 'skip',
  ) as ApprovedCompanionOption[] | undefined
  const bookableCompanions = useMemo(
    () => (approvedCompanions ?? []).filter(
      (companion) => companion.bookable && companion.viewerBookingEligibility === 'eligible' && !companion.demo,
    ),
    [approvedCompanions],
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

  const closeWalletDialog = useCallback(() => {
    setWalletDialogOpen(false)
  }, [])

  useEffect(() => {
    if (!companionProfileId || viewerLoading) return

    if (!canBook) {
      setBookingDialogOpen(false)
      setIdentityDetailsOpen(true)
      setError('Verify your identity before requesting this booking. Your selected Companion will remain ready after approval.')
      return
    }

    bookingOpenerRef.current = bookingTriggerRef.current
    setBookingDialogOpen(true)
  }, [canBook, companionProfileId, navigate, viewerLoading])

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

  const openBookings = (bookings ?? []).filter((booking) =>
    ['request_sent', 'accepted', 'verification_required'].includes(booking.status),
  ).length
  const completedBookings = (bookings ?? []).filter((booking) =>
    ['completed', 'review_window', 'closed', 'declined', 'cancelled'].includes(booking.status),
  ).length

  const heldBooking = (bookings ?? []).find((booking) => booking.status === 'verification_required')

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
          <a href="#bookings" className="workspace-mobile-nav-link is-active">
            <span>Open</span>
            <span className="tabular">{openBookings}</span>
          </a>
          <a href="#archive" className="workspace-mobile-nav-link">
            <span>Past</span>
            <span className="tabular">{completedBookings}</span>
          </a>
        </>
      }
      rail={
        <>
          <div className="rail-section">
            <div className="rail-section-title">Your bookings</div>
            <a href="#bookings" className="rail-link is-active" aria-current="location">
              <span>Open</span>
              <span className="rail-link-count tabular">{openBookings}</span>
            </a>
            <a href="#archive" className="rail-link">
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
          <h2 className="text-h2">Open bookings</h2>
          <div className="flex items-center gap-2">
            <span className="text-meta tabular">{openBookings} active</span>
            <button
              ref={walletTriggerRef}
              type="button"
              className="btn btn-self-quiet btn-sm tabular"
              onClick={() => setWalletDialogOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={walletDialogOpen}
              aria-controls="booking-balance-dialog"
            >
              Balance {memberFinance ? formatPhp(memberFinance.availableCentavos) : '…'}
            </button>
          </div>
        </header>
        {viewer === undefined && <div className="empty-state">Loading your profile…</div>}
        {viewer && (bookings ?? []).length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">
              {canBook ? 'No bookings yet.' : 'Verify once before sending a booking request.'}
            </p>
            <p className="text-meta max-w-[44ch]">
              {canBook
                ? 'Explore people, find an experience that feels right, and request a time.'
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
                Find someone to join you
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
                    onReview={async (rating, body) => {
                      await submitReview({ bookingId: booking._id, rating, body })
                      setNotice('Review submitted.')
                    }}
                    onReport={async () => {
                      await report({ targetType: 'booking', targetId: booking._id, reason: 'Needs safety review' })
                      setNotice('Report sent to the review queue.')
                    }}
                    onEditRequest={(bookingRequest) => setEditingBooking(bookingRequest)}
                  />
                ))}
            </div>
          </div>
        )}
      </section>

      {(bookings ?? []).filter((booking) =>
        ['completed', 'review_window', 'closed', 'declined', 'cancelled'].includes(booking.status),
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
                  ['completed', 'review_window', 'closed', 'declined', 'cancelled'].includes(booking.status),
                )
                .map((booking) => (
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
                    onReview={async (rating, body) => {
                      await submitReview({ bookingId: booking._id, rating, body })
                      setNotice('Review submitted.')
                    }}
                    onReport={async () => {
                      await report({ targetType: 'booking', targetId: booking._id, reason: 'Needs safety review' })
                      setNotice('Report sent to the review queue.')
                    }}
                  />
                ))}
            </div>
          </div>
        </section>
      )}

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
      {walletDialogOpen && (
        <WalletDialog
          finance={memberFinance}
          onClose={closeWalletDialog}
          restoreFocusTo={walletTriggerRef.current}
          onCreateTopUp={async (amountCentavos) => {
            const result = await createMemberTopUp({ amountCentavos })
            setNotice(result.qrImageUrl
              ? `QR Ph top-up for ${formatPhp(result.amountCentavos)} is ready to scan.`
              : 'PayMongo is confirming the QR Ph top-up. Your wallet will update only after provider verification.')
          }}
          onAddTestCredit={async (amountCentavos) => {
            const result = await addTestCredit({ amountCentavos })
            setNotice(`${formatPhp(result.amountCentavos)} test balance added. Available to book: ${formatPhp(result.availableCentavos)}.`)
          }}
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

type MemberFinance = NonNullable<ReturnType<typeof useQuery<typeof api.finance.memberDashboard>>>

function MemberWalletPanel({ finance, onCreateTopUp, onAddTestCredit }: {
  finance: MemberFinance | null | undefined
  onCreateTopUp: (amountCentavos: number) => Promise<void>
  onAddTestCredit: (amountCentavos: number) => Promise<void>
}) {
  const refreshMemberTopUp = useAction(api.paymongo.refreshMemberTopUp)
  const refreshInFlightRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [walletError, setWalletError] = useState('')
  const [clockNow, setClockNow] = useState(() => Date.now())
  const activeTopUp = finance?.topUps.find((topUp) =>
    ['creating', 'awaiting_payment', 'processing'].includes(topUp.status)
    && (topUp.expiresAt === undefined || topUp.expiresAt > clockNow),
  )
  const qrTopUp = activeTopUp ?? finance?.topUps.find((topUp) => topUp.qrImageUrl && topUp.status !== 'paid')
  const qrExpired = Boolean(qrTopUp?.expiresAt && qrTopUp.expiresAt <= clockNow)
  const showPayableQr = Boolean(
    qrTopUp?.qrImageUrl
    && ['awaiting_payment', 'processing'].includes(qrTopUp.status)
    && !qrExpired,
  )

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!activeTopUp?.providerIntentId) return
    let cancelled = false
    let timer: number | undefined

    const poll = async () => {
      if (cancelled) return
      if (refreshInFlightRef.current) {
        timer = window.setTimeout(() => void poll(), 250)
        return
      }
      refreshInFlightRef.current = true
      let terminal = false
      try {
        const refreshed = await refreshMemberTopUp({ topUpId: activeTopUp._id })
        terminal = isTerminalProviderTopUpStatus(refreshed.providerStatus)
          || (refreshed.expiresAt !== undefined && refreshed.expiresAt <= Date.now())
      } catch {
        // Provider or network failures are retried while this dialog remains open.
      } finally {
        refreshInFlightRef.current = false
      }
      if (!cancelled && !terminal) timer = window.setTimeout(() => void poll(), 3_000)
    }

    void poll()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [activeTopUp?._id, activeTopUp?.providerIntentId, refreshMemberTopUp])

  return (
    <section id="member-wallet" className="mb-10">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-h2">Balance</h2>
          <p className="text-meta mt-1">Use this balance for booking requests. You will see the complete booking total, including the service fee, before sending.</p>
        </div>
        {finance && <span className="status-pill" data-tone="success">{formatPhp(finance.availableCentavos)} available</span>}
      </header>
      {walletError && <div className="notice notice-danger mb-3" role="alert"><span className="notice-icon">!</span><span>{walletError}</span></div>}
      {!finance && <div className="empty-state">Loading booking wallet…</div>}
      {finance && (
        <div className="panel p-5 space-y-5">
          {!finance.enabled && (
            <div className="notice notice-warning text-meta"><span className="notice-icon">!</span><span>New member-wallet bookings are disabled on this server. Existing balances and settlements remain readable.</span></div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="wallet-metric wallet-metric-available"><p className="text-meta">Available to book</p><p className="text-h2 tabular mt-1">{formatPhp(finance.availableCentavos)}</p></div>
            <div className="wallet-metric wallet-metric-pending"><p className="text-meta">Reserved for accepted bookings</p><p className="text-h2 tabular mt-1">{formatPhp(finance.reservedCentavos)}</p></div>
          </div>
          <div className="member-wallet-actions-grid">
            {finance.testCreditEnabled && (
              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault()
                  setBusy(true)
                  setWalletError('')
                  try {
                    const form = new FormData(event.currentTarget)
                    await onAddTestCredit(Math.round(Number(form.get('testCreditPesos')) * 100))
                  } catch (submitError) {
                    setWalletError(submitError instanceof Error ? submitError.message : 'Test balance could not be added.')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <div><p className="text-h3">Add test balance</p><p className="text-meta mt-1">For testing only. This adds internal booking credit and does not charge a payment method.</p></div>
                <label className="field-row"><span className="label">Amount <span className="label-aux">PHP</span></span><input name="testCreditPesos" type="number" min="1" max="100000" step="0.01" defaultValue="1000" required className="field" disabled={busy} /></label>
                <button className="btn btn-self" disabled={busy}>{busy ? 'Adding test balance…' : 'Add test balance'}</button>
              </form>
            )}
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault()
                setBusy(true)
                setWalletError('')
                try {
                  const form = new FormData(event.currentTarget)
                  await onCreateTopUp(Math.round(Number(form.get('topUpPesos')) * 100))
                } catch (submitError) {
                  setWalletError(submitError instanceof Error ? submitError.message : 'Top-up could not be started.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <div><p className="text-h3">Add balance with PayMongo QR Ph</p><p className="text-meta mt-1">Only a provider-verified paid intent credits this wallet.</p></div>
              <label className="field-row"><span className="label">Top-up amount <span className="label-aux">PHP</span></span><input name="topUpPesos" type="number" min="100" max="100000" step="0.01" defaultValue="1000" required className="field" disabled={busy || Boolean(activeTopUp) || !finance.enabled} /></label>
              <button className="btn btn-self" disabled={busy || Boolean(activeTopUp) || !finance.enabled}>{busy ? 'Creating QR…' : activeTopUp ? 'QR attempt still active' : 'Create QR Ph top-up'}</button>
            </form>
            <div className="member-wallet-qr-card rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface-subtle)] p-4">
              <p className="text-h3">Current QR attempt</p>
              {!qrTopUp && <p className="text-meta mt-2">No member-wallet top-up attempt yet.</p>}
              {qrTopUp && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="tabular">{formatPhp(qrTopUp.amountCentavos)}</strong>
                    <span className="status-pill" data-tone={qrTopUp.status === 'paid' ? 'success' : qrTopUp.status === 'failed' || qrTopUp.status === 'expired' || qrExpired ? 'danger' : 'social'}>
                      {qrExpired && qrTopUp.status !== 'paid' ? 'expired' : qrTopUp.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  {qrTopUp.expiresAt !== undefined && !qrExpired && ['awaiting_payment', 'processing'].includes(qrTopUp.status) && (
                    <p className="text-meta tabular" role="timer">QR expires in {formatQrCountdown(qrTopUp.expiresAt - clockNow)}</p>
                  )}
                  {qrExpired && qrTopUp.status !== 'paid' && <p className="text-meta">This QR expired. You can create a fresh top-up.</p>}
                  {showPayableQr && qrTopUp.qrImageUrl && (
                    <>
                      <img src={qrTopUp.qrImageUrl} alt={`QR Ph code for ${formatPhp(qrTopUp.amountCentavos)} wallet top-up`} className="mx-auto max-w-64 rounded-lg bg-white p-3" />
                      <a href={qrTopUp.qrImageUrl} download={`lets-be-friends-qr-ph-${qrTopUp._id}.png`} className="btn btn-neutral btn-sm">
                        Download QR
                      </a>
                      <p className="text-meta">Download the QR if you need to pay from this phone.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function isTerminalProviderTopUpStatus(status: string) {
  return ['succeeded', 'paid', 'failed', 'cancelled', 'expired'].includes(status)
}

function formatQrCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function WalletDialog({ finance, onClose, restoreFocusTo, onCreateTopUp, onAddTestCredit }: {
  finance: MemberFinance | null | undefined
  onClose: () => void
  restoreFocusTo: HTMLElement | null
  onCreateTopUp: (amountCentavos: number) => Promise<void>
  onAddTestCredit: (amountCentavos: number) => Promise<void>
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => restoreFocusTo?.focus())
    }
  }, [onClose, restoreFocusTo])

  return (
    <div className="booking-dialog-backdrop booking-wallet-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialogRef} id="booking-balance-dialog" className="booking-dialog booking-wallet-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-balance-dialog-title" tabIndex={-1}>
        <header className="booking-dialog-header">
          <div>
            <p className="eyebrow">Your booking wallet</p>
            <MeetingSeam />
            <h2 id="booking-balance-dialog-title" className="text-h2 mt-1">Balance</h2>
          </div>
          <button type="button" className="social-icon-button booking-dialog-close" aria-label="Close balance" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="booking-dialog-body">
          <MemberWalletPanel finance={finance} onCreateTopUp={onCreateTopUp} onAddTestCredit={onAddTestCredit} />
        </div>
      </div>
    </div>
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
  onReview: (rating: number, body?: string) => Promise<void>
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
            {'companionDisplayName' in booking ? initials(booking.companionDisplayName as string) : '?'}
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
        <MeetingSeam />
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
        <EvidenceDecision bookingId={booking._id} label="End evidence" />
      )}

      <div className="worklist-row-actions">
        {conversationId && (
          <Link to="/messages" search={{ conversationId }} className="btn btn-social btn-sm">
            Open conversation
          </Link>
        )}
        {canComplete && !booking.memberCompletedAt && <button type="button" onClick={onComplete} className="btn btn-social-quiet btn-sm">Confirm completion</button>}
        {canComplete && booking.memberCompletedAt && <span className="text-meta">You confirmed completion · waiting for Companion</span>}
        {canReview && <ReviewForm onReview={onReview} />}
        {booking.viewerHasReviewed && canReviewBooking(booking.status) && <span className="text-meta">Review submitted</span>}
      </div>
    </article>
  )
}

function EvidenceDecision({ bookingId, label }: { bookingId: Id<'bookings'>; label: string }) {
  const evidence = useQuery(api.bookingEvidence.status, { bookingId })
  const uploadImage = useAction(api.bookingEvidence.uploadImage)
  const skip = useMutation(api.bookingEvidence.skip)
  const [busy, setBusy] = useState(false)
  const [evidenceError, setEvidenceError] = useState('')

  if (evidence?.decision) {
    return <div className="evidence-decision"><p className="text-meta"><strong>{label}:</strong> {evidence.decision === 'uploaded' ? 'Private image saved' : 'Skipped after warning acknowledgement'}.</p></div>
  }

  return (
    <div className="evidence-decision">
      <div><p className="text-h3">{label}</p><p className="text-meta mt-1">Optional and private. A reviewer or admin can retrieve it only while a linked booking report is active, and each retrieval is audited. Your counterpart cannot access it.</p></div>
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
            if (!window.confirm('Strict warning: skipping means no private image from your role will be available to help reviewers evaluate a later booking report. Skip anyway?')) return
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

type BookingDialogProps = {
  companions: ApprovedCompanionOption[]
  companionsLoading: boolean
  initialCompanionProfileId?: string
  createDraft: (args: {
    companionProfileId: Id<'companionProfiles'>
    category: string
    mode: 'online' | 'in_person'
    requestedAt: number
    durationMinutes: number
    notes?: string
  }) => Promise<{ bookingId: Id<'bookings'>; memberTotalCentavos: number; serviceSubtotalCentavos: number; memberBookingFeeCentavos: number; currency: 'PHP' }>
  onClose: () => void
  restoreFocusTo: HTMLElement | null
  setNotice: (notice: string) => void
}

function BookingDialog({
  companions,
  companionsLoading,
  initialCompanionProfileId,
  createDraft,
  onClose,
  restoreFocusTo,
  setNotice,
}: BookingDialogProps) {
  const [selectedCompanionProfileId, setSelectedCompanionProfileId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const companionSearchRef = useRef<HTMLInputElement>(null)
  const companionSearchRootRef = useRef<HTMLDivElement>(null)
  const companionSearchOpenRef = useRef(false)
  const submittingRef = useRef(false)
  const [companionQuery, setCompanionQuery] = useState('')
  const [companionSearchOpen, setCompanionSearchOpenState] = useState(false)
  const setCompanionSearchOpen = useCallback((open: boolean) => {
    companionSearchOpenRef.current = open
    setCompanionSearchOpenState(open)
  }, [])
  const selectedCompanion = companions.find((companion) => companion._id === selectedCompanionProfileId)
  const companionSearchResults = useMemo(() => {
    if (!companionQuery.trim()) return []
    return findCompanions(companions.map((companion) => ({
      ...companion,
      intro: companion.intro ?? '',
    })), companionQuery).slice(0, 6)
  }, [companionQuery, companions])
  const categoryOptions = selectedCompanion?.categories?.length ? selectedCompanion.categories : activityCategories
  const [selectedMode, setSelectedMode] = useState<'online' | 'in_person'>('online')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const initialRequestedAt = useMemo(() => new Date(Date.now() + 86400000), [])
  const [requestedAt, setRequestedAt] = useState<Date>(() => new Date(Date.now() + 86400000))
  const [requestedTime, setRequestedTime] = useState(() => `${String(initialRequestedAt.getHours()).padStart(2, '0')}:${String(initialRequestedAt.getMinutes()).padStart(2, '0')}`)
  const estimatedPrice = selectedCompanion?.hourlyRateCentavos && durationMinutes >= 15 && durationMinutes <= 720 && durationMinutes % 15 === 0
    ? calculateMemberWalletBookingPrice(selectedCompanion.hourlyRateCentavos, durationMinutes)
    : undefined
  const modeOptions = useMemo<Array<'online' | 'in_person'>>(() => {
    if (selectedCompanion?.mode === 'in_person') return ['in_person']
    if (selectedCompanion?.mode === 'online') return ['online']
    return ['online', 'in_person']
  }, [selectedCompanion?.mode])

  useEffect(() => {
    const options: readonly string[] = categoryOptions
    if (!options.includes(category)) setCategory(categoryOptions[0] ?? '')
  }, [categoryOptions, category])

  useEffect(() => {
    setSelectedCompanionProfileId((current) => {
      if (initialCompanionProfileId && companions.some((companion) => companion._id === initialCompanionProfileId)) {
        const initialCompanion = companions.find((companion) => companion._id === initialCompanionProfileId)
        setCompanionQuery(initialCompanion?.displayName ?? '')
        return initialCompanionProfileId
      }
      if (current && companions.some((companion) => companion._id === current)) return current
      return ''
    })
  }, [companions, initialCompanionProfileId])

  useEffect(() => {
    if (!companionSearchOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!companionSearchRootRef.current?.contains(event.target as Node)) setCompanionSearchOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [companionSearchOpen])

  useEffect(() => {
    if (!modeOptions.includes(selectedMode)) setSelectedMode(modeOptions[0])
  }, [modeOptions, selectedMode])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => {
      if (companionSearchRef.current && !companionSearchRef.current.disabled) {
        companionSearchRef.current.focus()
      } else {
        dialogRef.current?.focus()
      }
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (companionSearchOpenRef.current) {
          event.preventDefault()
          companionSearchOpenRef.current = false
          setCompanionSearchOpen(false)
          return
        }
        if (submittingRef.current) return
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0)

      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement
      if (event.shiftKey && (activeElement === first || activeElement === dialogRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (activeElement === last || activeElement === dialogRef.current)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => restoreFocusTo?.focus())
    }
  }, [onClose, restoreFocusTo])

  const canSubmit = selectedCompanionProfileId.length > 0 && !isSubmitting

  return (
    <div
      className="booking-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose()
      }}
    >
      <div
        ref={dialogRef}
        id="booking-dialog"
        className="booking-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-dialog-title"
        aria-describedby="booking-dialog-guidance"
        tabIndex={-1}
      >
        <header className="booking-dialog-header">
          <div>
            <p className="eyebrow">New booking</p>
            <MeetingSeam />
            <h2 id="booking-dialog-title" className="text-h2 mt-1">{selectedCompanion ? `Book with ${selectedCompanion.displayName.trim().split(/\s+/)[0] ?? ''}` : 'Book a time'}</h2>
          </div>
          <button
            type="button"
            className="social-icon-button booking-dialog-close"
            aria-label="Close booking dialog"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <form
          className="booking-dialog-body"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!selectedCompanionProfileId) {
              setSubmitError('Choose an approved Companion before sending a booking.')
              return
            }

            setSubmitError('')
            submittingRef.current = true
            setIsSubmitting(true)
            const requestDate = new Date(requestedAt)
            const [hours, minutes] = requestedTime.split(':').map(Number)
            requestDate.setHours(hours || 0, minutes || 0, 0, 0)
            if (requestDate.getTime() <= Date.now()) {
              submittingRef.current = false
              setIsSubmitting(false)
              setSubmitError('Choose a time in the future.')
              return
            }
            try {
              const booking = await createDraft({
                companionProfileId: selectedCompanionProfileId as Id<'companionProfiles'>,
                category,
                mode: selectedMode,
                requestedAt: requestDate.getTime(),
                durationMinutes,
                notes: notes.trim() || undefined,
              })
              submittingRef.current = false
              setIsSubmitting(false)
              setNotice(`Booking ${booking.bookingId.toString().slice(-6)} sent for ${formatPhp(booking.memberTotalCentavos)} from your booking wallet when the Companion accepts.`)
              onClose()
            } catch (error) {
              submittingRef.current = false
              setIsSubmitting(false)
              setSubmitError(error instanceof Error ? error.message : 'The booking could not be sent. Try again.')
            }
          }}
        >
          {!companionsLoading && companions.length === 0 && (
            <div className="notice notice-warning text-meta">
              <span className="notice-icon">!</span>
              <span>
                No approved companions yet.{' '}
                <Link to="/become-companion" className="notice-link">Share what you enjoy as a Companion</Link>.
              </span>
            </div>
          )}

          {submitError && (
            <div className="notice notice-danger text-meta" role="alert">
              <span className="notice-icon">!</span>
              <span>{submitError}</span>
            </div>
          )}

          <div className="field-row booking-companion-search-root" ref={companionSearchRootRef}>
            <label className="label" htmlFor="booking-companion-search">Companion</label>
            <div className="booking-companion-search" role="search">
              <Search size={18} aria-hidden="true" />
              <input
                ref={companionSearchRef}
                id="booking-companion-search"
                type="search"
                value={companionQuery}
                placeholder="Search by username, name, Strength, activity, or city"
                aria-label="Search Companions"
                aria-expanded={companionSearchOpen}
                aria-controls="booking-companion-search-results"
                aria-autocomplete="list"
                autoComplete="off"
                disabled={companionsLoading || companions.length === 0 || isSubmitting}
                required
                onFocus={() => setCompanionSearchOpen(true)}
                onClick={() => setCompanionSearchOpen(true)}
                onChange={(event) => {
                  setCompanionQuery(event.currentTarget.value)
                  setSelectedCompanionProfileId('')
                  setCompanionSearchOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && companionSearchResults.length > 0) {
                    event.preventDefault()
                    companionSearchRootRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus()
                  }
                }}
              />
              {companionQuery && (
                <button
                  type="button"
                  className="booking-companion-search-clear"
                  aria-label="Clear Companion search"
                  disabled={isSubmitting}
                  onClick={() => {
                    setCompanionQuery('')
                    setSelectedCompanionProfileId('')
                    setCompanionSearchOpen(true)
                    companionSearchRef.current?.focus()
                  }}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>

            {companionSearchOpen && (
              <div id="booking-companion-search-results" className="booking-companion-search-panel">
                {!companionQuery.trim() ? (
                  <p className="booking-companion-search-guidance">Search Companions by username, name, Strength, activity, or city.</p>
                ) : companionsLoading ? (
                  <p className="booking-companion-search-guidance" role="status">Searching…</p>
                ) : companionSearchResults.length === 0 ? (
                  <p className="booking-companion-search-guidance" role="status">No Companions match “{companionQuery.trim()}”.</p>
                ) : (
                  <>
                    <p className="booking-companion-search-summary" role="status">
                      {companionSearchResults.length} {companionSearchResults.length === 1 ? 'match' : 'matches'}
                    </p>
                    <ul className="booking-companion-search-list" role="listbox" aria-label="Companion search results">
                      {companionSearchResults.map((companion) => (
                        <li key={companion._id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={companion._id === selectedCompanionProfileId}
                            className="booking-companion-search-result"
                            onClick={() => {
                              setSelectedCompanionProfileId(companion._id)
                              setCompanionQuery(companion.displayName)
                              companionSearchRef.current?.focus()
                              setCompanionSearchOpen(false)
                            }}
                          >
                            <span className="booking-companion-search-avatar" aria-hidden="true">
                              {companion.profileImageUrl
                                ? <img src={companion.profileImageUrl} alt="" />
                                : initials(companion.displayName)}
                            </span>
                            <span>
                              <strong>{companion.displayName}</strong>
                              <small>{[companion.username ? `@${companion.username}` : undefined, companion.city, companion.strengths?.[0] ?? companion.categories?.[0]].filter(Boolean).join(' · ')}</small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>

          <BookingRequestFields
            category={category}
            categoryOptions={categoryOptions}
            onCategoryChange={setCategory}
            mode={selectedMode}
            modeOptions={modeOptions}
            onModeChange={setSelectedMode}
            durationMinutes={durationMinutes}
            onDurationMinutesChange={setDurationMinutes}
            requestedAt={requestedAt}
            requestedTime={requestedTime}
            onRequestedDayChange={(date) => {
              const [hours, minutes] = requestedTime.split(':').map(Number)
              const next = new Date(date)
              next.setHours(hours || 0, minutes || 0, 0, 0)
              setRequestedAt(next)
            }}
            onRequestedTimeChange={setRequestedTime}
            notes={notes}
            onNotesChange={setNotes}
            estimate={estimatedPrice}
            disabled={isSubmitting}
          />

          <button disabled={!canSubmit} className="btn btn-social btn-block">
            {isSubmitting ? 'Sending…' : 'Send booking'}
          </button>
          <p className="text-tiny" id="booking-dialog-guidance">
            Bookings are available only after identity review is approved.
          </p>
        </form>
      </div>
    </div>
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
