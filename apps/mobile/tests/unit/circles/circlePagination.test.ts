import {
  circleFeedPageRequestKey,
  dedupeCirclePosts,
  isNearCircleFeedEnd,
  mergeCircleRequestedPost,
  nextCircleAutoLoadAction,
  registerCircleFeedScrollHandler,
  resolveCircleFocusedPostId,
  shouldRequestCircleFeedPage,
  syncCircleFeedRequestState,
} from '@/features/circles/circlePresentation'

describe('mobile Circle notification post focusing', () => {
  it('prepends a requested post that sits outside the loaded pages', () => {
    const loaded = [{ _id: 'post-2' }, { _id: 'post-3' }]
    const requested = { _id: 'post-9' }
    expect(mergeCircleRequestedPost(loaded, requested)).toEqual([requested, ...loaded])
  })

  it('does not duplicate a requested post that is already loaded', () => {
    const loaded = [{ _id: 'post-2' }, { _id: 'post-9' }]
    expect(mergeCircleRequestedPost(loaded, { _id: 'post-9' })).toEqual(loaded)
  })

  it('keeps the loaded feed when the requested post is unavailable', () => {
    const loaded = [{ _id: 'post-2' }]
    expect(mergeCircleRequestedPost(loaded, null)).toEqual(loaded)
    expect(mergeCircleRequestedPost(loaded, undefined)).toEqual(loaded)
  })

  it('never injects a requested post that belongs to another Circle', () => {
    const loaded = [{ _id: 'post-2', circleId: 'circle-a' }]
    const foreign = { _id: 'post-9', circleId: 'circle-b' }
    expect(mergeCircleRequestedPost(loaded, foreign, 'circle-a')).toEqual(loaded)
    expect(mergeCircleRequestedPost(loaded, { _id: 'post-9', circleId: 'circle-a' }, 'circle-a')).toEqual([
      { _id: 'post-9', circleId: 'circle-a' },
      ...loaded,
    ])
  })

  it('requires a requested post to carry the expected Circle identifier', () => {
    const loaded: Array<{ _id: string; circleId?: string }> = [{ _id: 'post-2', circleId: 'circle-a' }]
    expect(mergeCircleRequestedPost(loaded, { _id: 'post-9' }, 'circle-a')).toEqual(loaded)
  })

  it('prefers the explicit notification post over a stale requested identifier', () => {
    expect(resolveCircleFocusedPostId({ initialPostId: 'post-1', requestedPostId: 'post-2' })).toBe('post-1')
    expect(resolveCircleFocusedPostId({ requestedPostId: 'post-2' })).toBe('post-2')
    expect(resolveCircleFocusedPostId({})).toBeNull()
  })
})

describe('mobile Circle automatic pagination', () => {
  it('auto-loads only from a settled page with no recent trigger', () => {
    expect(nextCircleAutoLoadAction({ status: 'CanLoadMore', lastAutoLoadAt: null })).toBe('load')
    expect(nextCircleAutoLoadAction({ status: 'LoadingFirstPage', lastAutoLoadAt: null })).toBe('idle')
    expect(nextCircleAutoLoadAction({ status: 'LoadingMore', lastAutoLoadAt: null })).toBe('idle')
    expect(nextCircleAutoLoadAction({ status: 'Exhausted', lastAutoLoadAt: null })).toBe('idle')
  })

  it('rate-limits repeated triggers inside the cooldown window', () => {
    const now = 1_000_000
    expect(nextCircleAutoLoadAction({ status: 'CanLoadMore', now, lastAutoLoadAt: now - 200 })).toBe('wait')
    expect(nextCircleAutoLoadAction({ status: 'CanLoadMore', now, lastAutoLoadAt: now - 10_000 })).toBe('load')
  })

  it('deduplicates merged pages by post identifier', () => {
    const posts = dedupeCirclePosts([{ _id: 'a' }, { _id: 'b' }, { _id: 'a' }])
    expect(posts.map((post) => post._id)).toEqual(['a', 'b'])
  })
})

describe('mobile Circle near-end pagination', () => {
  it('detects the viewport within threshold of the feed bottom', () => {
    expect(isNearCircleFeedEnd({ layoutHeight: 600, contentHeight: 2000, offsetY: 1200 })).toBe(true)
    expect(isNearCircleFeedEnd({ layoutHeight: 600, contentHeight: 2000, offsetY: 100 })).toBe(false)
    expect(isNearCircleFeedEnd({ layoutHeight: 600, contentHeight: 500, offsetY: 0 })).toBe(false)
  })

  it('requests the next page only near the end from a settled state', () => {
    const requestKey = circleFeedPageRequestKey({ circleId: 'circle-a', pageLength: 15 })
    expect(shouldRequestCircleFeedPage({ status: 'CanLoadMore', nearEnd: true, requestKey, inFlightKey: null })).toBe(true)
    expect(shouldRequestCircleFeedPage({ status: 'CanLoadMore', nearEnd: false, requestKey, inFlightKey: null })).toBe(false)
    expect(shouldRequestCircleFeedPage({ status: 'LoadingMore', nearEnd: true, requestKey, inFlightKey: null })).toBe(false)
    expect(shouldRequestCircleFeedPage({ status: 'LoadingFirstPage', nearEnd: true, requestKey, inFlightKey: null })).toBe(false)
    expect(shouldRequestCircleFeedPage({ status: 'Exhausted', nearEnd: true, requestKey, inFlightKey: null })).toBe(false)
  })

  it('guards duplicate requests per query page and resets on Circle change', () => {
    const requestKey = circleFeedPageRequestKey({ circleId: 'circle-a', pageLength: 15 })
    expect(
      shouldRequestCircleFeedPage({ status: 'CanLoadMore', nearEnd: true, requestKey, inFlightKey: requestKey }),
    ).toBe(false)
    const nextKey = circleFeedPageRequestKey({ circleId: 'circle-a', pageLength: 30 })
    expect(shouldRequestCircleFeedPage({ status: 'CanLoadMore', nearEnd: true, requestKey: nextKey, inFlightKey: requestKey })).toBe(true)
    const otherCircleKey = circleFeedPageRequestKey({ circleId: 'circle-b', pageLength: 15 })
    expect(otherCircleKey).not.toBe(requestKey)
    expect(shouldRequestCircleFeedPage({ status: 'CanLoadMore', nearEnd: true, requestKey: otherCircleKey, inFlightKey: null })).toBe(true)
  })

  it('releases the page guard after loading completes even when page length is unchanged', () => {
    const requestKey = circleFeedPageRequestKey({ circleId: 'circle-a', pageLength: 15 })
    const requested = { circleId: 'circle-a', inFlightKey: requestKey, observedLoading: false }
    const loading = syncCircleFeedRequestState(requested, { circleId: 'circle-a', status: 'LoadingMore' })
    expect(loading).toEqual({ circleId: 'circle-a', inFlightKey: requestKey, observedLoading: true })

    const completedWithoutVisibleItems = syncCircleFeedRequestState(loading, { circleId: 'circle-a', status: 'CanLoadMore' })
    expect(completedWithoutVisibleItems).toEqual({ circleId: 'circle-a', inFlightKey: null, observedLoading: false })
    expect(shouldRequestCircleFeedPage({
      status: 'CanLoadMore',
      nearEnd: true,
      requestKey,
      inFlightKey: completedWithoutVisibleItems.inFlightKey,
    })).toBe(true)
  })

  it('resets request state when the Circle changes', () => {
    expect(syncCircleFeedRequestState(
      { circleId: 'circle-a', inFlightKey: 'circle-a:15', observedLoading: true },
      { circleId: 'circle-b', status: 'CanLoadMore' },
    )).toEqual({ circleId: 'circle-b', inFlightKey: null, observedLoading: false })
  })

  it('registers a scroll callback without invoking the function as a state updater', () => {
    const target: { current: ((event: string) => void) | null } = { current: null }
    const handler = jest.fn()
    registerCircleFeedScrollHandler(target, handler)
    expect(handler).not.toHaveBeenCalled()
    target.current?.('near-end')
    expect(handler).toHaveBeenCalledWith('near-end')
    registerCircleFeedScrollHandler(target, null)
    expect(target.current).toBeNull()
  })
})
