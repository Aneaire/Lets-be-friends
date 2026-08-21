import { describe, expect, it } from 'vitest'
import {
  calculateBookingPrice,
  nextSaturdayManilaCutoff,
  validateCompanionHourlyRateCentavos,
} from '@lets-be-friends/shared'

describe('booking finance rules', () => {
  it('calculates the locked cash price and 10% commission in integer centavos', () => {
    expect(calculateBookingPrice(50_000, 90)).toEqual({
      grossPriceCentavos: 75_000,
      commissionBps: 1_000,
      commissionCentavos: 7_500,
      currency: 'PHP',
    })
    expect(calculateBookingPrice(10_001, 15)).toMatchObject({
      grossPriceCentavos: 2_500,
      commissionCentavos: 250,
    })
  })

  it('rejects unsafe or out-of-range hourly rates', () => {
    expect(() => validateCompanionHourlyRateCentavos(9_999)).toThrow('between ₱100 and ₱10,000')
    expect(() => validateCompanionHourlyRateCentavos(10_000.5)).toThrow('whole number of centavos')
  })

  it('uses Saturday 09:00 Asia/Manila and rolls an exact cutoff to the next week', () => {
    const beforeCutoff = Date.parse('2026-08-08T00:59:59.999Z')
    const cutoff = Date.parse('2026-08-08T01:00:00.000Z')
    expect(nextSaturdayManilaCutoff(beforeCutoff)).toBe(cutoff)
    expect(nextSaturdayManilaCutoff(cutoff)).toBe(Date.parse('2026-08-15T01:00:00.000Z'))
  })
})
