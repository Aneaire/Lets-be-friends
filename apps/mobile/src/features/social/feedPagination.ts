export type HomeFeedFilter = 'for_you' | 'following' | 'saved'

export type FeedPageStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'

/**
 * Production access decision for the Home feed query. The feed stays skipped
 * until the member is ready, so signed-out members never page For You or the
 * relationship feeds. Home passes the result straight into
 * `usePaginatedQuery`.
 */
export function homeFeedQueryArgs(
  filter: HomeFeedFilter,
  signedIn: boolean,
): 'skip' | { filter: HomeFeedFilter } {
  if (!signedIn) return 'skip'
  return { filter }
}

/**
 * Automatic pagination guard with trigger protection. Loading starts only
 * from `CanLoadMore` while the feed can query, so repeated end-of-list
 * events during `LoadingMore` or `LoadingFirstPage` never stack concurrent
 * page requests. The manual Load more button stays as the recovery path when
 * automatic loading cannot run or was interrupted.
 */
export function shouldAutoLoadFeedMore(status: FeedPageStatus, canQuery: boolean): boolean {
  return canQuery && status === 'CanLoadMore'
}

/**
 * Stable dedupe key for one feed query page. `onEndReached` can fire several
 * times before Convex flips `status` to `LoadingMore`, so Home remembers the
 * last requested key and only calls `loadMore` once per filter and item
 * count. The manual Load more button reuses the same guard.
 */
export function feedLoadMoreKey(filter: HomeFeedFilter, itemCount: number): string {
  return `${filter}:${itemCount}`
}

export function shouldRequestFeedLoadMore(args: {
  status: FeedPageStatus
  canQuery: boolean
  loadMoreKey: string
  lastRequestedKey: string | null
}): boolean {
  if (!shouldAutoLoadFeedMore(args.status, args.canQuery)) return false
  return args.loadMoreKey !== args.lastRequestedKey
}

export type FeedPageRequestState = {
  queryKey: string
  inFlightKey: string | null
  observedLoading: boolean
}

/**
 * Reconciles the synchronous end-reached guard with the observable query
 * lifecycle. A completed page releases its key even when filtering or
 * deduplication leaves the visible item count unchanged.
 */
export function syncFeedPageRequestState(
  state: FeedPageRequestState,
  input: { queryKey: string; status: FeedPageStatus },
): FeedPageRequestState {
  if (state.queryKey !== input.queryKey) {
    return { queryKey: input.queryKey, inFlightKey: null, observedLoading: false }
  }
  if (input.status === 'LoadingMore' && state.inFlightKey !== null) {
    return state.observedLoading ? state : { ...state, observedLoading: true }
  }
  if (input.status !== 'LoadingMore' && state.observedLoading) {
    return { ...state, inFlightKey: null, observedLoading: false }
  }
  return state
}
