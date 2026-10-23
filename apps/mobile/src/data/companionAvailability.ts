import {
  AVAILABILITY_STEP_MINUTES,
  MAX_WEEKLY_AVAILABILITY_WINDOWS,
  sessionFitsWeeklyAvailability,
  validateWeeklyAvailability,
  type WeeklyAvailabilityWindow,
} from '@lets-be-friends/shared'

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const AVAILABILITY_MINUTES_STEP = AVAILABILITY_STEP_MINUTES
export const MAX_AVAILABILITY_WINDOWS = MAX_WEEKLY_AVAILABILITY_WINDOWS

/** null = legacy record with no schedule (the server stays authoritative). [] = configured with no availability (the server rejects new requests). */
export function normalizeCompanionAvailability(value: unknown): WeeklyAvailabilityWindow[] | null {
  if (value === undefined) return null
  if (!Array.isArray(value)) return []
  const result = validateWeeklyAvailability(value as WeeklyAvailabilityWindow[])
  return result.ok ? result.value : []
}

export function summarizeWeeklyAvailability(windows: readonly WeeklyAvailabilityWindow[]): string {
  if (windows.length === 0) return 'No weekly availability shared yet.'
  const byDay = new Map<number, WeeklyAvailabilityWindow[]>()
  for (const window of windows) {
    const list = byDay.get(window.weekday) ?? []
    list.push(window)
    byDay.set(window.weekday, list)
  }
  const parts: string[] = []
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const dayWindows = byDay.get(weekday)
    if (!dayWindows) continue
    dayWindows.sort((a, b) => a.startMinutes - b.startMinutes)
    const ranges = dayWindows.map((window) => `${formatMinutes(window.startMinutes)} to ${formatMinutes(window.endMinutes)}`).join(', ')
    parts.push(`${WEEKDAY_SHORT[weekday]} ${ranges}`)
  }
  return parts.join('; ')
}

export type AvailabilityGate =
  | { blocked: false; notice: null }
  | { blocked: true; notice: string }

/**
 * Local gate for a chosen start. Legacy schedules (undefined) keep free input
 * and let the server decide. A configured-but-empty schedule and a start that
 * falls outside the shared windows are both rejected by the server, so the
 * forms block submit and say so.
 */
export function availabilityGate(input: {
  availability: unknown
  requestedAt: number | null
  durationMinutes: number
}): AvailabilityGate {
  const windows = normalizeCompanionAvailability(input.availability)
  if (windows === null) return { blocked: false, notice: null }
  if (windows.length === 0) {
    return {
      blocked: true,
      notice: 'This Companion has no available times right now. New requests need a shared weekly schedule, so try another Companion or check back later.',
    }
  }
  if (input.requestedAt === null) return { blocked: false, notice: null }
  const fits = sessionFitsWeeklyAvailability({ windows, requestedAt: input.requestedAt, durationMinutes: input.durationMinutes })
  if (fits) return { blocked: false, notice: null }
  return {
    blocked: true,
    notice: 'The chosen time is outside the shared weekly availability. Pick an available Manila date and time instead.',
  }
}

/** Backwards-compatible notice for read-only surfaces such as the Companion profile. */
export function availabilityFitNotice(input: {
  availability: unknown
  requestedAt: number | null
  durationMinutes: number
}): string | null {
  return availabilityGate(input).notice
}

/** Clock label for a minute-of-day value. 1440 renders as next-day midnight, never as 12 PM. */
export function formatMinutes(minutes: number) {
  const total = ((minutes % 1440) + 1440) % 1440
  const hour = Math.floor(total / 60)
  const minute = total % 60
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`
}

const MANILA_TIME = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
})

const MANILA_DAY = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

/** UTC millisecond timestamps render in fixed Asia/Manila wall-clock time. */
export function formatManilaTime(timestamp: number) {
  return MANILA_TIME.format(new Date(timestamp))
}

export function formatManilaDay(timestamp: number) {
  return MANILA_DAY.format(new Date(timestamp))
}

/** Current Manila calendar month as `{ year, monthIndex }`. */
export function currentManilaMonth(now = Date.now()): { year: number; monthIndex: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).format(new Date(now))
  const [year, month] = parts.split('-').map(Number)
  return { year, monthIndex: month - 1 }
}

/** Strict `YYYY-MM` label accepted by `bookings.availableSlots`. */
export function manilaMonthKey(month: { year: number; monthIndex: number }) {
  return `${String(month.year).padStart(4, '0')}-${String(month.monthIndex + 1).padStart(2, '0')}`
}

export function shiftManilaMonth(month: { year: number; monthIndex: number }, delta: number) {
  const total = month.year * 12 + month.monthIndex + delta
  return { year: Math.floor(total / 12), monthIndex: ((total % 12) + 12) % 12 }
}

export function manilaMonthForTimestamp(timestamp: number) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).format(new Date(timestamp))
  const [year, month] = parts.split('-').map(Number)
  return { year, monthIndex: month - 1 }
}

export function canShiftManilaMonth(
  month: { year: number; monthIndex: number },
  delta: number,
  now = Date.now(),
) {
  const next = shiftManilaMonth(month, delta)
  const current = currentManilaMonth(now)
  const nextIndex = next.year * 12 + next.monthIndex
  const currentIndex = current.year * 12 + current.monthIndex
  return next.year >= 2000 && next.year <= 2100 && nextIndex >= currentIndex
}

export type BookingAvailabilityStatus = 'available' | 'not_verified' | 'no_listed_rate' | 'unavailable' | undefined

export function bookingRequestGate(input: {
  scheduleConfigured: boolean
  availability: unknown
  bookingAvailability: BookingAvailabilityStatus
  slotsLoading: boolean
  selectedSlotValid: boolean
  requestedAt: number | null
  durationMinutes: number
}): AvailabilityGate {
  if (input.bookingAvailability === undefined) return { blocked: true, notice: 'Checking whether this Companion can accept a new booking.' }
  if (input.bookingAvailability !== 'available') {
    return { blocked: true, notice: bookingAvailabilityNotice(input.bookingAvailability) ?? 'This Companion is not currently available for new bookings.' }
  }
  if (input.scheduleConfigured && input.slotsLoading) return { blocked: true, notice: 'Available times are still loading.' }
  if (input.scheduleConfigured && (!input.selectedSlotValid || input.requestedAt === null)) {
    return { blocked: true, notice: 'Choose a currently available Manila date and time before continuing.' }
  }
  return availabilityGate({ availability: input.availability, requestedAt: input.requestedAt, durationMinutes: input.durationMinutes })
}

export function bookingAvailabilityNotice(status: BookingAvailabilityStatus): string | null {
  if (status === undefined || status === 'available') return null
  if (status === 'not_verified') return 'This Companion is not verified yet, so they cannot take new bookings.'
  if (status === 'no_listed_rate') return 'This Companion has no listed rate, so new bookings are paused.'
  return 'This Companion is not currently available for new bookings.'
}

export function manilaMonthLabel(month: { year: number; monthIndex: number }) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(month.year, month.monthIndex, 1)))
}
