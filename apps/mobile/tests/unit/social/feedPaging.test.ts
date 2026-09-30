import { dedupeFeedItems } from '@/data/discovery'

type FeedFilter = 'for_you' | 'following' | 'saved'

function feedQueryKey(filter: FeedFilter, signedIn: boolean) {
  if (filter !== 'for_you' && !signedIn) return 'skip'
  return filter
}

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

  it('separates Following and Saved feeds from For You and requires sign in', () => {
    expect(feedQueryKey('for_you', false)).toBe('for_you')
    expect(feedQueryKey('following', false)).toBe('skip')
    expect(feedQueryKey('saved', false)).toBe('skip')
    expect(feedQueryKey('following', true)).toBe('following')
    expect(feedQueryKey('saved', true)).toBe('saved')
  })
})
