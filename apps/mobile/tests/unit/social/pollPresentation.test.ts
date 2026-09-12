import { pollOptionResultLabel, pollTotalLabel, pollVotable } from '../../../src/features/social/pollPresentation'

describe('poll presentation', () => {
  it('labels open, single-vote, and closed polls', () => {
    expect(pollTotalLabel(0, false)).toBe('0 votes')
    expect(pollTotalLabel(1, false)).toBe('1 vote')
    expect(pollTotalLabel(148, false)).toBe('148 votes')
    expect(pollTotalLabel(148, true)).toBe('Closed')
  })

  it('formats option results with percentage and raw count', () => {
    expect(pollOptionResultLabel(47, 70)).toBe('47% (70)')
    expect(pollOptionResultLabel(0, 0)).toBe('0% (0)')
  })

  it('allows voting only when the viewer has not voted and the poll is open', () => {
    expect(pollVotable(undefined, false, false)).toBe(true)
    expect(pollVotable('option-1', false, false)).toBe(false)
    expect(pollVotable(undefined, true, false)).toBe(false)
    expect(pollVotable(undefined, false, true)).toBe(false)
  })
})
