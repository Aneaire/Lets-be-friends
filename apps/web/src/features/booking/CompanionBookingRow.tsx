import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { User } from 'lucide-react'
import type { ReactNode } from 'react'
import { canCancelBooking, canCompleteBooking, canReviewBooking, formatPhp } from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '../../design-system/atoms/Button'
import { ReviewForm } from '../profile/ReviewForm'
import { CompanionSettlementPanel } from './CompanionSettlementPanel'
import { EvidenceDecision } from './EvidenceDecision'
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
  const status = companionStatusPresentation(booking.status)
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
        <CompanionSettlementPanel
          settlementState={booking.settlementState}
          settlementEligibleAt={booking.settlementEligibleAt}
          companionEarningsCentavos={booking.companionEarningsCentavos}
          memberTotalCentavos={booking.memberTotalCentavos}
        />
      ) : booking.grossPriceCentavos !== undefined && booking.currency === 'PHP' ? (
        <p className="text-meta">Legacy cash amount: <strong className="tabular text-[color:var(--text)]">{formatPhp(booking.grossPriceCentavos)}</strong> · Legacy commission {formatPhp(booking.commissionCentavos ?? 0)}</p>
      ) : null}
      {booking.notes && <p className="text-body muted max-w-[72ch]">{booking.notes}</p>}

      {evidenceSlot}

      <div className="worklist-row-actions">
        {canDecide && (
          <>
            <Button size="small" onClick={onAccept}>Accept</Button>
            <Button size="small" intent="danger" onClick={onDecline}>Decline</Button>
          </>
        )}
        {canComplete && !booking.companionCompletedAt && <Button size="small" onClick={onComplete}>Confirm completion</Button>}
        {canComplete && booking.companionCompletedAt && <span className="text-meta">You confirmed completion · waiting for member</span>}
        {canReview && reviewSlot}
        {booking.viewerHasReviewed && reviewWindowOpen && <span className="text-meta">Review submitted</span>}
        {canCancel && <Button size="small" intent="danger" onClick={onCancel}>Cancel booking</Button>}
        {conversationLink}
        <Button size="small" intent="danger" onClick={onReport}>Report</Button>
      </div>
    </article>
  )
}

type CompanionBookingRowProps = {
  booking: CompanionBooking
  onAccept: () => Promise<void>
  onDecline: () => Promise<void>
  onCancel: () => Promise<void>
  onComplete: () => Promise<void>
  onReview: (rating: number, body?: string, imageUploadId?: Id<'reviewMediaUploads'>) => Promise<void>
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
      reviewSlot={canReview ? <ReviewForm onReview={onReview} /> : undefined}
      evidenceSlot={showEvidence ? (
        <EvidenceDecision
          bookingId={booking._id}
          label="Start evidence"
          guidance="You make the start decision. The image is optional and private; a reviewer or admin can retrieve it only with an active linked booking report, and each retrieval is audited. The member cannot access it."
          skipWarning="Strict warning: skipping means no private start image will be available to help reviewers evaluate a later booking report. Skip anyway?"
        />
      ) : undefined}
      conversationLink={conversationId ? (
        <Link to="/messages" search={{ conversationId }} className="btn btn-social btn-sm">Open conversation</Link>
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
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
