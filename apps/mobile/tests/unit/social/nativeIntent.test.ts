import { redirectSystemPath } from '@/app/+native-intent'

describe('native intent routing', () => {
  const original = process.env.EXPO_PUBLIC_WEB_APP_URL

  afterAll(() => {
    process.env.EXPO_PUBLIC_WEB_APP_URL = original
  })

  it('preserves Google OAuth callbacks before share-link handling', () => {
    process.env.EXPO_PUBLIC_WEB_APP_URL = 'https://app.example.com'
    expect(redirectSystemPath({ path: 'letsbefriends:///auth/callback?created_session_id=sess_1', initial: true }))
      .toBe('/auth/callback?created_session_id=sess_1')
  })

  it('resolves host-form and triple-slash share links to native routes', () => {
    process.env.EXPO_PUBLIC_WEB_APP_URL = 'https://app.example.com'
    expect(redirectSystemPath({ path: 'https://app.example.com/social?postId=post_1', initial: false }))
      .toBe('/?postId=post_1')
    expect(redirectSystemPath({ path: 'https://app.example.com/circles/circle_7', initial: false }))
      .toBe('/circles/circle_7')
    expect(redirectSystemPath({ path: 'letsbefriends://social?postId=post_1', initial: false }))
      .toBe('/?postId=post_1')
    expect(redirectSystemPath({ path: 'letsbefriends:///social?postId=post_1', initial: false }))
      .toBe('/?postId=post_1')
    expect(redirectSystemPath({ path: 'letsbefriends://circles/circle_7', initial: false }))
      .toBe('/circles/circle_7')
    expect(redirectSystemPath({ path: 'letsbefriends:///circles/circle_7', initial: false }))
      .toBe('/circles/circle_7')
  })

  it('preserves ordinary native routes and never routes unknown/foreign input into a share target', () => {
    process.env.EXPO_PUBLIC_WEB_APP_URL = 'https://app.example.com'
    expect(redirectSystemPath({ path: '/profile', initial: false })).toBe('/profile')
    expect(redirectSystemPath({ path: '/post-comments/post_1?commentId=c_1', initial: false }))
      .toBe('/post-comments/post_1?commentId=c_1')
    expect(redirectSystemPath({ path: '/circles', initial: false })).toBe('/circles')
    expect(redirectSystemPath({ path: 'https://user:pass@app.example.com/social?postId=post_1', initial: false }))
      .toBe('https://user:pass@app.example.com/social?postId=post_1')
    expect(() => redirectSystemPath({ path: '/circles/%E0%A4%A', initial: false })).not.toThrow()
    expect(redirectSystemPath({ path: '/circles/%E0%A4%A', initial: false })).toBe('/circles/%E0%A4%A')
  })

  it('leaves foreign, malformed, and unknown routes untouched', () => {
    process.env.EXPO_PUBLIC_WEB_APP_URL = 'https://app.example.com'
    expect(redirectSystemPath({ path: 'https://evil.example.net/social?postId=x', initial: false }))
      .toBe('https://evil.example.net/social?postId=x')
    expect(redirectSystemPath({ path: '/unknown-path', initial: false })).toBe('/unknown-path')
    expect(redirectSystemPath({ path: '/profile', initial: false })).toBe('/profile')
  })
})
