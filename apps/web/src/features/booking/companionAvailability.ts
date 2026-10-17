import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'

export type CompanionBookingAvailability = FunctionReturnType<typeof api.companions.bookingAvailability>

// The server answers why a Companion cannot take a new booking. Only
// 'not_verified' names a reason, because a member profile already shows
// "Not identity checked" publicly. Everything else stays a generic answer so
// suspension, blocks, and removals are never exposed through a booking attempt.
export function companionAvailabilityMessage(state: CompanionBookingAvailability) {
  if (state === 'not_verified') return 'This Companion is not verified yet, so they cannot take new bookings.'
  if (state === 'no_listed_rate') return 'This Companion has not set a listed hourly rate yet, so booking is not available.'
  if (state === 'unavailable') return 'This Companion is not available for new bookings right now.'
  return ''
}
