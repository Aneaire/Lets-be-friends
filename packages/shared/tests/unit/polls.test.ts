import { describe, expect, it } from 'vitest'
import {
  MAX_POLL_OPTIONS,
  MAX_POLL_OPTION_LENGTH,
  MAX_POLL_QUESTION_LENGTH,
  pollPercentages,
  pollValidationError,
} from '../../src/polls'

describe('poll validation', () => {
  it('accepts a trimmed poll with two to four distinct options', () => {
    expect(pollValidationError({ question: '  Which plan?  ', options: ['  Coffee  ', 'Walk'] })).toBeNull()
    expect(pollValidationError({ question: 'Which plan?', options: ['A', 'B', 'C', 'D'] })).toBeNull()
  })

  it('rejects empty, oversized, and duplicate fields', () => {
    expect(pollValidationError({ question: '   ', options: ['A', 'B'] })).toBe('Poll question cannot be empty')
    expect(pollValidationError({ question: 'Q', options: ['A'] })).toBe('A poll needs at least 2 options')
    expect(pollValidationError({ question: 'Q', options: ['A', 'B', 'C', 'D', 'E'] })).toBe(`A poll can include up to ${MAX_POLL_OPTIONS} options`)
    expect(pollValidationError({ question: 'Q', options: ['A', '   '] })).toBe('Poll options cannot be empty')
    expect(pollValidationError({ question: 'Q', options: ['A', 'B'] })).toBeNull()
    expect(pollValidationError({ question: 'Q', options: ['A', 'a'] })).toBe('Poll options must be different')
    expect(pollValidationError({ question: 'Q'.repeat(MAX_POLL_QUESTION_LENGTH + 1), options: ['A', 'B'] })).toContain('question')
    expect(pollValidationError({ question: 'Q', options: ['A'.repeat(MAX_POLL_OPTION_LENGTH + 1), 'B'] })).toContain('options')
  })
})

describe('poll percentages', () => {
  it('returns zeroes when nothing has been voted', () => {
    expect(pollPercentages([0, 0, 0])).toEqual([0, 0, 0])
    expect(pollPercentages([Number.NaN, -4])).toEqual([0, 0])
  })

  it('always sums to 100 and favors the largest remainder', () => {
    // 1/3 each rounds to 33.33: the largest remainder gets the extra point.
    const thirds = pollPercentages([1, 1, 1])
    expect(thirds.reduce((sum, value) => sum + value, 0)).toBe(100)
    expect(thirds).toEqual([34, 33, 33])

    // A clear leader keeps its share and the runner-up takes the rounding point.
    const uneven = pollPercentages([25, 70, 39, 14])
    expect(uneven.reduce((sum, value) => sum + value, 0)).toBe(100)
    expect(uneven[1]).toBe(47)

    const tied = pollPercentages([1, 1])
    expect(tied).toEqual([50, 50])
  })
})
