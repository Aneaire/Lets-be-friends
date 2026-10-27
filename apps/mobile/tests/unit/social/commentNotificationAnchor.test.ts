import {
  commentAnchorIndex,
  MAX_COMMENT_ANCHOR_PAGES,
  shouldLoadMoreForCommentAnchor,
} from '@/data/commentNotificationAnchor'

const entries = [
  { comment: { _id: 'root' } },
  { comment: { _id: 'reply' } },
]

describe('comment notification anchors', () => {
  it('finds a root comment or a reply in the arranged thread', () => {
    expect(commentAnchorIndex(entries, 'root')).toBe(0)
    expect(commentAnchorIndex(entries, 'reply')).toBe(1)
    expect(commentAnchorIndex(entries, 'missing')).toBe(-1)
    expect(commentAnchorIndex(entries, undefined)).toBe(-1)
  })

  it('loads older pages only while the comment is missing and the page can grow', () => {
    expect(shouldLoadMoreForCommentAnchor({ commentId: 'missing', index: -1, status: 'CanLoadMore', attempts: 0 })).toBe(true)
    expect(shouldLoadMoreForCommentAnchor({ commentId: 'missing', index: -1, status: 'LoadingMore', attempts: 0 })).toBe(false)
    expect(shouldLoadMoreForCommentAnchor({ commentId: 'missing', index: -1, status: 'Exhausted', attempts: 0 })).toBe(false)
    expect(shouldLoadMoreForCommentAnchor({ commentId: 'missing', index: -1, status: 'CanLoadMore', attempts: MAX_COMMENT_ANCHOR_PAGES })).toBe(false)
    expect(shouldLoadMoreForCommentAnchor({ commentId: 'reply', index: 1, status: 'CanLoadMore', attempts: 0 })).toBe(false)
  })
})
