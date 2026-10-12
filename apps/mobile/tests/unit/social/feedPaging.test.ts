import { dedupeFeedItems } from '@/data/discovery'
import { feedLoadMoreKey, homeFeedQueryArgs, shouldAutoLoadFeedMore, shouldRequestFeedLoadMore, syncFeedPageRequestState } from '@/features/social/feedPagination'

describe('mobile feed paging', () => {
  it('accumulates paginated pages keyed by item without duplicates', () => {
    const firstPage = [{ itemKey: 'post:1' }, { itemKey: 'post:2' }]
    const secondPage = [{ itemKey: 'post:2' }, { itemKey: 'post:3' }]
    expect(dedupeFeedItems([...firstPage, ...secondPage])).toEqual([
      { itemKey: 'post:1' },
      { itemKey: 'post:2' },
      { itemKey: 'post:3' },
    ])
  })

  it('keeps a requested post pinned above paged results without duplicating it', () => {
    const focused = { itemKey: 'post:9' }
    const paged = [{ itemKey: 'post:1' }, { itemKey: 'post:9' }, { itemKey: 'post:2' }]
    expect(dedupeFeedItems([focused, ...paged]).map((item) => item.itemKey)).toEqual([
      'post:9',
      'post:1',
      'post:2',
    ])
  })

  it('skips every feed filter until the member is ready', () => {
    expect(homeFeedQueryArgs('for_you', false)).toBe('skip')
    expect(homeFeedQueryArgs('following', false)).toBe('skip')
    expect(homeFeedQueryArgs('saved', false)).toBe('skip')
  })

  it('queries the selected filter once the member is ready', () => {
    expect(homeFeedQueryArgs('for_you', true)).toEqual({ filter: 'for_you' })
    expect(homeFeedQueryArgs('following', true)).toEqual({ filter: 'following' })
    expect(homeFeedQueryArgs('saved', true)).toEqual({ filter: 'saved' })
  })

  it('auto-loads only from a settled page that can load more', () => {
    expect(shouldAutoLoadFeedMore('CanLoadMore', true)).toBe(true)
    expect(shouldAutoLoadFeedMore('LoadingFirstPage', true)).toBe(false)
    expect(shouldAutoLoadFeedMore('LoadingMore', true)).toBe(false)
    expect(shouldAutoLoadFeedMore('Exhausted', true)).toBe(false)
    expect(shouldAutoLoadFeedMore('CanLoadMore', false)).toBe(false)
  })

  it('dedupes repeated end-of-list events per filter and page before status updates', () => {
    const key = feedLoadMoreKey('for_you', 20)
    expect(feedLoadMoreKey('for_you', 20)).toBe(key)
    expect(feedLoadMoreKey('for_you', 40)).not.toBe(key)
    expect(feedLoadMoreKey('following', 20)).not.toBe(key)

    expect(shouldRequestFeedLoadMore({ status: 'CanLoadMore', canQuery: true, loadMoreKey: key, lastRequestedKey: null })).toBe(true)
    expect(shouldRequestFeedLoadMore({ status: 'CanLoadMore', canQuery: true, loadMoreKey: key, lastRequestedKey: key })).toBe(false)
    expect(shouldRequestFeedLoadMore({ status: 'LoadingMore', canQuery: true, loadMoreKey: feedLoadMoreKey('for_you', 40), lastRequestedKey: key })).toBe(false)
    expect(shouldRequestFeedLoadMore({ status: 'CanLoadMore', canQuery: false, loadMoreKey: key, lastRequestedKey: null })).toBe(false)
  })

  it('releases a completed page when filtering leaves the item count unchanged', () => {
    const key = feedLoadMoreKey('for_you', 20)
    const requested = { queryKey: 'for_you:user-1', inFlightKey: key, observedLoading: false }
    const loading = syncFeedPageRequestState(requested, { queryKey: 'for_you:user-1', status: 'LoadingMore' })
    expect(loading.observedLoading).toBe(true)

    const completed = syncFeedPageRequestState(loading, { queryKey: 'for_you:user-1', status: 'CanLoadMore' })
    expect(completed).toEqual({ queryKey: 'for_you:user-1', inFlightKey: null, observedLoading: false })
    expect(shouldRequestFeedLoadMore({
      status: 'CanLoadMore',
      canQuery: true,
      loadMoreKey: key,
      lastRequestedKey: completed.inFlightKey,
    })).toBe(true)
  })

  it('resets the page guard when the filter or account query changes', () => {
    expect(syncFeedPageRequestState(
      { queryKey: 'for_you:user-1', inFlightKey: 'for_you:20', observedLoading: true },
      { queryKey: 'following:user-2', status: 'CanLoadMore' },
    )).toEqual({ queryKey: 'following:user-2', inFlightKey: null, observedLoading: false })
  })
})
