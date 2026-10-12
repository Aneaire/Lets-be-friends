import {
  MAX_CIRCLE_POST_MEDIA,
  circleMediaLimitMessage,
  circleMediaSelectionLimit,
} from '@/features/circles/circlePresentation'

describe('mobile Circle media limits', () => {
  it('caps Circle posts at three media items', () => {
    expect(MAX_CIRCLE_POST_MEDIA).toBe(3)
  })

  it('derives the picker selection limit from the Circle cap and daily quota', () => {
    expect(circleMediaSelectionLimit({ selected: 0, remaining: 5 })).toBe(3)
    expect(circleMediaSelectionLimit({ selected: 2, remaining: 5 })).toBe(1)
    expect(circleMediaSelectionLimit({ selected: 3, remaining: 5 })).toBe(0)
    expect(circleMediaSelectionLimit({ selected: 1, remaining: 1 })).toBe(0)
    expect(circleMediaSelectionLimit({ selected: 0, remaining: 0 })).toBe(0)
  })

  it('accounts for repeated picks, removals, and quota changes', () => {
    expect(circleMediaSelectionLimit({ selected: 1, remaining: 3 })).toBe(2)
    expect(circleMediaSelectionLimit({ selected: 2, remaining: 3 })).toBe(1)
    expect(circleMediaSelectionLimit({ selected: 1, remaining: 3 })).toBe(2)
    expect(circleMediaSelectionLimit({ selected: 2, remaining: 1 })).toBe(0)
  })

  it('explains the Circle cap distinctly from the daily allowance', () => {
    expect(circleMediaLimitMessage({ selected: 3, remaining: 5 })).toContain('up to 3')
    expect(circleMediaLimitMessage({ selected: 0, remaining: 0 })).toContain('daily community media allowance')
    expect(circleMediaLimitMessage({ selected: 1, remaining: 1 })).toContain('publish this selection')
    expect(circleMediaLimitMessage({ selected: 2, remaining: 1 })).toContain('allowance changed')
    expect(circleMediaLimitMessage({ selected: 1, remaining: 4 })).toBeNull()
  })
})
