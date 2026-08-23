import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type React from 'react'

export type CalendarValue = string | Date | null | undefined

export type CalendarVariant = 'self' | 'social'

export interface CalendarProps {
  value: CalendarValue
  onChange: (date: Date) => void
  variant?: CalendarVariant
  min?: Date
  max?: Date
  defaultMonth?: Date
  disabled?: boolean
  label?: React.ReactNode
  'aria-label'?: string
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toDate(value: CalendarValue): Date | null {
  if (!value) return null
  const date = value instanceof Date ? new Date(value) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

interface DayCell {
  date: Date
  inMonth: boolean
}

export function Calendar({ value, onChange, variant = 'self', min, max, defaultMonth, disabled, 'aria-label': ariaLabel }: CalendarProps) {
  const resolvedInitial = useMemo<Date>(() => {
    const fromValue = toDate(value)
    if (fromValue) return fromValue
    const fromDefault = toDate(defaultMonth)
    if (fromDefault) return fromDefault
    return new Date()
  }, [value, defaultMonth])

  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(resolvedInitial))
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const popId = useId()

  const selected = toDate(value)
  const today = new Date()

  const cells = useMemo<DayCell[]>(() => {
    const first = startOfMonth(viewMonth)
    const startWeekday = first.getDay()
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
    const leading = startWeekday
    const total = Math.ceil((leading + daysInMonth) / 7) * 7
    return Array.from({ length: total }, (_, index) => {
      const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), index - leading + 1)
      return { date, inMonth: isSameMonth(date, viewMonth) }
    })
  }, [viewMonth])

  const canGoPrev = useMemo(() => {
    if (!min) return true
    return startOfMonth(viewMonth) > startOfMonth(min)
  }, [viewMonth, min])

  const canGoNext = useMemo(() => {
    if (!max) return true
    const lastOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
    return lastOfMonth < max
  }, [viewMonth, max])

  const shiftMonth = useCallback((delta: number) => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }, [])

  useEffect(() => {
    if (open && selected) {
      setViewMonth((current) => (isSameMonth(current, selected) ? current : startOfMonth(selected)))
    }
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, selected])

  const anchorTime = selected ?? resolvedInitial

  const isDisabledDate = (date: Date) => {
    if (min && date < startOfDay(min)) return true
    if (max && date > endOfDay(max)) return true
    return false
  }

  function select(date: Date) {
    if (isDisabledDate(date)) return
    const picked = new Date(date.getFullYear(), date.getMonth(), date.getDate(), anchorTime.getHours(), anchorTime.getMinutes())
    onChange(picked)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={rootRef} className="calendar-root" data-accent={variant}>
      <button
        ref={triggerRef}
        type="button"
        className="calendar-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={ariaLabel ?? (selected ? selected.toLocaleDateString() : 'Pick a date')}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="calendar-trigger-value">
          {selected ? (
            <>
              <span className="calendar-trigger-date">{selected.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="calendar-trigger-year">, {selected.getFullYear()}</span>
            </>
          ) : (
            <span className="calendar-trigger-date calendar-trigger-placeholder">Pick a day</span>
          )}
        </span>
        <span className="calendar-trigger-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          ref={popRef}
          id={popId}
          role="dialog"
          aria-modal="false"
          aria-label="Pick a date"
          className="calendar-pop"
          tabIndex={-1}
        >
          <p className="eyebrow calendar-label">When</p>
          <div className="calendar-nav">
            <button type="button" className="calendar-nav-btn" aria-label="Previous month" disabled={!canGoPrev} onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <div className="calendar-month-name" aria-live="polite">
              {MONTH_NAMES[viewMonth.getMonth()]} <span className="calendar-year-pill">{viewMonth.getFullYear()}</span>
            </div>
            <button type="button" className="calendar-nav-btn" aria-label="Next month" disabled={!canGoNext} onClick={() => shiftMonth(1)}>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="calendar-grid" role="grid" aria-label="Date grid">
            {WEEKDAYS.map((label) => (
              <div key={label} className="calendar-weekday" role="columnheader">{label}</div>
            ))}
            {cells.map(({ date, inMonth }) => {
              const isSelectedDay = !!selected && isSameDay(date, selected)
              const isToday = isSameDay(date, today)
              const isDisabled = isDisabledDate(date)
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  role="gridcell"
                  className="calendar-day"
                  data-in-month={inMonth}
                  data-selected={isSelectedDay}
                  data-today={isToday}
                  onClick={() => select(date)}
                  aria-selected={isSelectedDay}
                  disabled={isDisabled}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          {selected && (
            <div className="calendar-foot">
              <span className="calendar-foot-value">{selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}