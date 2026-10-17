import { describe, expect, it } from 'vitest'
import { companionAvailabilityMessage } from '../../src/features/booking/companionAvailability'

describe('Companion booking availability copy', () => {
  it('names the missing identity check for an unverified Companion', () => {
    expect(companionAvailabilityMessage('not_verified')).toBe(
      'This Companion is not verified yet, so they cannot take new bookings.',
    )
  })

  it('separates a missing listed rate from verification', () => {
    expect(companionAvailabilityMessage('no_listed_rate')).toBe(
      'This Companion has not set a listed hourly rate yet, so booking is not available.',
    )
  })

  it('stays generic for suspension, blocks, and removals', () => {
    expect(companionAvailabilityMessage('unavailable')).toBe(
      'This Companion is not available for new bookings right now.',
    )
  })

  it('stays silent while the Companion can take bookings', () => {
    expect(companionAvailabilityMessage('available')).toBe('')
  })
})
