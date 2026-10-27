/**
 * Pure helpers for the notification preference time controls. Times are stored
 * as whole minutes after local midnight so the backend never has to parse a
 * display label, and the picker only exposes 30 minute steps.
 */

export const MINUTES_PER_DAY = 1440
export const TIME_OPTION_STEP_MINUTES = 30
export const FALLBACK_TIME_ZONE = 'UTC'

const LABEL_PATTERN = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i

export function normalizeMinuteOfDay(minute: number): number {
  if (!Number.isFinite(minute)) return 0
  return ((Math.floor(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
}

/** Human 12 hour label such as 10:00 PM for a stored minute of day. */
export function formatMinuteLabel(minute: number): string {
  const normalized = normalizeMinuteOfDay(minute)
  const hour24 = Math.floor(normalized / 60)
  const minutes = normalized % 60
  const period = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}

/** Every 30 minute option from 00:00 to 23:30, expressed as stored minutes. */
export function minuteOfDayOptions(stepMinutes: number = TIME_OPTION_STEP_MINUTES): number[] {
  const step = Number.isInteger(stepMinutes) && stepMinutes > 0 && stepMinutes <= MINUTES_PER_DAY
    ? stepMinutes
    : TIME_OPTION_STEP_MINUTES
  const options: number[] = []
  for (let minute = 0; minute < MINUTES_PER_DAY; minute += step) options.push(minute)
  return options
}

export function timeOptionLabels(stepMinutes?: number): Array<{ minute: number; label: string }> {
  return minuteOfDayOptions(stepMinutes).map((minute) => ({ minute, label: formatMinuteLabel(minute) }))
}

/** Converts a displayed label back to a stored minute, or null when malformed. */
export function parseMinuteLabel(label: string): number | null {
  const match = LABEL_PATTERN.exec(label.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hour) || hour < 1 || hour > 12) return null
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null
  const period = match[3].toUpperCase()
  return (hour % 12) * 60 + minutes + (period === 'PM' ? 12 * 60 : 0)
}

export function isSupportedTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/**
 * Device IANA zone with a UTC fallback. The reader is injectable so the
 * fallback is testable when a runtime has no zone or throws.
 */
export function resolveDeviceTimeZone(
  readTimeZone: () => string | null | undefined = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  isValidTimeZone: (timeZone: string) => boolean = isSupportedTimeZone,
): string {
  try {
    const candidate = readTimeZone()
    if (typeof candidate !== 'string') return FALLBACK_TIME_ZONE
    const trimmed = candidate.trim()
    if (!trimmed) return FALLBACK_TIME_ZONE
    return isValidTimeZone(trimmed) ? trimmed : FALLBACK_TIME_ZONE
  } catch {
    return FALLBACK_TIME_ZONE
  }
}
