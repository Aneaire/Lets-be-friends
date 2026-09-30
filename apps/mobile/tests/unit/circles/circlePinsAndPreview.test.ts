import {
  canModeratePinnedPosts,
  circlePreviewCardSummary,
  pinnedPostItems,
} from '@/features/circles/circlePresentation'

describe('mobile Circle preview cards', () => {
  it('summarizes discovery metadata with host and join policy', () => {
    const summary = circlePreviewCardSummary({
      _id: 'circle-1',
      name: 'Cebu Coffee Friends',
      purpose: 'Meet for relaxed public cafe sessions.',
      category: 'Coffee',
      memberCount: 24,
      mode: 'both',
      approximateArea: 'Cebu City',
      hostDisplayName: 'Maya',
      joinPolicy: 'open',
    })
    expect(summary.meta).toBe('Coffee · 24 members · Cebu City')
    expect(summary.hostLine).toBe('Hosted by Maya')
    expect(summary.openJoin).toBe(true)
    expect(summary.archived).toBe(false)
  })

  it('falls back to safe location and host copy for online and archived Circles', () => {
    const summary = circlePreviewCardSummary({
      _id: 'circle-2',
      name: 'Online Chat Circle',
      purpose: 'A low-pressure online session for new members.',
      category: 'Good company',
      memberCount: 1,
      mode: 'online',
      hostDisplayName: null,
      joinPolicy: 'approval_required',
      circleState: 'archived',
    })
    expect(summary.meta).toBe('Good company · 1 member · Online')
    expect(summary.hostLine).toBe('Hosted by Circle host')
    expect(summary.openJoin).toBe(false)
    expect(summary.archived).toBe(true)
  })

  it('uses a neutral area label when an in-person Circle hides its area', () => {
    const summary = circlePreviewCardSummary({
      _id: 'circle-3',
      name: 'Weekend Walks',
      purpose: 'Plan relaxed public walks.',
      category: 'Good company',
      memberCount: 9,
      mode: 'in_person',
      hostDisplayName: 'Ravi',
      joinPolicy: null,
    })
    expect(summary.location).toBe('Area shared in Circle')
  })
})

describe('mobile Circle pinned posts', () => {
  it('renders every pinned post without dropping later entries', () => {
    const posts = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]
    expect(pinnedPostItems(posts).map((post) => post._id)).toEqual(['a', 'b', 'c'])
    expect(pinnedPostItems([])).toEqual([])
  })

  it('lets only leaders unpin, and never on suspended Circles', () => {
    expect(canModeratePinnedPosts({ canModerate: true, circleState: 'active' })).toBe(true)
    expect(canModeratePinnedPosts({ canModerate: true, circleState: 'archived' })).toBe(true)
    expect(canModeratePinnedPosts({ canModerate: false, circleState: 'active' })).toBe(false)
    expect(canModeratePinnedPosts({ canModerate: true, circleState: 'suspended' })).toBe(false)
  })
})
