import { describe, expect, it } from 'vitest'
import { activityCategories, bookingStatuses, friendStrengths } from '@lets-be-friends/shared'

describe('shared MVP domain constants', () => {
  it('keeps safe discovery defaults available', () => {
    expect(friendStrengths).toContain('Good listener')
    expect(activityCategories).toContain('Online conversation')
    expect(bookingStatuses).toContain('verification_required')
  })
})
