import { submittedReviewMemberGate, submittedReviewQueryState } from '@/data/submittedReview'

describe('submitted review route controller', () => {
  it('owns signed-out, unavailable, loading, and missing-id route states', () => {
    expect(submittedReviewMemberGate('signed_out', 'review-1')).toBe('signed_out')
    expect(submittedReviewMemberGate('unconfigured', 'review-1')).toBe('unconfigured')
    expect(submittedReviewMemberGate('error', 'review-1')).toBe('member_unavailable')
    expect(submittedReviewMemberGate('syncing', 'review-1')).toBe('loading')
    expect(submittedReviewMemberGate('ready', '')).toBe('missing_id')
    expect(submittedReviewMemberGate('ready', 'review-1')).toBe('ready')
  })

  it('keeps query loading, private null, and owned submission distinct', () => {
    expect(submittedReviewQueryState(undefined)).toBe('loading')
    expect(submittedReviewQueryState(null)).toBe('not_available')
    expect(submittedReviewQueryState({ _id: 'review-1' })).toBe('ready')
  })
})
