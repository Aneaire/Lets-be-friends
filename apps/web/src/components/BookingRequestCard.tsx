import { formatPhp, type BookingStatus } from '@lets-be-friends/shared'
import { useState } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import { MeetingSeam } from './AppNavigation'

export type BookingRequestView = {
  bookingId: Id<'bookings'>
  status: BookingStatus
  category: string
  mode: 'online' | 'in_person'
  requestedAt: number
  durationMinutes: number
  notes?: string
  memberId: Id<'users'>
  memberDisplayName: string
  hostProfileId?: Id<'hostProfiles'>
  hostUserId?: Id<'users'>
  hostDisplayName: string
  serviceSubtotalCentavos?: number
  memberBookingFeeCentavos?: number
  memberTotalCentavos?: number
  hostEntitlementCentavos?: number
  settlementBlocked: boolean
}

type CardProps = {
  intro?: string
  booking: BookingRequestView
  viewerId?: Id<'users'>
  onDecide: (bookingId: Id<'bookings'>, decision: 'accepted' | 'declined') => Promise<void>
  onEdit: (booking: BookingRequestView) => void
}

export function BookingRequestCard({ intro, booking, viewerId, onDecide, onEdit }: CardProps) {
  const isRequester = viewerId !== undefined && booking.memberId === viewerId
  const pending = booking.status === 'request_sent'
  const canDecide = pending && !isRequester
  const canEdit = pending && isRequester
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const status = statusMeta(booking.status, isRequester)

  async function decide(decision: 'accepted' | 'declined') {
    setBusy(true)
    setActionError('')
    try {
      await onDecide(booking.bookingId, decision)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The decision could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="booking-request-card" data-density={pending ? 'full' : 'compact'}>
      <div className="booking-request-card-head">
        <div className="min-w-0">
          <p className="text-h3">{booking.category}</p>
          <div className="booking-request-card-meta">
            <span>{formatMode(booking.mode)}</span>
            <span className="dot" aria-hidden="true" />
            <span className="tabular">{formatBookingDate(booking.requestedAt)}</span>
            <span className="dot" aria-hidden="true" />
            <span>{formatDuration(booking.durationMinutes)}</span>
            {pending && (
              <>
                <span className="dot" aria-hidden="true" />
                <span>with {booking.hostDisplayName}</span>
              </>
            )}
          </div>
        </div>
        <span className="status-pill" data-tone={status.tone}>{status.label}</span>
      </div>

      {pending && (
        <>
          <div className="booking-plan-context">
            <MeetingSeam />
            <span>{status.label}</span>
          </div>

          {intro && <p className="booking-request-card-body">{intro}</p>}

          {booking.memberTotalCentavos !== undefined && (
            <p className="text-meta">
              {isRequester ? (
                <>
                  Booking total <strong className="tabular">{formatPhp(booking.memberTotalCentavos)}</strong>
                  {' · '}Includes service fee.
                </>
              ) : (
                <>
                  Your entitlement <strong className="tabular">{formatPhp(booking.hostEntitlementCentavos ?? 0)}</strong>
                  {' · '}the member paid {formatPhp(booking.memberTotalCentavos)} total, which includes the service fee.
                </>
              )}
            </p>
          )}

          {booking.notes && <p className="text-meta">Note: {booking.notes}</p>}
        </>
      )}

      {actionError && <p className="booking-request-card-error" role="alert">{actionError}</p>}

      <div className="booking-request-card-actions">
        {canDecide && (
          <>
            <button type="button" className="btn btn-social btn-sm" disabled={busy} onClick={() => void decide('accepted')}>
              {busy ? 'Saving…' : 'Accept request'}
            </button>
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => void decide('declined')}>
              Decline
            </button>
          </>
        )}
        {canEdit && (
          <button type="button" className="btn btn-self btn-sm" disabled={busy} onClick={() => onEdit(booking)}>
            Edit request
          </button>
        )}
      </div>
    </div>
  )
}

function statusMeta(status: BookingStatus, isRequester: boolean): { label: string; tone: 'self' | 'social' | 'success' | 'danger' } {
  switch (status) {
    case 'request_sent':
      return isRequester ? { label: 'Waiting for a decision', tone: 'social' } : { label: 'Needs your decision', tone: 'social' }
    case 'accepted':
      return { label: 'Accepted', tone: 'success' }
    case 'declined':
      return { label: 'Declined', tone: 'danger' }
    case 'cancelled':
      return { label: 'Cancelled', tone: 'danger' }
    case 'completed':
    case 'review_window':
      return { label: 'Completed', tone: 'success' }
    case 'closed':
      return { label: 'Closed', tone: 'self' }
    default:
      return { label: status.replace(/_/g, ' '), tone: 'self' }
  }
}

function formatMode(mode: 'online' | 'in_person') {
  return mode === 'in_person' ? 'In person' : 'Online'
}

function formatBookingDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDuration(minutes: number) {
  const hours = minutes / 60
  if (minutes % 60 === 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${minutes} minutes`
}
