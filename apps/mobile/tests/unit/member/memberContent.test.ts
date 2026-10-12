import {
  isMemberPostVisible,
  memberContentTabLabel,
  memberPostsStatus,
  ownContentRouteFor,
  ownReviewsQueryArgs,
  ownReviewsUiStatus,
  toOwnReviewFeedItem,
  toProfileFeedItem,
  visibleMemberPosts,
} from '@/member/memberContent'

function post(id: string, overrides = {}) {
  return {
    _id: id,
    authorId: 'user-1',
    body: `Post ${id}`,
    createdAt: 1_786_000_000_000,
    likeCount: 0,
    commentCount: 0,
    ...overrides,
  }
}

describe('member profile content contracts', () => {
  it('shows loading until posts arrive and empty copy when nothing is visible', () => {
    expect(memberPostsStatus(undefined)).toBe('loading')
    expect(memberPostsStatus([])).toBe('empty')
    expect(memberPostsStatus([post('a', { circleId: 'circle-1' })])).toBe('empty')
    expect(memberPostsStatus([post('a'), post('b')])).toBe('ready')
  })

  it('keeps only public, non-removed member posts', () => {
    const posts = [
      post('visible'),
      post('circle', { circleId: 'circle-1' }),
      post('removed', { deletedAt: 1_786_000_000_001 }),
    ]
    expect(visibleMemberPosts(posts).map((item) => item._id)).toEqual(['visible'])
    expect(isMemberPostVisible(post('ok'))).toBe(true)
    expect(isMemberPostVisible(post('circle-post', { circleId: 'c' }))).toBe(false)
    expect(isMemberPostVisible(post('deleted', { deletedAt: 12 }))).toBe(false)
  })

  it('adapts a member post for the shared social feed card', () => {
    const item = toProfileFeedItem(post('p1'), 'Alex Rivera')
    expect(item).toMatchObject({
      kind: 'post',
      itemKey: 'post:p1',
      source: 'profile',
      post: expect.objectContaining({ _id: 'p1' }),
    })
    expect(item.reason).toMatch(/Alex Rivera/)
  })

  it('routes signed-in members to their own content and blocks anonymous access', () => {
    expect(ownContentRouteFor('user-1')).toEqual({ pathname: '/my-posts' })
    expect(ownContentRouteFor(undefined)).toBeNull()
  })

  it('labels own content tabs without removing account controls', () => {
    expect(memberContentTabLabel('posts')).toBe('Posts')
    expect(memberContentTabLabel('reviews')).toBe('Reviews')
  })

  it('settles own reviews without waiting on the skipped query for non-companions', () => {
    expect(ownReviewsUiStatus(undefined, undefined)).toBe('loading')
    expect(ownReviewsUiStatus(null, undefined)).toBe('needs_companion')
    expect(ownReviewsUiStatus({ _id: 'cp-1', status: 'pending' }, undefined)).toBe('needs_companion')
    expect(ownReviewsUiStatus({ _id: 'cp-1', status: 'approved' }, undefined)).toBe('loading')
    expect(ownReviewsUiStatus({ _id: 'cp-1', status: 'approved' }, [])).toBe('empty')
    expect(ownReviewsUiStatus({ _id: 'cp-1', status: 'approved' }, [{ _id: 'r-1' }])).toBe('ready')
  })

  it('skips the own reviews query until the Companion profile is approved', () => {
    expect(ownReviewsQueryArgs(undefined)).toBe('skip')
    expect(ownReviewsQueryArgs(null)).toBe('skip')
    expect(ownReviewsQueryArgs({ _id: 'cp-1', status: 'pending' })).toBe('skip')
    expect(ownReviewsQueryArgs({ _id: 'cp-1', status: 'approved' })).toEqual({ companionProfileId: 'cp-1' })
  })

  it('adapts an owned review for the shared review card with profile navigation fields', () => {
    const review = {
      _id: 'review-1',
      companionProfileId: 'cp-1',
      reviewerId: 'user-9',
      reviewerDisplayName: 'Sam Rivera',
      rating: 5,
      body: 'Kind and punctual.',
    }
    const item = toOwnReviewFeedItem(review, 'Alex Rivera')
    expect(item).toMatchObject({
      kind: 'review',
      itemKey: 'review:review-1',
      source: 'review',
      review: expect.objectContaining({
        _id: 'review-1',
        companionProfileId: 'cp-1',
        reviewerId: 'user-9',
        companionDisplayName: 'Alex Rivera',
      }),
    })
    expect(item.reason).toMatch(/your Companion profile/i)
  })
})
