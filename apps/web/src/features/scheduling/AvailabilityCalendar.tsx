import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_SCHEDULING_MONTH,
  SCHEDULING_TIME_ZONE,
  SCHEDULING_TIME_ZONE_LABEL,
  WEEKDAY_SHORT_NAMES,
  buildMonthGrid,
  compareSchedulingMonths,
  findAvailableSlot,
  formatDurationMinutes,
  formatManilaDayLabel,
  formatManilaTime,
  formatManilaTimestamp,
  formatSchedulingMonth,
  getManilaMonth,
  getManilaTodayKey,
  isPastDateKey,
  manilaDateKey,
  schedulingMonthKey,
  shiftSchedulingMonth,
  type AvailableSlotDay,
  type SchedulingMonth,
} from './scheduling'

export type AvailabilityCalendarProps = {
  /** Zero-based Manila month currently in view. */
  month: SchedulingMonth
  onMonthChange: (month: SchedulingMonth) => void
  /** Month days returned by `api.bookings.availableSlots`. */
  days: readonly AvailableSlotDay[]
  /** Session length the backend already filtered every start against. */
  durationMinutes: number
  /** Currently selected UTC start timestamp, or null. */
  selectedStart: number | null
  onSelectStart: (start: number | null) => void
  loading?: boolean
  error?: string | null
  /** False when the owner has not shared a weekly schedule yet. */
  scheduleConfigured?: boolean
  disabled?: boolean
  /** Injectable clock for tests and stories. */
  now?: number
  timezone?: string
}

export function AvailabilityCalendar({
  month,
  onMonthChange,
  days,
  durationMinutes,
  selectedStart,
  onSelectStart,
  loading = false,
  error = null,
  scheduleConfigured = true,
  disabled = false,
  now,
  timezone = SCHEDULING_TIME_ZONE,
}: AvailabilityCalendarProps) {
  const resolvedNow = now ?? Date.now()
  const todayKey = getManilaTodayKey(resolvedNow)
  const currentManilaMonth = getManilaMonth(resolvedNow)
  const monthLabel = formatSchedulingMonth(month)
  const monthKey = schedulingMonthKey(month)
  const cells = useMemo(() => buildMonthGrid(month), [month.year, month.month])
  const startsByDate = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const day of days) {
      map.set(day.date, day.startsAt)
    }
    return map
  }, [days])

  const selectedDay = selectedStart === null ? null : manilaDateKey(selectedStart)
  const selectedSlot = selectedStart === null ? undefined : findAvailableSlot(days, selectedStart)
  const selectedSlotIsFuture = selectedSlot !== undefined && selectedStart !== null && selectedStart > resolvedNow
  const staleSelection = selectedStart !== null && !selectedSlotIsFuture

  const [pickedDate, setPickedDate] = useState<string | null>(() => selectedStart === null ? null : manilaDateKey(selectedStart))
  const clearKey = `${monthKey}|${durationMinutes}`
  const lastClearKeyRef = useRef(clearKey)
  const selectedStartRef = useRef(selectedStart)
  const onSelectStartRef = useRef(onSelectStart)
  selectedStartRef.current = selectedStart
  onSelectStartRef.current = onSelectStart

  // Month or session length changes make the previous start unusable. Keep the
  // first render untouched so a parent can still pass an existing selection.
  useEffect(() => {
    if (lastClearKeyRef.current === clearKey) return
    lastClearKeyRef.current = clearKey
    setPickedDate(null)
    if (selectedStartRef.current !== null) onSelectStartRef.current(null)
  }, [clearKey])

  useEffect(() => {
    if (selectedDay === null) return
    if (!selectedSlotIsFuture) return
    setPickedDate((current) => current ?? selectedDay)
  }, [selectedDay, selectedSlotIsFuture])

  const availableStartsForDate = (date: string) => {
    const starts = startsByDate.get(date) ?? []
    return starts.filter((start) => start > resolvedNow).slice().sort((left, right) => left - right)
  }

  const monthHasAvailability = useMemo(
    () => days.some((day) => day.startsAt.some((start) => start > resolvedNow)),
    [days, resolvedNow],
  )

  const isDayUnavailable = (date: string, inMonth: boolean) => (
    !inMonth
    || loading
    || Boolean(error)
    || !scheduleConfigured
    || isPastDateKey(date, todayKey)
    || availableStartsForDate(date).length === 0
  )

  const controlsDisabled = disabled || loading || Boolean(error)
  const canGoPrevious = !controlsDisabled && compareSchedulingMonths(month, currentManilaMonth) > 0
  const canGoNext = !controlsDisabled && compareSchedulingMonths(month, MAX_SCHEDULING_MONTH) < 0

  function renderSlots() {
    if (loading) {
      return (
        <p className="availability-calendar-state" role="status">
          Loading available times in {timezone}...
        </p>
      )
    }
    if (error) {
      return (
        <p className="availability-calendar-state" data-tone="danger" role="alert">
          {error}
        </p>
      )
    }
    if (!scheduleConfigured) {
      return (
        <p className="availability-calendar-state" data-tone="muted">
          This Companion has not shared a weekly schedule yet.
        </p>
      )
    }
    if (staleSelection) {
      return (
        <p className="availability-calendar-state" data-tone="warning" role="status">
          The time you picked is no longer available. Choose another start time.
        </p>
      )
    }
    if (!pickedDate) {
      return (
        <p className="availability-calendar-state" data-tone="muted">
          {monthHasAvailability
            ? 'Choose an available day to see start times.'
            : 'No open times this month. Try another month.'}
        </p>
      )
    }
    const starts = availableStartsForDate(pickedDate)
    if (starts.length === 0) {
      return (
        <p className="availability-calendar-state" data-tone="muted">
          No open times remain on this day.
        </p>
      )
    }
    return (
      <div className="availability-calendar-time-list" role="group" aria-label={`Available start times on ${formatManilaDayLabel(pickedDate)}`}>
        {starts.map((start) => {
          const isSelected = selectedStart === start && selectedSlotIsFuture
          return (
            <button
              key={start}
              type="button"
              className="availability-calendar-time"
              data-selected={isSelected || undefined}
              aria-pressed={isSelected}
              aria-label={`${formatManilaTime(start)}, ${formatDurationMinutes(durationMinutes)} session`}
              disabled={controlsDisabled}
              onClick={() => onSelectStart(start)}
            >
              {formatManilaTime(start)}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <section className="availability-calendar" aria-label={`${monthLabel} availability calendar`}>
      <header className="availability-calendar-header">
        <div>
          <h3 className="availability-calendar-month" aria-live="polite">{monthLabel}</h3>
          <p className="availability-calendar-timezone">
            Times shown in {timezone === SCHEDULING_TIME_ZONE ? SCHEDULING_TIME_ZONE_LABEL : timezone}. Each start fits a {formatDurationMinutes(durationMinutes)} session.
          </p>
        </div>
        <div className="availability-calendar-nav">
          <button
            type="button"
            className="availability-calendar-nav-button"
            aria-label="Previous month"
            data-tooltip="Previous month"
            disabled={!canGoPrevious}
            onClick={() => onMonthChange(shiftSchedulingMonth(month, -1))}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="availability-calendar-nav-button"
            aria-label="Next month"
            data-tooltip="Next month"
            disabled={!canGoNext}
            onClick={() => onMonthChange(shiftSchedulingMonth(month, 1))}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="availability-calendar-grid" role="grid" aria-label={`${monthLabel} dates`}>
        <div className="availability-calendar-row" role="row">
          {WEEKDAY_SHORT_NAMES.map((weekday) => (
            <div key={weekday} className="availability-calendar-weekday" role="columnheader" aria-label={weekday}>
              {weekday}
            </div>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, weekIndex) => (
          <div key={cells[weekIndex * 7].date} className="availability-calendar-row" role="row">
            {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((cell) => {
              const past = isPastDateKey(cell.date, todayKey)
              const unavailable = isDayUnavailable(cell.date, cell.inMonth)
              const isToday = cell.date === todayKey
              const isSelected = pickedDate === cell.date
              const openCount = availableStartsForDate(cell.date).length
              const stateLabel = !cell.inMonth
                ? 'Outside this month'
                : past
                  ? 'Past date'
                  : unavailable
                    ? 'No open times'
                    : `${openCount} open ${openCount === 1 ? 'time' : 'times'}`
              return (
                <button
                  key={cell.date}
                  type="button"
                  role="gridcell"
                  className="availability-calendar-day"
                  data-outside-month={!cell.inMonth || undefined}
                  data-past={past || undefined}
                  data-unavailable={unavailable || undefined}
                  data-selected={isSelected || undefined}
                  data-today={isToday || undefined}
                  aria-selected={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${formatManilaDayLabel(cell.date)}, ${stateLabel}`}
                  disabled={unavailable || controlsDisabled}
                  onClick={() => {
                    if (selectedStart !== null && selectedDay !== cell.date) onSelectStart(null)
                    setPickedDate(cell.date)
                  }}
                >
                  <span className="availability-calendar-day-number tabular">{cell.day}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="availability-calendar-slots">
        <div className="availability-calendar-slots-header">
          <h4 className="availability-calendar-slots-title">
            {pickedDate ? formatManilaDayLabel(pickedDate) : 'Available start times'}
          </h4>
          {selectedStart !== null && selectedSlotIsFuture && (
            <span className="status-pill" data-tone="social">
              Selected {formatManilaTimestamp(selectedStart)}
            </span>
          )}
        </div>
        {renderSlots()}
      </div>
    </section>
  )
}
