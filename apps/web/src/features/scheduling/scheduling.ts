// Shared scheduling vocabulary for Companion availability.
//
// The calendar works in two independent coordinate systems:
//   * UTC millisecond timestamps for Manila wall-clock starts, formatted with
//     Intl and the shared Manila time zone helpers;
//   * plain YYYY-MM-DD keys for the month grid, never parsed as the viewer's
//     local calendar.
//
// Validation and window shape live in `@lets-be-friends/shared`. This module
// only adds the small presentation helpers the calendar and editor need.

import {
  AVAILABILITY_STEP_MINUTES,
  MANILA_TIMEZONE,
  MAX_AVAILABILITY_MONTH,
  MAX_WEEKLY_AVAILABILITY_WINDOWS,
  formatManilaDate,
  manilaDateParts,
  validateWeeklyAvailability as validateSharedWeeklyAvailability,
  type WeeklyAvailabilityValidation,
  type WeeklyAvailabilityWindow,
} from '@lets-be-friends/shared'

export type { WeeklyAvailabilityWindow, WeeklyAvailabilityValidation }

export const SCHEDULING_TIME_ZONE = MANILA_TIMEZONE
export const SCHEDULING_TIME_ZONE_LABEL = 'Asia/Manila (PHT)'
export const SLOT_MINUTES = AVAILABILITY_STEP_MINUTES
export const MAX_WEEKLY_WINDOWS = MAX_WEEKLY_AVAILABILITY_WINDOWS

export type SchedulingMonth = {
  /** Calendar year in Asia/Manila. */
  year: number
  /** Zero-based month, matching JavaScript month indexes. */
  month: number
}

const [MAX_YEAR, MAX_MONTH] = MAX_AVAILABILITY_MONTH.split('-').map(Number)
export const MAX_SCHEDULING_MONTH: SchedulingMonth = { year: MAX_YEAR, month: MAX_MONTH - 1 }

export type AvailableSlotDay = {
  /** YYYY-MM-DD in Asia/Manila. */
  date: string
  /** UTC millisecond timestamps for Manila wall-clock starts. */
  startsAt: number[]
}

export type AvailableSlotsResult = {
  timezone: string
  scheduleConfigured: boolean
  days: AvailableSlotDay[]
}

export type AvailabilityWindowInput = {
  startMinutes: number
  endMinutes: number
}

export type WeekdayAvailability = {
  weekday: number
  windows: AvailabilityWindowInput[]
}

export type CalendarGridCell = {
  /** YYYY-MM-DD in Asia/Manila. */
  date: string
  day: number
  inMonth: boolean
  weekday: number
}

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const WEEKDAY_SHORT_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

const MANILA_TIME = new Intl.DateTimeFormat('en-PH', {
  timeZone: MANILA_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
})

const MANILA_TIMESTAMP = new Intl.DateTimeFormat('en-PH', {
  timeZone: MANILA_TIMEZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const MONTH_LABEL = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
})

const DAY_LABEL = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function manilaDateKey(timestamp: number): string {
  return manilaDateParts(timestamp).date
}

export function getManilaMonth(now: number = Date.now()): SchedulingMonth {
  const parts = manilaDateParts(now)
  return { year: parts.year, month: parts.month - 1 }
}

export function getManilaTodayKey(now: number = Date.now()): string {
  return manilaDateParts(now).date
}

export function schedulingMonthKey(month: SchedulingMonth): string {
  return `${month.year}-${pad2(month.month + 1)}`
}

export function isSameSchedulingMonth(left: SchedulingMonth, right: SchedulingMonth) {
  return left.year === right.year && left.month === right.month
}

/** Negative when `left` is earlier than `right`, zero when equal, positive when later. */
export function compareSchedulingMonths(left: SchedulingMonth, right: SchedulingMonth): number {
  if (left.year !== right.year) return left.year - right.year
  return left.month - right.month
}

export function shiftSchedulingMonth(month: SchedulingMonth, amount: number): SchedulingMonth {
  const shifted = new Date(Date.UTC(month.year, month.month + amount, 1))
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() }
}

export function formatSchedulingMonth(month: SchedulingMonth): string {
  return MONTH_LABEL.format(Date.UTC(month.year, month.month, 1))
}

export function formatManilaDayLabel(date: string): string {
  return DAY_LABEL.format(utcDateFromKey(date))
}

export function formatManilaTime(timestamp: number): string {
  return MANILA_TIME.format(timestamp)
}

export function formatManilaTimestamp(timestamp: number): string {
  return MANILA_TIMESTAMP.format(timestamp)
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60} hr`
  return `${minutes} min`
}

function utcDateFromKey(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return Number.NaN
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function buildMonthGrid(month: SchedulingMonth): CalendarGridCell[] {
  const firstOfMonth = new Date(Date.UTC(month.year, month.month, 1))
  const firstWeekday = firstOfMonth.getUTCDay()
  const daysInMonth = new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate()
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(Date.UTC(month.year, month.month, index - firstWeekday + 1))
    return {
      date: formatManilaDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month.month && date.getUTCFullYear() === month.year,
      weekday: date.getUTCDay(),
    }
  })
}

export function isPastDateKey(date: string, today: string): boolean {
  return date < today
}

export function findAvailableSlot(days: readonly AvailableSlotDay[], timestamp: number): AvailableSlotDay | undefined {
  return days.find((day) => day.startsAt.includes(timestamp))
}

export function isEndOfDay(minutes: number): boolean {
  return minutes === 24 * 60
}

export function toMinutesFromTimeInput(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return Number.NaN
  return Number(match[1]) * 60 + Number(match[2])
}

export function toTimeInputValue(minutes: number): string {
  // The shared model allows endMinutes 1440 for the Manila day boundary, but a
  // native `type="time"` control cannot represent 24:00. The editor shows an
  // explicit end-of-day control for that value instead of this function.
  if (!Number.isFinite(minutes) || minutes < 0 || minutes >= 24 * 60) return ''
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return `${pad2(hours)}:${pad2(rest)}`
}

export function createWeekdayAvailability(
  initialAvailability?: readonly WeeklyAvailabilityWindow[],
): WeekdayAvailability[] {
  return WEEKDAY_NAMES.map((_, weekday) => ({
    weekday,
    windows: (initialAvailability ?? [])
      .filter((window) => window.weekday === weekday)
      .slice()
      .sort((left, right) => left.startMinutes - right.startMinutes)
      .map((window) => ({
        startMinutes: window.startMinutes,
        endMinutes: window.endMinutes,
      })),
  }))
}

export function flattenWeekdayAvailability(days: readonly WeekdayAvailability[]): WeeklyAvailabilityWindow[] {
  return days.flatMap((day) => day.windows
    .slice()
    .sort((left, right) => left.startMinutes - right.startMinutes)
    .map((window) => ({
      weekday: day.weekday,
      startMinutes: window.startMinutes,
      endMinutes: window.endMinutes,
    })))
}

export function weeklyAvailabilitySignature(availability?: readonly WeeklyAvailabilityWindow[]): string {
  return (availability ?? [])
    .map((window) => `${window.weekday}:${window.startMinutes}-${window.endMinutes}`)
    .sort()
    .join('|')
}

export function weekdayAvailabilitySignature(days: readonly WeekdayAvailability[]): string {
  return flattenWeekdayAvailability(days)
    .map((window) => `${window.weekday}:${window.startMinutes}-${window.endMinutes}`)
    .join('|')
}

/**
 * Validates editor state with the shared rules, then adds the weekday name the
 * owner was editing so a rejected save points at the right day.
 */
export function validateWeekdayAvailability(days: readonly WeekdayAvailability[]): WeeklyAvailabilityValidation {
  const result = validateSharedWeeklyAvailability(flattenWeekdayAvailability(days))
  if (result.ok) return result

  for (const day of days) {
    for (const window of day.windows) {
      if (!Number.isFinite(window.startMinutes) || !Number.isFinite(window.endMinutes)) {
        return { ok: false, message: `Choose a start and end time for ${WEEKDAY_NAMES[day.weekday]}.` }
      }
    }
    const sorted = day.windows.slice().sort((left, right) => left.startMinutes - right.startMinutes)
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].startMinutes < sorted[index - 1].endMinutes) {
        return { ok: false, message: `${WEEKDAY_NAMES[day.weekday]} availability windows overlap. Adjust the times so they do not overlap.` }
      }
    }
    for (const window of day.windows) {
      if (window.endMinutes <= window.startMinutes) {
        return { ok: false, message: `${WEEKDAY_NAMES[day.weekday]} end time must be later than its start time.` }
      }
    }
  }

  return result
}

export { validateSharedWeeklyAvailability }
