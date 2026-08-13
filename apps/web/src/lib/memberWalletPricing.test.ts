import { describe, expect, it } from 'vitest'
import {
  MEMBER_BOOKING_FEE_BPS,
  MEMBER_WALLET_PRICING_MODEL,
  calculateBookingPrice,
  calculateMemberWalletBookingPrice,
} from '@lets-be-friends/shared'

describe('member-wallet v2 pricing', () => {
  it('freezes subtotal, 15% member fee, total, and full companion entitlement in centavos', () => {
    expect(calculateMemberWalletBookingPrice(50_000, 90)).toEqual({
      pricingModel: MEMBER_WALLET_PRICING_MODEL,
      serviceSubtotalCentavos: 75_000,
      memberBookingFeeBps: MEMBER_BOOKING_FEE_BPS,
      memberBookingFeeCentavos: 11_250,
      memberTotalCentavos: 86_250,
      companionEarningsCentavos: 75_000,
      currency: 'PHP',
    })
  })

  it('rounds only integer-centavo results and preserves the legacy helper meaning', () => {
    expect(calculateMemberWalletBookingPrice(10_001, 15)).toMatchObject({
      serviceSubtotalCentavos: 2_500,
      memberBookingFeeCentavos: 375,
      memberTotalCentavos: 2_875,
      companionEarningsCentavos: 2_500,
    })
    expect(calculateBookingPrice(50_000, 60)).toEqual({
      grossPriceCentavos: 50_000,
      commissionBps: 1_000,
      commissionCentavos: 5_000,
      currency: 'PHP',
    })
  })
})
