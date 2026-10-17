import { User, X } from 'lucide-react'
import type { FormEvent, MouseEvent, ReactNode, Ref } from 'react'

// Presentational shell for the booking dialog. It owns the centered modal
// frame, the stable header, and the single internal scroll container so the
// connected `BookingDialog` and browser stories render the exact same chrome
// instead of hand-rolled markup.

export type BookingDialogCompanionSummaryProps = {
  label?: string
  displayName: string
  username?: string
  city?: string
  detail?: string
  profileImageUrl?: string
}

/**
 * Square, bounded Companion avatar. Shared by the fixed identity row and the
 * search results so a large profile image can never blow out either layout.
 */
export function BookingDialogCompanionAvatar({ profileImageUrl }: { profileImageUrl?: string }) {
  return (
    <span className="booking-companion-search-avatar" aria-hidden="true">
      {profileImageUrl ? <img src={profileImageUrl} alt="" /> : <User aria-hidden="true" />}
    </span>
  )
}

/**
 * Compact, bounded Companion identity row. The avatar is a fixed square so a
 * large profile image can never blow the dialog layout open, and the text
 * wraps instead of pushing the row wider than its column.
 */
export function BookingDialogCompanionSummary({
  label = 'Companion',
  displayName,
  username,
  city,
  detail,
  profileImageUrl,
}: BookingDialogCompanionSummaryProps) {
  const meta = [username ? `@${username}` : undefined, city, detail].filter(Boolean).join(' · ')
  return (
    <div className="field-row booking-dialog-companion-row">
      <span className="label">{label}</span>
      <div className="booking-companion-fixed">
        <BookingDialogCompanionAvatar profileImageUrl={profileImageUrl} />
        <span className="booking-companion-summary-text">
          <strong>{displayName}</strong>
          {meta ? <small>{meta}</small> : null}
        </span>
      </div>
    </div>
  )
}

export type BookingDialogLayoutProps = {
  /** Availability calendar, shown first and beside the details on wide screens. */
  calendar?: ReactNode
  details: ReactNode
}

/**
 * Two-column workspace on wide screens, stacked with the calendar first when
 * the calendar and details cannot sit side by side.
 */
export function BookingDialogLayout({ calendar, details }: BookingDialogLayoutProps) {
  if (!calendar) {
    return <div className="booking-dialog-details">{details}</div>
  }
  return (
    <div className="booking-dialog-layout">
      <div className="booking-dialog-calendar">{calendar}</div>
      <div className="booking-dialog-details">{details}</div>
    </div>
  )
}

export type BookingDialogFrameProps = {
  eyebrow?: string
  title: string
  onClose: () => void
  closeDisabled?: boolean
  /** Element id that describes the dialog, used for `aria-describedby`. */
  describedById?: string
  dialogRef?: Ref<HTMLDivElement>
  onBackdropMouseDown?: (event: MouseEvent<HTMLDivElement>) => void
  /** When supplied the body renders as a form so Enter submits like production. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  children: ReactNode
}

export function BookingDialogFrame({
  eyebrow = 'New booking',
  title,
  onClose,
  closeDisabled = false,
  describedById,
  dialogRef,
  onBackdropMouseDown,
  onSubmit,
  children,
}: BookingDialogFrameProps) {
  return (
    <div className="booking-dialog-backdrop" onMouseDown={onBackdropMouseDown}>
      <div
        ref={dialogRef}
        id="booking-dialog"
        className="booking-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-dialog-title"
        aria-describedby={describedById}
        tabIndex={-1}
      >
        <header className="booking-dialog-header">
          <div className="booking-dialog-heading">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id="booking-dialog-title" className="text-h2 mt-1">{title}</h2>
          </div>
          <button
            type="button"
            className="social-icon-button booking-dialog-close"
            aria-label="Close booking dialog"
            onClick={onClose}
            disabled={closeDisabled}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        {onSubmit ? (
          <form className="booking-dialog-body" onSubmit={onSubmit}>{children}</form>
        ) : (
          <div className="booking-dialog-body">{children}</div>
        )}
      </div>
    </div>
  )
}
