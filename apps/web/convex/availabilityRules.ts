import { ConvexError, v } from 'convex/values'
import {
  validateWeeklyAvailability,
  type WeeklyAvailabilityWindow,
} from '@lets-be-friends/shared'

// A weekly schedule in fixed Asia/Manila local time. Kept in its own module so
// the schema, mutations, and queries share one validator without importing any
// database helpers.
export const weeklyAvailabilityValidator = v.array(v.object({
  weekday: v.number(),
  startMinutes: v.number(),
  endMinutes: v.number(),
}))

/** Validates a schedule and throws a member-safe error when it is malformed. */
export function validateWeeklyAvailabilityOrThrow(
  windows: readonly WeeklyAvailabilityWindow[],
): WeeklyAvailabilityWindow[] {
  const result = validateWeeklyAvailability(windows)
  if (!result.ok) throw new ConvexError(result.message)
  return result.value
}

/**
 * Reads a possibly-legacy stored schedule. A missing field means the Companion
 * has never shared availability, so requests keep their legacy compatibility.
 * A malformed stored schedule fails closed as configured-with-no-availability.
 */
export function readStoredWeeklyAvailability(
  value: WeeklyAvailabilityWindow[] | undefined,
): { configured: boolean; windows: WeeklyAvailabilityWindow[] } {
  if (value === undefined) return { configured: false, windows: [] }
  const result = validateWeeklyAvailability(value)
  return { configured: true, windows: result.ok ? result.value : [] }
}
