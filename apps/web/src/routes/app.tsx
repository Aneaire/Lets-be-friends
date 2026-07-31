import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { SignInButton, useAuth } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type React from 'react'
import { activityCategories, canBookingChat, canCancelBooking, canCompleteBooking, canReadBookingMessages, canReviewBooking } from '@lets-be-friends/shared'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { WorkspaceShell } from '../components/AppShell'
import { MeetingSeam } from '../components/AppNavigation'
import { identityEntitlementStatus, memberVerificationPresentation } from '../lib/memberVerification'
import { useIdentityVerification } from '../components/IdentityVerificationFlow'

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
  const { hostProfileId } = Route.useSearch()
  const { isSignedIn } = useAuth()
  const viewer = useQuery(api.users.viewer)
  const latestMemberVerification = useQuery(api.users.latestMemberVerification, viewer ? {} : 'skip')
  const bookings = useQuery(api.bookings.mine, viewer ? {} : 'skip')
  const identityFlow = useIdentityVerification('member')
  const createDraft = useMutation(api.bookings.createDraft)
  const sendMessage = useMutation(api.bookings.sendMessage)
  const cancelBooking = useMutation(api.bookings.cancel)
  const completeBooking = useMutation(api.bookings.markCompleted)
  const submitReview = useMutation(api.reviews.submit)
  const report = useMutation(api.reports.create)
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [identityDetailsOpen, setIdentityDetailsOpen] = useState(false)
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const bookingTriggerRef = useRef<HTMLButtonElement>(null)
  const bookingOpenerRef = useRef<HTMLElement | null>(null)

  const verification = viewer
    ? memberVerificationPresentation(
        identityEntitlementStatus(viewer.verificationStatus, viewer.identityEligible),
        latestMemberVerification,
      )
    : { state: 'not_started' as const, label: 'Loading', tone: 'self' as const, guidance: 'Loading identity status…', action: 'none' as const }
  const canBook = verification.state === 'approved'
  const viewerLoading = viewer === undefined
  const approvedHosts = useQuery(
    api.hosts.listApproved,
    canBook ? {} : 'skip',
  ) as ApprovedHostOption[] | undefined
  const bookableHosts = useMemo(
    () => (approvedHosts ?? []).filter(
      (host) => host.bookable && host.viewerBookingEligibility === 'eligible' && !host.demo,
    ),
    [approvedHosts],
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
    if (hostProfileId) {
      void navigate({ to: '/app', search: {}, replace: true })
    }
  }, [hostProfileId, navigate])

  useEffect(() => {
    if (!hostProfileId || viewerLoading) return

    if (!canBook) {
      setBookingDialogOpen(false)
      setIdentityDetailsOpen(true)
      setError('Verify your identity before requesting this booking. Your selected Friend Host will remain ready after approval.')
      return
    }

    bookingOpenerRef.current = bookingTriggerRef.current
    setBookingDialogOpen(true)
  }, [canBook, hostProfileId, navigate, viewerLoading])

  if (!isSignedIn) {
    return (
      <main className="marketing-page">
        <p className="eyebrow">Sign in required</p>
        <h1 className="text-h1 mt-2">Sign in to open your workspace.</h1>
        <p className="lede mt-2">Bookings, messages, and identity status live in your signed-in workspace. Identity approval is required before booking.</p>
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
      eyebrow="Member bookings"
      title="Bookings and messages"
      description={viewer ? `Plan with approved Friend Hosts and keep every conversation in one place.` : 'Loading your bookings…'}
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
          Start a booking
        </button>
      ) : verification.action === 'none' ? null : (
        <button
          type="button"
          className="btn btn-self"
          onClick={() => void identityFlow.begin()}
          disabled={!viewer || identityFlow.busy}
        >
          {identityFlow.busy
            ? 'Opening Persona…'
            : verification.action === 'continue'
              ? 'Continue identity check'
              : verification.action === 'retry'
                ? 'Start a new identity check'
                : 'Verify identity with Persona'}
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
            <div className="rail-section-title">Member bookings</div>
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
                <p className="text-meta mt-2">No additional action is needed while the safety team reviews the completed Persona result.</p>
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
                  Start a booking
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
                    ? 'Opening Persona…'
                    : verification.action === 'continue'
                      ? 'Continue identity check'
                      : verification.action === 'retry'
                        ? 'Start a new identity check'
                        : 'Verify identity with Persona'}
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

      {(notice || identityFlow.message) && (
        <div className="notice notice-success mb-6" role="status" aria-live="polite">
          <span className="notice-icon">✓</span>
          <span>{identityFlow.message || notice}</span>
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
          <span className="text-meta tabular">{openBookings} active</span>
        </header>
        {viewer === undefined && <div className="empty-state">Loading your profile…</div>}
        {viewer && (bookings ?? []).length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">
              {canBook ? 'No bookings yet.' : 'Verify your identity before booking.'}
            </p>
            <p className="text-meta max-w-[44ch]">
              {canBook
                ? 'Choose an approved Friend Host and send your first request.'
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
                Start your first booking
              </button>
            ) : verification.action !== 'none' ? (
              <button
                type="button"
                className="btn btn-self btn-sm mt-2"
                onClick={() => void identityFlow.begin()}
                disabled={identityFlow.busy}
              >
                {identityFlow.busy
                  ? 'Opening Persona…'
                  : verification.action === 'continue'
                    ? 'Continue identity check'
                    : verification.action === 'retry'
                      ? 'Start a new identity check'
                      : 'Verify identity with Persona'}
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
                    onSendMessage={async (body) => {
                      await sendMessage({ bookingId: booking._id, body })
                      setNotice('Message sent.')
                    }}
                    onCancel={async () => {
                      await cancelBooking({ bookingId: booking._id, reason: 'Cancelled by member.' })
                      setNotice('Booking cancelled.')
                    }}
                    onComplete={async () => {
                      await completeBooking({ bookingId: booking._id })
                      setNotice('Booking marked complete. The review window is open.')
                    }}
                    onReview={async (rating, body) => {
                      await submitReview({ bookingId: booking._id, rating, body })
                      setNotice('Review submitted.')
                    }}
                    onReport={async () => {
                      await report({ targetType: 'booking', targetId: booking._id, reason: 'Needs safety review' })
                      setNotice('Report sent to the review queue.')
                    }}
                    onReportMessage={async (messageId) => {
                      await report({ targetType: 'message', targetId: messageId, reason: 'Message needs safety review' })
                      setNotice('Message report sent to the review queue.')
                    }}
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
                    onSendMessage={async (body) => {
                      await sendMessage({ bookingId: booking._id, body })
                      setNotice('Message sent.')
                    }}
                    onCancel={async () => {
                      await cancelBooking({ bookingId: booking._id, reason: 'Cancelled by member.' })
                      setNotice('Booking cancelled.')
                    }}
                    onComplete={async () => {
                      await completeBooking({ bookingId: booking._id })
                      setNotice('Booking marked complete. The review window is open.')
                    }}
                    onReview={async (rating, body) => {
                      await submitReview({ bookingId: booking._id, rating, body })
                      setNotice('Review submitted.')
                    }}
                    onReport={async () => {
                      await report({ targetType: 'booking', targetId: booking._id, reason: 'Needs safety review' })
                      setNotice('Report sent to the review queue.')
                    }}
                    onReportMessage={async (messageId) => {
                      await report({ targetType: 'message', targetId: messageId, reason: 'Message needs safety review' })
                      setNotice('Message report sent to the review queue.')
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
          hosts={bookableHosts}
          hostsLoading={approvedHosts === undefined}
          initialHostProfileId={hostProfileId}
          onClose={closeBookingDialog}
          restoreFocusTo={bookingOpenerRef.current ?? bookingTriggerRef.current}
          setNotice={setNotice}
        />
      )}
    </WorkspaceShell>
  )
}

type Booking = NonNullable<ReturnType<typeof useQuery<typeof api.bookings.mine>>>[number]

function BookingRow({
  booking,
  onSendMessage,
  onCancel,
  onComplete,
  onReview,
  onReport,
  onReportMessage,
}: {
  booking: Booking
  onSendMessage: (body: string) => Promise<void>
  onCancel: () => Promise<void>
  onComplete: () => Promise<void>
  onReview: (rating: number, body?: string) => Promise<void>
  onReport: () => Promise<void>
  onReportMessage: (messageId: Id<'messages'>) => Promise<void>
}) {
  const status = statusCopy[booking.status as BookingStatus] ?? { label: booking.status, tone: 'self' as const }
  const canChat = canBookingChat(booking.status)
  const canCancel = canCancelBooking(booking.status)
  const canComplete = canCompleteBooking(booking.status)
  const canReview = canReviewBooking(booking.status) && !booking.viewerHasReviewed
  const canReadMessages = canReadBookingMessages(booking.status)
  const messages = useQuery(api.bookings.messages, canReadMessages ? { bookingId: booking._id } : 'skip')

  return (
    <article id={`booking-${booking._id}`} className="worklist-row">
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
          <span>This is a legacy held booking from the earlier verification flow. Approval will send it to the Friend Host; rejection will cancel it.</span>
        </div>
      )}

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
          {canComplete && <button type="button" onClick={onComplete} className="btn btn-neutral btn-sm">Mark completed</button>}
          {canReview && <ReviewForm onReview={onReview} />}
          {booking.viewerHasReviewed && canReviewBooking(booking.status) && <span className="text-meta">Review submitted</span>}
          {canCancel && <button type="button" onClick={onCancel} className="btn btn-danger btn-sm">Cancel booking</button>}
          <button onClick={onReport} className="btn btn-danger btn-sm">
            Report
          </button>
      </div>
      {canReadMessages && <MessageThread messages={messages ?? []} onReport={onReportMessage} />}
    </article>
  )
}

function MessageThread({ messages, onReport }: {
  messages: Array<{ _id: Id<'messages'>; body: string; createdAt: number; senderDisplayName: string; sentByViewer: boolean }>
  onReport: (messageId: Id<'messages'>) => Promise<void>
}) {
  if (messages.length === 0) return null
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
  onClose: () => void
  restoreFocusTo: HTMLElement | null
  setNotice: (notice: string) => void
}

function BookingDialog({
  hosts,
  hostsLoading,
  initialHostProfileId,
  createDraft,
  onClose,
  restoreFocusTo,
  setNotice,
}: BookingDialogProps) {
  const [selectedHostProfileId, setSelectedHostProfileId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const hostSelectRef = useRef<HTMLSelectElement>(null)
  const submittingRef = useRef(false)
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
      if (initialHostProfileId && hosts.some((host) => host._id === initialHostProfileId)) return initialHostProfileId
      if (current && hosts.some((host) => host._id === current)) return current
      return hosts[0]?._id ?? ''
    })
  }, [hosts, initialHostProfileId])

  useEffect(() => {
    if (!modeOptions.includes(selectedMode)) setSelectedMode(modeOptions[0])
  }, [modeOptions, selectedMode])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => {
      if (hostSelectRef.current && !hostSelectRef.current.disabled) {
        hostSelectRef.current.focus()
      } else {
        dialogRef.current?.focus()
      }
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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

  const canSubmit = selectedHostProfileId.length > 0 && !isSubmitting

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
            <p className="eyebrow">New request</p>
            <MeetingSeam />
            <h2 id="booking-dialog-title" className="text-h2 mt-1">Start a booking</h2>
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
            if (!selectedHostProfileId) {
              setSubmitError('Choose an approved Friend Host before sending a booking request.')
              return
            }

            setSubmitError('')
            submittingRef.current = true
            setIsSubmitting(true)
            const form = new FormData(event.currentTarget)
            try {
              const bookingId = await createDraft({
                hostProfileId: selectedHostProfileId as Id<'hostProfiles'>,
                category: String(form.get('category')),
                mode: selectedMode,
                requestedAt: new Date(String(form.get('requestedAt'))).getTime(),
                durationMinutes: Number(form.get('durationMinutes')),
                notes: String(form.get('notes') || '') || undefined,
              })
              submittingRef.current = false
              setIsSubmitting(false)
              setNotice(`Booking ${bookingId.toString().slice(-6)} saved. Check the bookings list for next steps.`)
              onClose()
            } catch (error) {
              submittingRef.current = false
              setIsSubmitting(false)
              setSubmitError(error instanceof Error ? error.message : 'The booking request could not be sent. Try again.')
            }
          }}
        >
          {!hostsLoading && hosts.length === 0 && (
            <div className="notice notice-warning text-meta">
              <span className="notice-icon">!</span>
              <span>
                No approved hosts yet.{' '}
                <Link to="/become-host" className="notice-link">Apply to become an approved host</Link>.
              </span>
            </div>
          )}

          {submitError && (
            <div className="notice notice-danger text-meta" role="alert">
              <span className="notice-icon">!</span>
              <span>{submitError}</span>
            </div>
          )}

          <label className="field-row">
            <span className="label">Friend Host</span>
            <select
              ref={hostSelectRef}
              name="hostProfileId"
              value={selectedHostProfileId}
              onChange={(event) => setSelectedHostProfileId(event.currentTarget.value)}
              disabled={hostsLoading || hosts.length === 0 || isSubmitting}
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
            <select name="category" className="field" disabled={isSubmitting}>
              {categoryOptions.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>

          <div className="booking-dialog-paired-fields">
            <label className="field-row">
              <span className="label">Mode</span>
              <select
                value={selectedMode}
                onChange={(event) => setSelectedMode(event.currentTarget.value as 'online' | 'in_person')}
                name="mode"
                className="field"
                disabled={isSubmitting}
              >
                {modeOptions.includes('online') && <option value="online">Online</option>}
                {modeOptions.includes('in_person') && <option value="in_person">In person</option>}
              </select>
            </label>
            <label className="field-row">
              <span className="label">Duration <span className="label-aux">min</span></span>
              <input name="durationMinutes" type="number" min={15} step={15} required defaultValue="60" className="field" disabled={isSubmitting} />
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
              disabled={isSubmitting}
            />
          </label>

          <label className="field-row">
            <span className="label">Notes <span className="label-aux">visible to host on accept</span></span>
            <textarea name="notes" className="field min-h-20" disabled={isSubmitting} />
          </label>

          <button disabled={!canSubmit} className="btn btn-social btn-block">
            {isSubmitting ? 'Sending request…' : 'Send booking request'}
          </button>
          <p className="text-tiny" id="booking-dialog-guidance">
            Booking requests are available only after identity review is approved.
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
