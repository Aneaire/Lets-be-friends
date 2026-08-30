import { CalendarDays, ChevronLeft, ChevronRight, LayoutList } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type React from 'react'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ACTIVE_BOOKING_STATUSES = new Set(['verification_required', 'request_sent', 'accepted'])

export type BookingsViewMode = 'calendar' | 'cards'

export type CalendarBooking = {
  _id: string
  requestedAt: number
  status: string
}

type BookingsViewProps<TBooking extends CalendarBooking> = {
  bookings: TBooking[]
  bookingId?: string
  view: BookingsViewMode
  onViewChange: (view: BookingsViewMode) => void
  renderBooking: (booking: TBooking) => React.ReactNode
  cards: React.ReactNode
  now?: Date
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
}: BookingsViewProps<TBooking>) {
  const now = useMemo(() => suppliedNow ?? new Date(), [suppliedNow])
  const startingDate = useMemo(
    () => initialSelection(bookings, bookingId, now),
    [bookingId, bookings, now],
  )
  const [selectedDate, setSelectedDate] = useState(startingDate)
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(startingDate))

  useEffect(() => {
    if (!bookingId) return
    const linkedBooking = bookings.find((booking) => String(booking._id) === bookingId)
    if (!linkedBooking) return
    const linkedDate = new Date(linkedBooking.requestedAt)
    setSelectedDate(linkedDate)
    setVisibleMonth(startOfMonth(linkedDate))
    onViewChange('calendar')
  }, [bookingId, bookings, onViewChange])

  const bookingsByDate = useMemo(() => {
    const dates = new Map<string, TBooking[]>()
    for (const booking of bookings) {
      const key = dateKey(booking.requestedAt)
      dates.set(key, [...(dates.get(key) ?? []), booking])
    }
    return dates
  }, [bookings])

  const selectedBookings = bookingsByDate.get(dateKey(selectedDate)) ?? []
  const calendarDays = useMemo(() => {
    const firstWeekday = visibleMonth.getDay()
    return Array.from({ length: 42 }, (_, index) => (
      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - firstWeekday + 1)
    ))
  }, [visibleMonth])
  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  function chooseDate(date: Date) {
    setSelectedDate(date)
    if (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear()) {
      setVisibleMonth(startOfMonth(date))
    }
  }

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
                  onClick={() => {
                    setSelectedDate(now)
                    setVisibleMonth(startOfMonth(now))
                  }}
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
                const selected = key === dateKey(selectedDate)
                const today = key === dateKey(now)
                const bookingCount = dayBookings.length
                const bookingLabel = bookingCount === 1 ? '1 booking' : `${bookingCount} bookings`

                return (
                  <button
                    key={key}
                    type="button"
                    role="gridcell"
                    className="booking-calendar-day"
                    data-outside-month={!inMonth || undefined}
                    data-has-bookings={bookingCount > 0 || undefined}
                    aria-selected={selected}
                    aria-current={today ? 'date' : undefined}
                    aria-label={`${longDate(date)}${bookingCount > 0 ? `, ${bookingLabel}` : ''}`}
                    onClick={() => chooseDate(date)}
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

          <section className="booking-day-panel" aria-labelledby="selected-booking-date">
            <header className="booking-day-header">
              <p className="eyebrow">Selected day</p>
              <h2 id="selected-booking-date" className="text-h2 mt-1">{longDate(selectedDate)}</h2>
              <p className="text-meta mt-1 tabular">
                {selectedBookings.length === 0
                  ? 'No bookings'
                  : `${selectedBookings.length} ${selectedBookings.length === 1 ? 'booking' : 'bookings'}`}
              </p>
            </header>
            {selectedBookings.length > 0 ? (
              <div className="worklist booking-day-worklist">
                {selectedBookings.map((booking) => (
                  <div key={booking._id}>{renderBooking(booking)}</div>
                ))}
              </div>
            ) : (
              <div className="booking-day-empty">
                <CalendarDays size={20} aria-hidden="true" />
                <p>Choose a marked date to see its booking details.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
