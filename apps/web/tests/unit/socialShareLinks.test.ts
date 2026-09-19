import { describe, expect, it } from 'vitest'
import { postSharePath, reviewSharePath, shareTargetUrl } from '../../src/features/social/shareLinks'

describe('social share links', () => {
  it('builds the canonical web paths for posts and reviews', () => {
    expect(postSharePath('post-1')).toBe('/social?postId=post-1')
    expect(reviewSharePath('companion-1', 'review-1')).toBe('/companion-profile?companionProfileId=companion-1&reviewId=review-1')
  })

  it('encodes ids and prepends the supplied origin', () => {
    expect(shareTargetUrl({ kind: 'post', postId: 'post/with space' }, 'https://app.example.com'))
      .toBe('https://app.example.com/social?postId=post%2Fwith%20space')
    expect(shareTargetUrl({ kind: 'review', companionProfileId: 'companion 1', reviewId: 'review&2' }, 'https://app.example.com'))
      .toBe('https://app.example.com/companion-profile?companionProfileId=companion%201&reviewId=review%262')
  })
})
