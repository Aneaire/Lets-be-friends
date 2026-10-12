import {
  FRIENDAY_GUIDANCE_LINES,
  formatGuidanceMode,
  guidanceCircleDestination,
  guidanceCircleMeta,
  selectGuidanceCircles,
} from '@/features/guidance/friendayGuidance'

describe('native Frienday guidance copy', () => {
  it('uses Companion and member language without inventing new evidence roles', () => {
    const copy = FRIENDAY_GUIDANCE_LINES.join(' ')
    expect(copy).toMatch(/Companion/)
    expect(copy).toMatch(/member/)
    expect(copy).not.toMatch(/Friender/)
    expect(copy).not.toMatch(/Second Friend Selfie|Third Friend Selfie/)
    expect(copy).toMatch(/Companion decides a start photo/)
    expect(copy).toMatch(/member decides an end photo/)
    expect(copy).toMatch(/explicitly skip after reading the warning/)
    expect(copy).toMatch(/no midpoint photo/i)
    expect(copy).toContain('details cannot be edited after acceptance')
    expect(copy).not.toContain('—')
    expect(copy).not.toContain('–')
  })
})

describe('guidance circle selection', () => {
  it('keeps server order and shows the most recent active circle first with up to three more', () => {
    const mine = [
      { _id: 'a', name: 'A', memberCount: 5, membershipState: 'active' },
      { _id: 'b', name: 'B', memberCount: 4, membershipState: 'requested' },
      { _id: 'c', name: 'C', memberCount: 3, membershipState: 'active' },
      { _id: 'd', name: 'D', memberCount: 2, membershipState: 'active' },
      { _id: 'e', name: 'E', memberCount: 1, membershipState: 'active' },
      { _id: 'f', name: 'F', memberCount: 9, membershipState: 'active' },
      { _id: 'g', name: 'G', memberCount: 8, membershipState: 'active' },
    ]
    const selected = selectGuidanceCircles(mine)
    expect(selected.top?._id).toBe('a')
    expect(selected.rest.map((circle) => circle._id)).toEqual(['c', 'd', 'e'])
    expect(selected.totalActive).toBe(6)
  })

  it('returns an empty context when nothing is active and rejects malformed rows', () => {
    expect(selectGuidanceCircles(undefined)).toEqual({ top: null, rest: [], totalActive: 0 })
    expect(selectGuidanceCircles([{ _id: 1, name: null }]).totalActive).toBe(0)
  })

  it('formats member counts, modes, roles, and muted state without inventing membership', () => {
    expect(formatGuidanceMode('in_person')).toBe('In person')
    expect(formatGuidanceMode(undefined)).toBeNull()
    expect(guidanceCircleMeta({ _id: 'a', name: 'A', memberCount: 1, mode: 'online' })).toBe('1 member · Online')
    expect(guidanceCircleMeta({ _id: 'a', name: 'A', memberCount: 2, mode: 'both', role: 'host', muted: true }))
      .toBe('2 members · Online and in person · host · Muted')
    expect(guidanceCircleMeta({ _id: 'a', name: 'A', memberCount: 2, role: 'member' })).toBe('2 members')
  })

  it('routes the current circle inside the protected native navigator', () => {
    expect(guidanceCircleDestination('circle_123')).toEqual({
      pathname: '/circles/[id]',
      params: { id: 'circle_123' },
    })
  })
})
