import { describe, expect, it } from 'vitest'
import {
  activityCategories,
  bookingEligibility,
  bookingStatusAfterReview,
  calculateMemberWalletBookingPrice,
  bookingStatuses,
  brandAccentColors,
  canBookingChat,
  canBookCompanion,
  canCreateBooking,
  canCancelBooking,
  canCompleteBooking,
  canReadBookingMessages,
  canReviewBooking,
  friendStrengths,
  isAdminRole,
  isMemberVerificationReason,
  isModerationVisible,
  requiresVerificationForBooking,
  userRoles,
} from '@lets-be-friends/shared'

describe('shared early access domain constants', () => {
  it('keeps safe discovery defaults available', () => {
    expect(friendStrengths).toContain('Good listener')
    expect(activityCategories).toContain('Good company')
    expect(new Set(activityCategories).size).toBe(activityCategories.length)
    expect(bookingStatuses).toContain('verification_required')
  })

  it('calculates the shared member-wallet subtotal, 15% fee, total, and companion entitlement', () => {
    expect(calculateMemberWalletBookingPrice(50_000, 90)).toEqual({
      pricingModel: 'member_wallet_v2',
      serviceSubtotalCentavos: 75_000,
      memberBookingFeeBps: 1_500,
      memberBookingFeeCentavos: 11_250,
      memberTotalCentavos: 86_250,
      companionEarningsCentavos: 75_000,
      currency: 'PHP',
    })
  })

  it('exports the logo accent semantics for product actions', () => {
    expect(brandAccentColors.self.hex).toBe('#1093ED')
    expect(brandAccentColors.social.hex).toBe('#C1519C')
    expect(Object.keys(brandAccentColors)).toEqual(['self', 'social'])
  })

  it('keeps roles and admin semantics explicit', () => {
    expect(userRoles).toEqual(['member', 'companion', 'reviewer', 'admin'])
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('reviewer')).toBe(true)
    expect(isAdminRole('member')).toBe(false)
    expect(isAdminRole('companion')).toBe(false)
  })

  it('keeps hidden moderation content out of public surfaces', () => {
    expect(isModerationVisible({})).toBe(true)
    expect(isModerationVisible({ hidden: false })).toBe(true)
    expect(isModerationVisible({ hidden: true })).toBe(false)
  })

  it('prevents only self-booking regardless of account role', () => {
    expect(canBookCompanion('user-1', 'user-1')).toBe(false)
    expect(canBookCompanion('user-1', 'user-2')).toBe(true)
    expect(canBookCompanion(null, 'user-1')).toBe(true)
  })

  it('requires current booking identity eligibility before creating a booking', () => {
    expect(canCreateBooking('approved', true)).toBe(true)
    expect(canCreateBooking('not_started', true)).toBe(true)
    expect(canCreateBooking('approved', false)).toBe(false)
    expect(canCreateBooking('not_started', false)).toBe(false)
    expect(canCreateBooking('pending', false)).toBe(false)
    expect(canCreateBooking('rejected', false)).toBe(false)
    expect(requiresVerificationForBooking('approved', true)).toBe(false)
    expect(requiresVerificationForBooking('approved', false)).toBe(true)
    expect(requiresVerificationForBooking('pending', false)).toBe(true)
  })

  it('classifies viewer booking eligibility explicitly', () => {
    expect(bookingEligibility(null, undefined, 'companion-1', false)).toBe('sign_in_required')
    expect(bookingEligibility('companion-1', 'approved', 'companion-1', true)).toBe('own_profile')
    expect(bookingEligibility('member-1', 'pending', 'companion-1', false)).toBe('verification_required')
    expect(bookingEligibility('member-1', 'approved', 'companion-1', false)).toBe('verification_required')
    expect(bookingEligibility('member-1', 'approved', 'companion-1', true)).toBe('eligible')
    expect(bookingEligibility('member-1', 'not_started', 'companion-1', true)).toBe('eligible')
  })

  it('keeps member review reasons separate from companion applications', () => {
    expect(isMemberVerificationReason('member')).toBe(true)
    expect(isMemberVerificationReason('reverification')).toBe(true)
    expect(isMemberVerificationReason('booking')).toBe(true)
    expect(isMemberVerificationReason('companion_application')).toBe(false)
  })

  it('allows participant cancellation only before completion starts', () => {
    expect(canCancelBooking('verification_required')).toBe(true)
    expect(canCancelBooking('request_sent')).toBe(true)
    expect(canCancelBooking('accepted')).toBe(true)
    expect(canCancelBooking('declined')).toBe(false)
    expect(canCancelBooking('review_window')).toBe(false)
    expect(canCancelBooking('closed')).toBe(false)
  })

  it('opens completion and review transitions only from eligible states', () => {
    expect(canCompleteBooking('accepted')).toBe(true)
    expect(canCompleteBooking('request_sent')).toBe(false)
    expect(canReviewBooking('completed')).toBe(true)
    expect(canReviewBooking('review_window')).toBe(true)
    expect(canReviewBooking('accepted')).toBe(false)
  })

  it('closes a booking only after the other participant reviewed', () => {
    expect(bookingStatusAfterReview(false)).toBe('review_window')
    expect(bookingStatusAfterReview(true)).toBe('closed')
  })

  it('keeps chat available for coordination and the review window only', () => {
    expect(canBookingChat('request_sent')).toBe(true)
    expect(canBookingChat('accepted')).toBe(true)
    expect(canBookingChat('completed')).toBe(true)
    expect(canBookingChat('review_window')).toBe(true)
    expect(canBookingChat('verification_required')).toBe(false)
    expect(canBookingChat('cancelled')).toBe(false)
    expect(canBookingChat('closed')).toBe(false)
  })

  it('retains message read access after a booking stops accepting new chat', () => {
    expect(canReadBookingMessages('request_sent')).toBe(true)
    expect(canReadBookingMessages('accepted')).toBe(true)
    expect(canReadBookingMessages('declined')).toBe(true)
    expect(canReadBookingMessages('cancelled')).toBe(true)
    expect(canReadBookingMessages('completed')).toBe(true)
    expect(canReadBookingMessages('review_window')).toBe(true)
    expect(canReadBookingMessages('closed')).toBe(true)
    expect(canReadBookingMessages('verification_required')).toBe(false)
    expect(canReadBookingMessages('draft')).toBe(false)
  })

})
