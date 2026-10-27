export type NotificationPreferencesView = {
  socialReactions: boolean
  socialComments: boolean
  socialFollows: boolean
  circleActivity: boolean
  quietHoursEnabled: boolean
  quietHoursStartMinute: number
  quietHoursEndMinute: number
  timeZone: string
  digestEnabled: boolean
  digestHourMinute: number
}

export type NotificationPreferenceKey = keyof NotificationPreferencesView

export type NotificationPreferencesPatch = Partial<NotificationPreferencesView>

export const FALLBACK_TIME_ZONE = 'UTC'

function clampMinute(minute: number): number {
  if (!Number.isFinite(minute)) return 0
  return Math.min(1439, Math.max(0, Math.trunc(minute)))
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** A stored minute of day as a readable 12 hour clock label. */
export function minuteToLabel(minute: number): string {
  const value = clampMinute(minute)
  const hour24 = Math.floor(value / 60)
  const minutes = value % 60
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${pad2(minutes)} ${hour24 < 12 ? 'AM' : 'PM'}`
}

/** A stored minute of day as the value a native time input expects. */
export function minuteToTimeInput(minute: number): string {
  const value = clampMinute(minute)
  return `${pad2(Math.floor(value / 60))}:${pad2(value % 60)}`
}

/** Reads a native time input value back into a stored minute of day. */
export function timeInputToMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * The browser time zone is stored with the member preferences so quiet hours
 * and the digest follow the member's own clock. Unknown or unavailable zones
 * fall back to UTC instead of throwing during page load.
 */
export function resolveBrowserTimeZone(
  readTimeZone: () => string | undefined = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  try {
    const zone = readTimeZone()
    return typeof zone === 'string' && zone.trim().length > 0 ? zone : FALLBACK_TIME_ZONE
  } catch {
    return FALLBACK_TIME_ZONE
  }
}

export function quietHoursSummary(enabled: boolean, startMinute: number, endMinute: number): string {
  return enabled
    ? `Quiet hours run from ${minuteToLabel(startMinute)} to ${minuteToLabel(endMinute)}.`
    : 'Quiet hours are off. Social alerts can arrive at any time.'
}

export function digestSummary(enabled: boolean, digestHourMinute: number): string {
  const time = minuteToLabel(digestHourMinute)
  return enabled
    ? `Social updates arrive in one daily summary at ${time}.`
    : `Social updates arrive as they happen. A daily digest would arrive at ${time}.`
}
