export type SubmittedReviewMemberStatus = 'signed_out' | 'unconfigured' | 'unavailable' | 'error' | 'loading' | 'syncing' | 'ready'

export type SubmittedReviewGate =
  | 'signed_out'
  | 'unconfigured'
  | 'member_unavailable'
  | 'loading'
  | 'missing_id'
  | 'ready'

export function submittedReviewMemberGate(status: SubmittedReviewMemberStatus, reviewId: string): SubmittedReviewGate {
  if (status === 'signed_out') return 'signed_out'
  if (status === 'unconfigured') return 'unconfigured'
  if (status === 'unavailable' || status === 'error') return 'member_unavailable'
  if (status !== 'ready') return 'loading'
  if (!reviewId) return 'missing_id'
  return 'ready'
}

export function submittedReviewQueryState<T>(review: T | null | undefined): 'loading' | 'not_available' | 'ready' {
  if (review === undefined) return 'loading'
  if (review === null) return 'not_available'
  return 'ready'
}
