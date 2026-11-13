import { referralAvailableCentavos } from '@/features/referral/ReferralsView'

describe('mobile referral dashboard', () => {
  it('uses the wallet referral sub-balance for available credit', () => {
    expect(referralAvailableCentavos({
      totalEarnedCentavos: 10_200,
      referralCreditAvailableCentavos: 4_200,
    })).toBe(4_200)
  })

  it('falls back to lifetime credited when an older backend omits the field', () => {
    expect(referralAvailableCentavos({ totalEarnedCentavos: 10_200 })).toBe(10_200)
  })
})
