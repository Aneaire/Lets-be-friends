import { normalizeWebSharePath } from '@/data/webLinkRoutes'

describe('web share link normalization', () => {
  const configured = 'https://app.example.com'

  it('maps a shared post path to the native home focus route', () => {
    expect(normalizeWebSharePath('/social?postId=post_123', configured)).toBe('/?postId=post_123')
  })

  it('maps a post comment link to native post comments', () => {
    expect(normalizeWebSharePath('/social?postId=post_123&commentId=comment_9', configured))
      .toBe('/post-comments/post_123?commentId=comment_9')
  })

  it('maps a companion review share path to the native Companion route', () => {
    expect(normalizeWebSharePath('/companion-profile?companionProfileId=comp_1&reviewId=rev_2', configured))
      .toBe('/companion-profile/comp_1?reviewId=rev_2')
    expect(normalizeWebSharePath('/companion-profile?companionProfileId=comp_1', configured))
      .toBe('/companion-profile/comp_1')
  })

  it('maps a submitted-review permalink to the native review route', () => {
    expect(normalizeWebSharePath('/review?reviewId=rev_9', configured)).toBe('/review/rev_9')
    expect(normalizeWebSharePath('/review', configured)).toBeNull()
    expect(normalizeWebSharePath('/review?reviewId=', configured)).toBeNull()
  })

  it('maps Circle list and detail paths while preserving focus params', () => {
    expect(normalizeWebSharePath('/circles', configured)).toBe('/circles')
    expect(normalizeWebSharePath('/circles/circle_7', configured)).toBe('/circles/circle_7')
    expect(normalizeWebSharePath('/circles/circle_7?postId=post_1&commentId=c_2', configured))
      .toBe('/circles/circle_7?postId=post_1&commentId=c_2')
  })

  it('accepts a matching configured web origin and rejects foreign hosts', () => {
    expect(normalizeWebSharePath('https://app.example.com/social?postId=post_1', configured))
      .toBe('/?postId=post_1')
    expect(normalizeWebSharePath('https://evil.example.net/social?postId=post_1', configured)).toBeNull()
    expect(normalizeWebSharePath('https://app.example.com.evil.net/social?postId=post_1', configured)).toBeNull()
  })

  it('accepts same-app custom-scheme links without a configured web URL', () => {
    expect(normalizeWebSharePath('letsbefriends:///social?postId=post_1')).toBe('/?postId=post_1')
    expect(normalizeWebSharePath('letsbefriends:///circles/circle_7')).toBe('/circles/circle_7')
    expect(normalizeWebSharePath('letsbefriends://social?postId=post_1')).toBe('/?postId=post_1')
    expect(normalizeWebSharePath('letsbefriends://circles/circle_7')).toBe('/circles/circle_7')
    expect(normalizeWebSharePath('letsbefriends://companion-profile?companionProfileId=comp_1&reviewId=rev_2'))
      .toBe('/companion-profile/comp_1?reviewId=rev_2')
    expect(normalizeWebSharePath('letsbefriends://circles')).toBe('/circles')
  })

  it('rejects credential-bearing URLs', () => {
    expect(normalizeWebSharePath('https://user:pass@app.example.com/social?postId=post_1', configured)).toBeNull()
    expect(normalizeWebSharePath('https://user@app.example.com/social?postId=post_1', configured)).toBeNull()
    expect(normalizeWebSharePath('letsbefriends://user:pass@social?postId=post_1', configured)).toBeNull()
    expect(normalizeWebSharePath('letsbefriends://user@circles/circle_7', configured)).toBeNull()
  })

  it('rejects slash, separator, control, and malformed ids safely', () => {
    expect(normalizeWebSharePath('/social?postId=a%2Fb', configured)).toBeNull()
    expect(normalizeWebSharePath('/social?postId=a%5Cb', configured)).toBeNull()
    expect(normalizeWebSharePath('/social?postId=a%3Fq', configured)).toBeNull()
    expect(normalizeWebSharePath('/social?postId=a%26b', configured)).toBeNull()
    expect(normalizeWebSharePath('/social?postId=a%3Db', configured)).toBeNull()
    expect(normalizeWebSharePath('/social?postId=a%23b', configured)).toBeNull()
    expect(normalizeWebSharePath('/social?postId=a%25b', configured)).toBeNull()
    expect(normalizeWebSharePath('/social?postId=%00bad', configured)).toBeNull()
    expect(normalizeWebSharePath('/social?postId=%1Fbad', configured)).toBeNull()
    expect(normalizeWebSharePath('/social?postId=%7Fbad', configured)).toBeNull()
    expect(normalizeWebSharePath('/circles/a%2Fb', configured)).toBeNull()
    expect(normalizeWebSharePath('/social?postId=%E0%A4%A', configured)).toBeNull()
    expect(() => normalizeWebSharePath('/circles/%E0%A4%A', configured)).not.toThrow()
    expect(normalizeWebSharePath('/circles/%E0%A4%A', configured)).toBeNull()
    expect(normalizeWebSharePath('letsbefriends://circles/%E0%A4%A', configured)).toBeNull()
    expect(normalizeWebSharePath('letsbefriends:///circles/%E0%A4%A', configured)).toBeNull()
  })

  it('rejects malformed, unknown, dangerous, and id-less routes safely', () => {
    expect(normalizeWebSharePath('/social', configured)).toBeNull()
    expect(normalizeWebSharePath('/social?postId=%20%20', configured)).toBeNull()
    expect(normalizeWebSharePath('/companion-profile?reviewId=rev_1', configured)).toBeNull()
    expect(normalizeWebSharePath('/unknown?postId=x', configured)).toBeNull()
    expect(normalizeWebSharePath('javascript:alert(1)', configured)).toBeNull()
    expect(normalizeWebSharePath('', configured)).toBeNull()
    expect(normalizeWebSharePath('/circles/', configured)).toBe('/circles')
  })

  it('requires a configured origin before trusting absolute http(s) URLs, and tolerates path noise', () => {
    expect(normalizeWebSharePath('https://app.example.com/social?postId=post_1')).toBeNull()
    expect(normalizeWebSharePath('//evil.example.net/social?postId=post_1', configured)).toBeNull()
    expect(normalizeWebSharePath('social?postId=post_1', configured)).toBe('/?postId=post_1')
    expect(normalizeWebSharePath('/social/?postId=post_1', configured)).toBe('/?postId=post_1')
  })
})
