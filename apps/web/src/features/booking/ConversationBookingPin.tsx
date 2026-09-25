import { Ellipsis, Flag, X } from 'lucide-react'
import { useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { IconButton } from '../../design-system/atoms/IconButton'
import { Dialog } from '../../design-system/molecules/Dialog'
import { BookingRequestCard, type BookingRequestView } from './BookingRequestCard'

type ConversationBookingPinProps = {
  booking: BookingRequestView
  intro?: string
  viewerId?: Id<'users'>
  history: BookingRequestView[]
  onDecide: (bookingId: Id<'bookings'>, decision: 'accepted' | 'declined') => Promise<void>
  onEdit: (booking: BookingRequestView) => void
  onReport?: () => void
  onDismiss: () => void
}

export function ConversationBookingPin({
  booking,
  intro,
  viewerId,
  history,
  onDecide,
  onEdit,
  onReport,
  onDismiss,
}: ConversationBookingPinProps) {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <section className="conversation-booking-pin" aria-label="Current booking">
      <div className="conversation-booking-pin-head">
        <span className="conversation-booking-pin-label">Current booking</span>
        <div className="conversation-booking-pin-tools">
          <IconButton
            label="View previous bookings"
            tone="social"
            size="small"
            aria-haspopup="dialog"
            onClick={() => setHistoryOpen(true)}
          >
            <Ellipsis size={17} aria-hidden="true" />
          </IconButton>
          <IconButton label="Hide current booking" size="small" onClick={onDismiss}>
            <X size={16} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <BookingRequestCard
        intro={intro}
        booking={booking}
        viewerId={viewerId}
        onDecide={onDecide}
        onEdit={onEdit}
      />

      {onReport && (
        <button
          type="button"
          className="direct-message-report conversation-booking-pin-report"
          aria-label="Report booking request"
          title="Report booking request"
          onClick={onReport}
        >
          <Flag size={14} aria-hidden="true" />
        </button>
      )}

      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Previous bookings"
        description="Every other booking shared in this conversation, newest first."
      >
        {history.length === 0 ? (
          <p className="conversation-booking-history-empty">No previous bookings in this conversation yet.</p>
        ) : (
          <ul className="conversation-booking-history">
            {history.map((previous) => (
              <li key={previous.bookingId}>
                <BookingRequestCard
                  booking={previous}
                  viewerId={viewerId}
                  readOnly
                  onDecide={async () => {}}
                  onEdit={() => {}}
                />
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </section>
  )
}
