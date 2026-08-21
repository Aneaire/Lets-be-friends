import { bookingCompletionCopy } from '@/data/bookingCompletion'
import { bookingPriceEstimate } from '@/data/bookingPricing'

const NOW = 1_000_000
const ENDED_SCHEDULE = {
  requestedAt: NOW - 60 * 60_000,
  durationMinutes: 60,
  now: NOW,
}

describe('booking completion copy', () => {
  it('requires an accepted booking', () => {
    expect(bookingCompletionCopy({
      status: 'request_sent',
      viewerRole: 'member',
      evidenceReady: true,
    }).actionable).toBe(false)
  })

  it('keeps future bookings unavailable even when evidence is ready', () => {
    expect(bookingCompletionCopy({
      status: 'accepted',
      pricingModel: 'member_wallet_v2',
      requestedAt: NOW,
      durationMinutes: 60,
      now: NOW,
      viewerRole: 'member',
      evidenceReady: true,
    })).toMatchObject({
      actionable: false,
      label: 'Available after the scheduled session ends',
    })
  })

  it('requires evidence for an ended member-wallet booking', () => {
    expect(bookingCompletionCopy({
      status: 'accepted',
      pricingModel: 'member_wallet_v2',
      ...ENDED_SCHEDULE,
      viewerRole: 'member',
      evidenceReady: false,
    })).toMatchObject({
      actionable: false,
      label: 'Choose an evidence option first',
    })
  })

  it('allows an ended legacy booking without evidence', () => {
    expect(bookingCompletionCopy({
      status: 'accepted',
      ...ENDED_SCHEDULE,
      viewerRole: 'companion',
      evidenceReady: false,
    })).toMatchObject({
      actionable: true,
      label: 'Confirm experience completed',
    })
  })

  it('blocks completion when the schedule is malformed', () => {
    expect(bookingCompletionCopy({
      status: 'accepted',
      pricingModel: 'member_wallet_v2',
      requestedAt: Number.NaN,
      durationMinutes: 60,
      now: NOW,
      viewerRole: 'member',
      evidenceReady: true,
    })).toMatchObject({
      actionable: false,
      label: 'Booking schedule needs attention',
    })
  })

  it('reflects one-person and two-person server completion state', () => {
    expect(bookingCompletionCopy({ status: 'accepted', viewerRole: 'member', participantCompletedAt: 1, evidenceReady: true })).toMatchObject({
      actionable: false,
      label: 'Waiting for the other person',
    })
    expect(bookingCompletionCopy({ status: 'completed', viewerRole: 'member', participantCompletedAt: 1, otherParticipantCompletedAt: 2, evidenceReady: true })).toMatchObject({
      actionable: false,
      label: 'Completion confirmed by both people',
    })
  })
})

describe('booking price estimate', () => {
  it('uses the shared member-wallet pricing model', () => {
    expect(bookingPriceEstimate(60_000, '90')).toEqual({
      pricingModel: 'member_wallet_v2',
      serviceSubtotalCentavos: 90_000,
      memberBookingFeeBps: 1_500,
      memberBookingFeeCentavos: 13_500,
      memberTotalCentavos: 103_500,
      companionEarningsCentavos: 90_000,
      currency: 'PHP',
    })
  })

  it('returns no estimate for unsupported rate or duration input', () => {
    expect(bookingPriceEstimate(undefined, '60')).toBeNull()
    expect(bookingPriceEstimate(60_000, '31')).toBeNull()
    expect(bookingPriceEstimate(60_000, 'not a duration')).toBeNull()
  })
})
