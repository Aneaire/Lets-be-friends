import { postShareUrl, reviewShareUrl } from '@/features/social/shareLinks'

describe('mobile share links', () => {
  const original = process.env.EXPO_PUBLIC_WEB_APP_URL

  afterAll(() => {
    process.env.EXPO_PUBLIC_WEB_APP_URL = original
  })

  it('returns undefined when the web app URL is not configured', () => {
    delete process.env.EXPO_PUBLIC_WEB_APP_URL
    expect(postShareUrl('post-1')).toBeUndefined()
    expect(reviewShareUrl('companion-1', 'review-1')).toBeUndefined()
  })

  it('builds encoded web links when the web app URL is configured', () => {
    process.env.EXPO_PUBLIC_WEB_APP_URL = 'https://app.example.com'
    expect(postShareUrl('post-1')).toBe('https://app.example.com/social?postId=post-1')
    expect(reviewShareUrl('companion-1', 'review-1'))
      .toBe('https://app.example.com/companion-profile?companionProfileId=companion-1&reviewId=review-1')
  })
})
