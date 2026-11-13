import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { User } from 'lucide-react'
import type { ReactNode } from 'react'
import { canCancelBooking, canCompleteBooking, canReviewBooking, formatPhp } from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '../../design-system/atoms/Button'
import { ReviewForm } from '../profile/ReviewForm'
import { BookingCompletionAction } from './BookingCompletionAction'
import { CompanionSettlementPanel } from './CompanionSettlementPanel'
import { EvidenceDecision } from './EvidenceDecision'
import { ReviewSubmittedLink } from './ReviewSubmittedLink'
import type { CompanionBooking } from './combinedBookings'

export type CompanionBookingStatus =
  | 'verification_required'
  | 'pending_admin_review'
  | 'request_sent'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed'
  | 'review_window'
  | 'closed'

export type CompanionStatusPresentation = {
  label: string
  tone: 'self' | 'social' | 'success' | 'warning' | 'danger'
}

export const companionStatusCopy: Record<CompanionBookingStatus, CompanionStatusPresentation> = {
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

export function companionStatusPresentation(status: string): CompanionStatusPresentation {
  return companionStatusCopy[status as CompanionBookingStatus] ?? { label: status, tone: 'self' }
}

type CompanionBookingRowViewProps = {
  booking: CompanionBooking
  onAccept: () => Promise<void>
  onDecline: () => Promise<void>
  onCancel: () => Promise<void>
  onComplete: () => Promise<void>
  onReport: () => Promise<void>
  reviewSlot?: ReactNode
  evidenceSlot?: ReactNode
  conversationLink?: ReactNode
}

export function CompanionBookingRowView({
  booking,
  onAccept,
  onDecline,
  onCancel,
  onComplete,
  onReport,
  reviewSlot,
  evidenceSlot,
  conversationLink,
}: CompanionBookingRowViewProps) {
  const status = booking.status === 'accepted' && booking.companionCompletedAt
    ? { label: 'Waiting for member', tone: 'warning' as const }
    : companionStatusPresentation(booking.status)
  const canDecide = booking.status === 'request_sent'
  const canCancel = canCancelBooking(booking.status)
  const canComplete = canCompleteBooking(booking.status)
  const reviewWindowOpen = canReviewBooking(booking.status)
  const canReview = reviewWindowOpen && !booking.viewerHasReviewed

  return (
    <article id={`companion-booking-${booking._id}`} className="worklist-row">
      <div className="worklist-row-head">
        <div className="flex items-center gap-3 min-w-0">
          <span className="avatar" aria-hidden="true"><User aria-hidden="true" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/member-profile" search={{ userId: String(booking.memberId) }} className="text-h3 underline-offset-4 hover:underline">
                {booking.memberDisplayName}
              </Link>
              {booking.memberIdentityApproved && (
                <span className="status-pill" data-tone="success">Identity verified</span>
              )}
            </div>
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
        <CompanionSettlementPanel
          settlementState={booking.settlementState}
          settlementEligibleAt={booking.settlementEligibleAt}
          companionEarningsCentavos={booking.companionEarningsCentavos}
          memberTotalCentavos={booking.memberTotalCentavos}
          bookingStatus={booking.status}
        />
      ) : booking.grossPriceCentavos !== undefined && booking.currency === 'PHP' ? (
        <p className="text-meta">Cash booking recorded before wallet payments: <strong className="tabular text-[color:var(--text)]">{formatPhp(booking.grossPriceCentavos)}</strong> · Platform commission {formatPhp(booking.commissionCentavos ?? 0)}</p>
      ) : null}
      {booking.notes && <p className="text-body muted max-w-[72ch]">{booking.notes}</p>}

      <div className="worklist-row-actions">
        {canDecide && (
          <>
            <Button size="small" intent="social" onClick={onAccept}>Accept</Button>
            <Button size="small" intent="ghost" className="text-[color:var(--danger)]" onClick={onDecline}>Decline</Button>
          </>
        )}
        {canComplete && !booking.companionCompletedAt && (
          <BookingCompletionAction
            onComplete={onComplete}
            requestedAt={booking.requestedAt}
            durationMinutes={booking.durationMinutes}
          />
        )}
        {canComplete && booking.companionCompletedAt && <span className="text-meta">You confirmed completion · waiting for member</span>}
        {canReview && reviewSlot}
        {booking.viewerHasReviewed && <ReviewSubmittedLink reviewId={booking.viewerReviewId} />}
        {canCancel && !canDecide && !booking.companionCompletedAt && !booking.memberCompletedAt && <Button size="small" intent="ghost" className="text-[color:var(--danger)]" onClick={onCancel}>Cancel booking</Button>}
        {conversationLink}
        <Button size="small" intent="ghost" className="text-[color:var(--danger)]" onClick={onReport}>Report</Button>
      </div>

      {evidenceSlot && (
        <details className="booking-evidence-disclosure">
          <summary>Booking evidence <span className="text-meta">Optional and private</span></summary>
          {evidenceSlot}
        </details>
      )}
    </article>
  )
}

type CompanionBookingRowProps = {
  booking: CompanionBooking
  onAccept: () => Promise<void>
  onDecline: () => Promise<void>
  onCancel: () => Promise<void>
  onComplete: () => Promise<void>
  onReview: (rating: number, body: string | undefined, imageUploadIds: Id<'reviewMediaUploads'>[]) => Promise<void>
  onReport: () => Promise<void>
}

export function CompanionBookingRow({
  booking,
  onAccept,
  onDecline,
  onCancel,
  onComplete,
  onReview,
  onReport,
}: CompanionBookingRowProps) {
  const conversationId = useQuery(api.conversations.between, { otherUserId: booking.memberId })
  const canReview = canReviewBooking(booking.status) && !booking.viewerHasReviewed
  const showEvidence = booking.pricingModel === 'member_wallet_v2' && booking.status === 'accepted'

  return (
    <CompanionBookingRowView
      booking={booking}
      onAccept={onAccept}
      onDecline={onDecline}
      onCancel={onCancel}
      onComplete={onComplete}
      onReport={onReport}
      reviewSlot={canReview ? <ReviewForm primary onReview={onReview} /> : undefined}
      evidenceSlot={showEvidence ? <EvidenceDecision bookingId={booking._id} /> : undefined}
      conversationLink={conversationId ? (
        <Link
          to="/messages"
          search={{ conversationId }}
          className="btn btn-neutral btn-sm"
        >
          Open conversation
        </Link>
      ) : undefined}
    />
  )
}

function formatMode(mode: string) {
  if (mode === 'both') return 'Online and in-person'
  if (mode === 'in_person') return 'In-person'
  return 'Online'
}

function formatRequestedAt(timestamp: number) {
  if (!timestamp) return ''
  const formatted = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
  return `${formatted} PHT`
}
