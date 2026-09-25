import { CalendarDays, ChevronLeft, ChevronRight, LayoutList } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { Dialog } from '../../design-system/molecules/Dialog'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ACTIVE_BOOKING_STATUSES = new Set(['verification_required', 'pending_admin_review', 'request_sent', 'accepted'])

export type BookingsViewMode = 'calendar' | 'cards'

export type BookingStatusTone = 'self' | 'social' | 'success' | 'warning' | 'danger'

export type BookingStatusPresentation = {
  label: string
  tone: BookingStatusTone
}

export type CalendarBooking = {
  _id: string
  requestedAt: number
  status: string
  companionDisplayName?: string
  category?: string
  mode?: string
  durationMinutes?: number
}

type BookingsViewProps<TBooking extends CalendarBooking> = {
  bookings: TBooking[]
  bookingId?: string
  view: BookingsViewMode
  onViewChange: (view: BookingsViewMode) => void
  renderBooking: (booking: TBooking) => React.ReactNode
  cards: React.ReactNode
  now?: Date
  statusPresentation?: (status: string, booking: TBooking) => BookingStatusPresentation
  participantName?: (booking: TBooking) => string
}

const DEFAULT_STATUS_PRESENTATION: Record<string, BookingStatusPresentation> = {
  verification_required: { label: 'Verification required', tone: 'warning' },
  request_sent: { label: 'Request sent', tone: 'social' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  completed: { label: 'Completed', tone: 'success' },
  review_window: { label: 'Review window open', tone: 'social' },
  closed: { label: 'Closed', tone: 'self' },
}

function defaultStatusPresentation(status: string): BookingStatusPresentation {
  return DEFAULT_STATUS_PRESENTATION[status] ?? { label: status, tone: 'self' }
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function dateKey(value: Date | number) {
  const date = typeof value === 'number' ? new Date(value) : value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function longDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function timeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function durationLabel(minutes: number | undefined) {
  if (!minutes || minutes <= 0) return ''
  if (minutes % 60 === 0) return `${minutes / 60} hr`
  if (minutes > 60) return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
  return `${minutes} min`
}

function modeLabel(mode: string | undefined) {
  if (mode === 'both') return 'Online and in-person'
  if (mode === 'in_person') return 'In-person'
  if (mode === 'online') return 'Online'
  return ''
}

function defaultParticipantName(booking: CalendarBooking) {
  return booking.companionDisplayName?.trim() || 'Companion'
}

function sessionSummary(booking: CalendarBooking) {
  return [booking.category, modeLabel(booking.mode), durationLabel(booking.durationMinutes)]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' · ')
}

function initialSelection<TBooking extends CalendarBooking>(bookings: TBooking[], bookingId: string | undefined, now: Date) {
  const linkedBooking = bookingId ? bookings.find((booking) => String(booking._id) === bookingId) : undefined
  if (linkedBooking) return new Date(linkedBooking.requestedAt)

  const active = bookings
    .filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status))
    .sort((a, b) => a.requestedAt - b.requestedAt)
  const upcoming = active.find((booking) => booking.requestedAt >= now.getTime())
  if (upcoming) return new Date(upcoming.requestedAt)
  if (active.length > 0) return new Date(active[active.length - 1].requestedAt)
  return now
}

export function BookingsView<TBooking extends CalendarBooking>({
  bookings,
  bookingId,
  view,
  onViewChange,
  renderBooking,
  cards,
  now: suppliedNow,
  statusPresentation = defaultStatusPresentation,
  participantName = defaultParticipantName,
}: BookingsViewProps<TBooking>) {
  const now = useMemo(() => suppliedNow ?? new Date(), [suppliedNow])
  const startingDate = useMemo(
    () => initialSelection(bookings, bookingId, now),
    [bookingId, bookings, now],
  )
  const initialLinked = useMemo(
    () => (bookingId ? bookings.find((booking) => String(booking._id) === bookingId) : undefined),
    [bookingId, bookings],
  )
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(startingDate))
  const [openDate, setOpenDate] = useState<Date | null>(
    () => (initialLinked ? new Date(initialLinked.requestedAt) : null),
  )
  const [detailBookingId, setDetailBookingId] = useState<string | null>(
    () => (initialLinked ? String(initialLinked._id) : null),
  )
  const handledDeepLinkRef = useRef<string | null>(null)
  const pendingSummaryFocusRef = useRef<string | null>(null)
  const summaryRefs = useRef(new Map<string, HTMLButtonElement>())
  const calendarDayRefs = useRef(new Map<string, HTMLButtonElement>())
  const detailBodyRef = useRef<HTMLDivElement>(null)
  const dayListRef = useRef<HTMLDivElement>(null)
  const openerDateKeyRef = useRef<string | null>(null)
  const wasDialogOpenRef = useRef(false)
  const lastDetailRef = useRef<string | null>(detailBookingId)

  useEffect(() => {
    if (!bookingId) {
      handledDeepLinkRef.current = null
      return
    }
    if (handledDeepLinkRef.current === bookingId) return
    const linkedBooking = bookings.find((booking) => String(booking._id) === bookingId)
    if (!linkedBooking) return
    handledDeepLinkRef.current = bookingId
    const linkedDate = new Date(linkedBooking.requestedAt)
    openerDateKeyRef.current = null
    setVisibleMonth(startOfMonth(linkedDate))
    setOpenDate(linkedDate)
    setDetailBookingId(String(linkedBooking._id))
    onViewChange('calendar')
  }, [bookingId, bookings, onViewChange])

  useEffect(() => {
    if (!detailBookingId) return
    if (bookings.some((booking) => String(booking._id) === detailBookingId)) return
    setDetailBookingId(null)
  }, [bookings, detailBookingId])

  useEffect(() => {
    if (detailBookingId === null || openDate === null) return
    detailBodyRef.current?.focus()
  }, [detailBookingId, openDate])

  useEffect(() => {
    const wasDetail = lastDetailRef.current !== null
    lastDetailRef.current = detailBookingId
    if (detailBookingId !== null) return
    const pending = pendingSummaryFocusRef.current
    pendingSummaryFocusRef.current = null
    if (pending) {
      const element = summaryRefs.current.get(pending)
      if (element) {
        element.focus()
        return
      }
    }
    if (wasDetail && openDate !== null) {
      const nextSummary = dayListRef.current?.querySelector<HTMLElement>('.booking-day-booking')
      ;(nextSummary ?? dayListRef.current)?.focus()
    }
  }, [detailBookingId, openDate])

  useEffect(() => {
    const isOpen = openDate !== null
    const wasOpen = wasDialogOpenRef.current
    wasDialogOpenRef.current = isOpen
    if (!wasOpen || isOpen) return
    const key = openerDateKeyRef.current
    openerDateKeyRef.current = null
    if (!key) return
    calendarDayRefs.current.get(key)?.focus()
  }, [openDate])

  const bookingsByDate = useMemo(() => {
    const dates = new Map<string, TBooking[]>()
    for (const booking of bookings) {
      const key = dateKey(booking.requestedAt)
      dates.set(key, [...(dates.get(key) ?? []), booking])
    }
    return dates
  }, [bookings])

  const calendarDays = useMemo(() => {
    const firstWeekday = visibleMonth.getDay()
    return Array.from({ length: 42 }, (_, index) => (
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - firstWeekday + 1)
    ))
  }, [visibleMonth])
  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const openDayBookings = useMemo(() => {
    if (!openDate) return []
    const dayBookings = bookingsByDate.get(dateKey(openDate)) ?? []
    return [...dayBookings].sort((a, b) => a.requestedAt - b.requestedAt)
  }, [bookingsByDate, openDate])

  const detailBooking = detailBookingId
    ? bookings.find((booking) => String(booking._id) === detailBookingId)
    : undefined
  const showingDetail = Boolean(detailBooking)
  const dialogOpen = openDate !== null

  function openDay(date: Date) {
    openerDateKeyRef.current = dateKey(date)
    setOpenDate(date)
    setDetailBookingId(null)
    pendingSummaryFocusRef.current = null
    if (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear()) {
      setVisibleMonth(startOfMonth(date))
    }
  }

  function closeDialog() {
    setOpenDate(null)
    setDetailBookingId(null)
    pendingSummaryFocusRef.current = null
  }

  function backToDay() {
    if (detailBookingId) pendingSummaryFocusRef.current = detailBookingId
    setDetailBookingId(null)
  }

  const dayCount = openDayBookings.length
  const dayDescription = dayCount === 0
    ? 'No bookings on this date.'
    : `${dayCount} ${dayCount === 1 ? 'booking' : 'bookings'} on this date.`

  return (
    <div className="booking-views">
      <div className="booking-view-switcher" role="group" aria-label="Booking view">
        <button
          type="button"
          className="booking-view-switch"
          aria-pressed={view === 'calendar'}
          onClick={() => onViewChange('calendar')}
        >
          <CalendarDays size={16} aria-hidden="true" />
          Calendar
        </button>
        <button
          type="button"
          className="booking-view-switch"
          aria-pressed={view === 'cards'}
          onClick={() => onViewChange('cards')}
        >
          <LayoutList size={16} aria-hidden="true" />
          Cards
        </button>
      </div>

      {view === 'cards' ? cards : (
        <div className="booking-calendar-layout">
          <section className="booking-calendar-panel" aria-label="Booking calendar">
            <header className="booking-calendar-header">
              <div>
                <p className="eyebrow">Schedule</p>
                <h2 className="text-h2 mt-1" aria-live="polite">{monthLabel}</h2>
              </div>
              <div className="booking-calendar-navigation">
                <button
                  type="button"
                  className="btn btn-neutral btn-sm"
                  onClick={() => setVisibleMonth(startOfMonth(now))}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="booking-calendar-nav-button"
                  aria-label="Previous month"
                  onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="booking-calendar-nav-button"
                  aria-label="Next month"
                  onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="booking-calendar-grid" role="grid" aria-label={monthLabel}>
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="booking-calendar-weekday" role="columnheader">
                  <span className="booking-calendar-weekday-long">{weekday}</span>
                  <span className="booking-calendar-weekday-short" aria-hidden="true">{weekday.slice(0, 1)}</span>
                </div>
              ))}
              {calendarDays.map((date) => {
                const key = dateKey(date)
                const dayBookings = bookingsByDate.get(key) ?? []
                const inMonth = date.getMonth() === visibleMonth.getMonth()
                  && date.getFullYear() === visibleMonth.getFullYear()
                const selected = openDate !== null && key === dateKey(openDate)
                const today = key === dateKey(now)
                const bookingCount = dayBookings.length
                const bookingLabel = bookingCount === 1 ? '1 booking' : `${bookingCount} bookings`

                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    className="booking-calendar-day"
                    ref={(element) => {
                      if (element) {
                        calendarDayRefs.current.set(key, element)
                      } else {
                        calendarDayRefs.current.delete(key)
                      }
                    }}
                    data-outside-month={!inMonth || undefined}
                    data-has-bookings={bookingCount > 0 || undefined}
                    aria-selected={selected}
                    aria-current={today ? 'date' : undefined}
                    aria-haspopup="dialog"
                    aria-label={`${longDate(date)}${bookingCount > 0 ? `, ${bookingLabel}` : ''}`}
                    onClick={() => openDay(date)}
                  >
                    <span className="booking-calendar-day-number tabular">{date.getDate()}</span>
                    {bookingCount > 0 && (
                      <span className="booking-calendar-count tabular" aria-hidden="true">{bookingCount}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title={showingDetail && detailBooking ? 'Booking details' : openDate ? longDate(openDate) : 'Bookings'}
        description={showingDetail && detailBooking
          ? `${longDate(new Date(detailBooking.requestedAt))} · ${timeLabel(detailBooking.requestedAt)}`
          : dayDescription}
        size="large"
        footer={showingDetail ? (
          <button type="button" className="btn btn-neutral btn-sm" onClick={backToDay}>
            <ChevronLeft size={16} aria-hidden="true" />
            Back
          </button>
        ) : undefined}
      >
        {showingDetail && detailBooking ? (
          <div className="booking-detail-dialog-body" ref={detailBodyRef} tabIndex={-1}>
            {renderBooking(detailBooking)}
          </div>
        ) : (
          <div className="booking-day-list" ref={dayListRef} tabIndex={-1}>
            {openDayBookings.length > 0 ? (
              <ul className="booking-day-bookings">
                {openDayBookings.map((booking) => {
                  const presentation = statusPresentation(booking.status, booking)
                  const summary = sessionSummary(booking)
                  const id = String(booking._id)
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="booking-day-booking"
                        ref={(element) => {
                          if (element) {
                            summaryRefs.current.set(id, element)
                          } else {
                            summaryRefs.current.delete(id)
                          }
                        }}
                        onClick={() => setDetailBookingId(id)}
                      >
                        <span className="booking-day-booking-main">
                          <span className="booking-day-booking-name">{participantName(booking)}</span>
                          {summary && <span className="booking-day-booking-summary text-meta">{summary}</span>}
                        </span>
                        <span className="booking-day-booking-meta">
                          <span className="booking-day-booking-time text-meta tabular">{timeLabel(booking.requestedAt)}</span>
                          <span className="status-pill" data-tone={presentation.tone}>{presentation.label}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="booking-day-empty">
                <CalendarDays size={20} aria-hidden="true" />
                <p>No bookings on this day.</p>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
