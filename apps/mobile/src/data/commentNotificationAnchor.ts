export const MAX_COMMENT_ANCHOR_PAGES = 5

/**
 * Returns the index of the notification target in the arranged comment list,
 * or -1 when the comment is not on a loaded page yet.
 */
export function commentAnchorIndex<T extends { comment: { _id: string } }>(
  entries: readonly T[],
  commentId: string | undefined,
) {
  if (!commentId) return -1
  return entries.findIndex((entry) => String(entry.comment._id) === commentId)
}

/**
 * Comment notifications should catch up on older pages, but only a bounded
 * number of times. A deleted or very old comment must not keep the screen
 * loading forever.
 */
export function shouldLoadMoreForCommentAnchor(input: {
  commentId: string | undefined
  index: number
  status: 'CanLoadMore' | 'LoadingMore' | 'Exhausted' | 'LoadingFirstPage'
  attempts: number
  maxAttempts?: number
}) {
  if (!input.commentId || input.index >= 0) return false
  return input.status === 'CanLoadMore' && input.attempts < (input.maxAttempts ?? MAX_COMMENT_ANCHOR_PAGES)
}
