// Shared, dependency-free date and slot rules for Companion weekly availability.
// The schedule is expressed in fixed Asia/Manila local time: every window is a
// minute range inside a single local day and never crosses local midnight. All
// callers (Convex backend, mobile, web) rely on this module so timezone math is
// never duplicated in the UI.

export const MANILA_TIMEZONE = 'Asia/Manila' as const
// The Philippines observes a single fixed offset (UTC+8) with no daylight
// saving, so a plain offset is exact.
export const MANILA_UTC_OFFSET_MINUTES = 8 * 60
export const MINUTES_PER_DAY = 24 * 60
export const AVAILABILITY_STEP_MINUTES = 15
export const MAX_WEEKLY_AVAILABILITY_WINDOWS = 28
// Bounded month range accepted by the slot query.
export const MIN_AVAILABILITY_MONTH = '2000-01'
export const MAX_AVAILABILITY_MONTH = '2100-12'

export type WeeklyAvailabilityWindow = {
  /** Sunday is 0 and Saturday is 6, in Manila local time. */
  weekday: number
  /** Minutes since Manila local midnight. */
  startMinutes: number
  /** Minutes since Manila local midnight, exclusive. 1440 is the day boundary. */
  endMinutes: number
}

export type BusyInterval = {
  start: number
  end: number
}

export type WeeklyAvailabilityValidation =
  | { ok: true; value: WeeklyAvailabilityWindow[] }
  | { ok: false; message: string }

/**
 * Validates and normalizes a weekly schedule. Windows are returned sorted by
 * weekday then start time so stored order is stable. Adjacent windows that touch
 * (one ends exactly when the next begins) are allowed; only true overlaps are
 * rejected.
 */
export function validateWeeklyAvailability(
  windows: readonly WeeklyAvailabilityWindow[],
): WeeklyAvailabilityValidation {
  if (windows.length > MAX_WEEKLY_AVAILABILITY_WINDOWS) {
    return { ok: false, message: `Share at most ${MAX_WEEKLY_AVAILABILITY_WINDOWS} weekly time windows.` }
  }
  const normalized: WeeklyAvailabilityWindow[] = []
  for (const window of windows) {
    if (!Number.isInteger(window.weekday) || window.weekday < 0 || window.weekday > 6) {
      return { ok: false, message: 'Choose a weekday between Sunday and Saturday.' }
    }
    if (!Number.isSafeInteger(window.startMinutes) || !Number.isSafeInteger(window.endMinutes)) {
      return { ok: false, message: 'Availability times must be whole minutes.' }
    }
    if (window.startMinutes < 0 || window.endMinutes > MINUTES_PER_DAY || window.startMinutes >= window.endMinutes) {
      return { ok: false, message: 'Each availability window must start before it ends within the same day.' }
    }
    if (
      window.startMinutes % AVAILABILITY_STEP_MINUTES !== 0
      || window.endMinutes % AVAILABILITY_STEP_MINUTES !== 0
    ) {
      return { ok: false, message: 'Availability times must use 15-minute increments.' }
    }
    normalized.push({
      weekday: window.weekday,
      startMinutes: window.startMinutes,
      endMinutes: window.endMinutes,
    })
  }
  normalized.sort((left, right) => left.weekday - right.weekday || left.startMinutes - right.startMinutes)
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1]
    const current = normalized[index]
    if (previous.weekday === current.weekday && previous.endMinutes > current.startMinutes) {
      return { ok: false, message: 'Weekly time windows cannot overlap on the same day.' }
    }
  }
  return { ok: true, value: normalized }
}

/** Parses a strict, in-range `YYYY-MM` month label, or returns null. */
export function parseAvailabilityMonth(month: string): { year: number; month: number } | null {
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) return null
  if (month < MIN_AVAILABILITY_MONTH || month > MAX_AVAILABILITY_MONTH) return null
  const monthNumber = Number(month.slice(5, 7))
  if (monthNumber < 1 || monthNumber > 12) return null
  return { year: Number(month.slice(0, 4)), month: monthNumber }
}

export function formatManilaDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseManilaDate(date: string): { year: number; month: number; day: number } | null {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    probe.getUTCFullYear() !== year
    || probe.getUTCMonth() !== month - 1
    || probe.getUTCDate() !== day
  ) return null
  return { year, month, day }
}

/** Weekday (Sunday 0 to Saturday 6) of a calendar date, independent of timezone. */
export function weekdayOfDate(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** The UTC millisecond instant of Manila local midnight for a calendar date. */
export function manilaMidnightMs(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) - MANILA_UTC_OFFSET_MINUTES * 60_000
}

export type ManilaDateParts = {
  year: number
  month: number
  day: number
  weekday: number
  date: string
  minuteOfDay: number
}

const manilaPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Breaks an instant into its Asia/Manila calendar and clock parts. */
export function manilaDateParts(timestamp: number): ManilaDateParts {
  const parts = manilaPartsFormatter.formatToParts(timestamp)
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  const year = read('year')
  const month = read('month')
  const day = read('day')
  // Some engines report midnight as hour 24 with hour12 disabled.
  const hour = read('hour') % 24
  const minute = read('minute')
  return {
    year,
    month,
    day,
    weekday: weekdayOfDate(year, month, day),
    date: formatManilaDate(year, month, day),
    minuteOfDay: hour * 60 + minute,
  }
}

/** The UTC millisecond instant of a Manila date plus a local minute-of-day. */
export function manilaInstant(date: string, minuteOfDay: number): number {
  const parsed = parseManilaDate(date)
  if (!parsed) return Number.NaN
  return manilaMidnightMs(parsed.year, parsed.month, parsed.day) + minuteOfDay * 60_000
}

/** Every `YYYY-MM-DD` date in a Manila calendar month, in order. */
export function manilaDatesInMonth(year: number, month: number): string[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const dates: string[] = []
  for (let day = 1; day <= daysInMonth; day += 1) {
    dates.push(formatManilaDate(year, month, day))
  }
  return dates
}

/**
 * True when a session of `durationMinutes` starting exactly at `requestedAt`
 * fits entirely inside one window for that Manila weekday. The start must sit on
 * a 15-minute local boundary with no leftover seconds or milliseconds, and the
 * true session end instant must stay within the window end instant. A session
 * that would cross local midnight can never fit, because windows end at or
 * before 1440.
 */
export function sessionFitsWeeklyAvailability(input: {
  windows: readonly WeeklyAvailabilityWindow[]
  requestedAt: number
  durationMinutes: number
}): boolean {
  if (!Number.isFinite(input.requestedAt) || !Number.isSafeInteger(input.requestedAt)) return false
  if (!Number.isSafeInteger(input.durationMinutes) || input.durationMinutes <= 0) return false
  const parts = manilaDateParts(input.requestedAt)
  if (parts.minuteOfDay % AVAILABILITY_STEP_MINUTES !== 0) return false
  // Reject any instant that is not exactly on the Manila minute boundary, so a
  // start such as 09:45:01 or 09:45:00.500 cannot borrow the 09:45 slot.
  if (manilaInstant(parts.date, parts.minuteOfDay) !== input.requestedAt) return false
  const endMs = input.requestedAt + input.durationMinutes * 60_000
  if (!Number.isFinite(endMs)) return false
  return input.windows.some((window) => {
    if (window.weekday !== parts.weekday) return false
    const windowStart = manilaInstant(parts.date, window.startMinutes)
    const windowEnd = manilaInstant(parts.date, window.endMinutes)
    return windowStart <= input.requestedAt && endMs <= windowEnd
  })
}

export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return bStart < aEnd && aStart < bEnd
}

/**
 * Every 15-minute start (minutes since Manila midnight) on a date where a
 * session of `durationMinutes` both fits a same-weekday window, starts strictly
 * after `now`, and does not overlap any busy interval. Busy intervals are
 * absolute instants, so accepted bookings that cross midnight or a month
 * boundary are excluded correctly.
 */
export function availableStartsForManilaDate(input: {
  date: string
  windows: readonly WeeklyAvailabilityWindow[]
  durationMinutes: number
  now: number
  busy: readonly BusyInterval[]
}): number[] {
  if (!Number.isSafeInteger(input.durationMinutes) || input.durationMinutes <= 0) return []
  const parsed = parseManilaDate(input.date)
  if (!parsed) return []
  const weekday = weekdayOfDate(parsed.year, parsed.month, parsed.day)
  const dayWindows = input.windows.filter((window) => window.weekday === weekday)
  if (dayWindows.length === 0) return []
  const durationMs = input.durationMinutes * 60_000
  const starts: number[] = []
  for (
    let minute = 0;
    minute + input.durationMinutes <= MINUTES_PER_DAY;
    minute += AVAILABILITY_STEP_MINUTES
  ) {
    if (!dayWindows.some((window) => window.startMinutes <= minute && minute + input.durationMinutes <= window.endMinutes)) {
      continue
    }
    const sessionStart = manilaInstant(input.date, minute)
    if (!Number.isFinite(sessionStart) || sessionStart <= input.now) continue
    const sessionEnd = sessionStart + durationMs
    if (input.busy.some((interval) => intervalsOverlap(sessionStart, sessionEnd, interval.start, interval.end))) {
      continue
    }
    starts.push(minute)
  }
  return starts
}
