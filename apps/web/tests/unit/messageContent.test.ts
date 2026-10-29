import { describe, expect, it } from 'vitest'
import { extractMessageLinks } from '../../convex/messageContent'

describe('conversation link extraction', () => {
  it('finds links and trims sentence punctuation', () => {
    expect(extractMessageLinks('Read this: https://example.com/guide. And https://example.com/guide')).toEqual([
      'https://example.com/guide',
    ])
    expect(extractMessageLinks('(see https://example.com/notes)')).toEqual(['https://example.com/notes'])
    expect(extractMessageLinks('https://example.com/a?b=1&c=2, https://example.org/b!')).toEqual([
      'https://example.com/a?b=1&c=2',
      'https://example.org/b',
    ])
  })

  it('ignores text without web links', () => {
    expect(extractMessageLinks('Meet at 2:30 PM near the park.')).toEqual([])
    expect(extractMessageLinks('')).toEqual([])
  })
})
