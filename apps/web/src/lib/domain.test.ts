import { describe, expect, it } from 'vitest'
import { activityCategories, bookingStatuses, brandAccentColors, friendStrengths } from '@lets-be-friends/shared'

describe('shared MVP domain constants', () => {
  it('keeps safe discovery defaults available', () => {
    expect(friendStrengths).toContain('Good listener')
    expect(activityCategories).toContain('Online conversation')
    expect(bookingStatuses).toContain('verification_required')
  })

  it('exports the logo accent semantics for product actions', () => {
    expect(brandAccentColors.self.hex).toBe('#1093ED')
    expect(brandAccentColors.social.hex).toBe('#C1519C')
    expect(Object.keys(brandAccentColors)).toEqual(['self', 'social'])
  })
})
