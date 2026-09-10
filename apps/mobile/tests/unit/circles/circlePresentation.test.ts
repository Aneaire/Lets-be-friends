import {
  canRequestCircleMembership,
  circleAccessPresentation,
  circleJoinLabel,
  circleMembershipMessage,
  circleNotificationRoute,
  circleIndexPresentation,
  circleActionError,
  circlePreviewSections,
  circlePrivacySummary,
  previewDiscussionItems,
  resolveCirclePrivacySettings,
  shouldQueryRemovedCircleContent,
} from '@/features/circles/circlePresentation'

describe('mobile Circle access presentation', () => {
  it('keeps private Circle content out of preview and unavailable states', () => {
    expect(circleAccessPresentation({ unavailable: true })).toBe('unavailable')
    expect(circleAccessPresentation({ unavailable: false, circleState: 'suspended', membershipState: 'active', canWrite: true })).toBe('unavailable')
    expect(circleAccessPresentation({ unavailable: false, circleState: 'active', membershipState: null, canWrite: false })).toBe('preview')
    expect(circleAccessPresentation({ unavailable: false, circleState: 'active', membershipState: 'requested', canWrite: false })).toBe('preview')
    expect(circleAccessPresentation({ unavailable: false, circleState: 'active', membershipState: 'banned', canWrite: false })).toBe('preview')
  })

  it('separates writable membership from archived read-only membership', () => {
    expect(circleAccessPresentation({ unavailable: false, circleState: 'active', membershipState: 'active', canWrite: true })).toBe('member_writable')
    expect(circleAccessPresentation({ unavailable: false, circleState: 'archived', membershipState: 'active', canWrite: false })).toBe('member_read_only')
  })

  it('allows a new request only from recoverable membership states', () => {
    expect(canRequestCircleMembership(null)).toBe(true)
    expect(canRequestCircleMembership('left')).toBe(true)
    expect(canRequestCircleMembership('removed')).toBe(true)
    expect(canRequestCircleMembership('rejected')).toBe(true)
    expect(canRequestCircleMembership('requested')).toBe(false)
    expect(canRequestCircleMembership('active')).toBe(false)
    expect(canRequestCircleMembership('banned')).toBe(false)
  })

  it('explains pending, rejected, removed, and banned membership safely', () => {
    expect(circleMembershipMessage('requested')).toContain('waiting')
    expect(circleMembershipMessage('rejected')).toContain('request to join again')
    expect(circleMembershipMessage('removed')).toContain('membership ended')
    expect(circleMembershipMessage('banned')).toContain('cannot request access')
    expect(circleMembershipMessage(null)).toBeUndefined()
  })
})

describe('mobile Circle notification routing', () => {
  it('preserves Circle, post, and comment focus identifiers', () => {
    expect(circleNotificationRoute({ type: 'circle', circleId: 'circle-1', postId: 'post-1', commentId: 'comment-1' })).toEqual({
      pathname: '/circles/[id]',
      params: { id: 'circle-1', postId: 'post-1', commentId: 'comment-1' },
    })
  })

  it('does not claim non-Circle destinations', () => {
    expect(circleNotificationRoute({ type: 'post', postId: 'post-1' })).toBeUndefined()
    expect(circleNotificationRoute({ type: 'circle' })).toBeUndefined()
  })
})

describe('mobile Circle entry presentation', () => {
  it('shows at most three active memberships on Home and deduplicates discovery', () => {
    const mine = [
      { _id: 'one', membershipState: 'active' },
      { _id: 'two', membershipState: 'requested' },
      { _id: 'three', membershipState: 'active' },
      { _id: 'four', membershipState: 'active' },
      { _id: 'five', membershipState: 'active' },
    ]
    const result = circleIndexPresentation(mine, [{ _id: 'one' }, { _id: 'six' }])
    expect(result.activeHome.map((circle) => circle._id)).toEqual(['one', 'three', 'four'])
    expect(result.available).toEqual([{ _id: 'six' }])
  })

  it('keeps the Circle index loading until both private and discovery lists resolve', () => {
    expect(circleIndexPresentation(undefined, []).loading).toBe(true)
    expect(circleIndexPresentation([], undefined).loading).toBe(true)
    expect(circleIndexPresentation([], []).loading).toBe(false)
  })
})

describe('mobile Circle privacy presentation', () => {
  it('defaults missing settings to the safe private configuration', () => {
    expect(resolveCirclePrivacySettings(null)).toEqual({
      discoverability: 'listed',
      discussionVisibility: 'members_only',
      memberListVisibility: 'members_only',
      joinPolicy: 'approval_required',
    })
    expect(resolveCirclePrivacySettings({ joinPolicy: 'open' }).discoverability).toBe('listed')
  })

  it('mounts preview sections only from server-granted read flags, never local visibility', () => {
    // A signed_in Circle with false server flags mounts neither protected
    // query, even for a requesting outsider whose local settings look public.
    expect(circlePreviewSections({ canReadDiscussion: false, canReadMembers: false })).toEqual({
      showDiscussions: false,
      showMembers: false,
    })
    expect(circlePreviewSections({ canReadDiscussion: true, canReadMembers: false })).toEqual({
      showDiscussions: true,
      showMembers: false,
    })
    expect(circlePreviewSections({ canReadDiscussion: true, canReadMembers: true })).toEqual({
      showDiscussions: true,
      showMembers: true,
    })
    expect(circlePreviewSections({})).toEqual({ showDiscussions: false, showMembers: false })
    expect(circlePreviewSections({ canReadDiscussion: null, canReadMembers: undefined })).toEqual({
      showDiscussions: false,
      showMembers: false,
    })
  })

  it('renders every loaded preview discussion, including later-page results', () => {
    const loaded = Array.from({ length: 25 }, (_, index) => ({ _id: `post-${index}`, body: `Discussion ${index}` }))
    const items = previewDiscussionItems(loaded)
    expect(items).toHaveLength(25)
    expect(items.map((item) => item._id)).toEqual(loaded.map((item) => item._id))
    expect(items.slice(10).map((item) => item._id)).toEqual(
      Array.from({ length: 15 }, (_, index) => `post-${index + 10}`),
    )
    expect(previewDiscussionItems([])).toEqual([])
  })

  it('labels open joins distinctly from approval requests', () => {
    expect(circleJoinLabel('open', null)).toBe('Join Circle')
    expect(circleJoinLabel('open', 'left')).toBe('Join Circle again')
    expect(circleJoinLabel('approval_required', null)).toBe('Request to join')
    expect(circleJoinLabel('approval_required', 'rejected')).toBe('Request to join again')
  })

  it('summarizes privacy consequences without leaking member data', () => {
    const summary = circlePrivacySummary({ discoverability: 'unlisted', discussionVisibility: 'signed_in', memberListVisibility: 'signed_in', joinPolicy: 'open' })
    expect(summary.discoverability).toContain('direct link')
    expect(summary.discussion).toContain('Join to post')
    expect(summary.memberList).toContain('signed-in members')
    expect(summary.join).toContain('instantly')
    expect(JSON.stringify(summary)).not.toContain('banned')
  })
})

describe('mobile Circle management presentation', () => {
  it('does not request the writable moderation queue for archived or unresolved Circles', () => {
    expect(shouldQueryRemovedCircleContent(undefined)).toBe(false)
    expect(shouldQueryRemovedCircleContent('archived')).toBe(false)
    expect(shouldQueryRemovedCircleContent('suspended')).toBe(false)
    expect(shouldQueryRemovedCircleContent('active')).toBe(true)
  })

  it('surfaces backend member and report errors with a safe fallback', () => {
    expect(circleActionError(new Error('Request is no longer pending'), 'Action failed')).toBe('Request is no longer pending')
    expect(circleActionError(null, 'Action failed')).toBe('Action failed')
  })
})
