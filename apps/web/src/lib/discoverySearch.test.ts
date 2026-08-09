import { describe, expect, it } from 'vitest'
import { findFriendHosts, matchesFriendHostSearch, type SearchableFriendHost } from './discoverySearch'

const host: SearchableFriendHost = {
  username: 'maya_makati',
  displayName: 'Maya Santos',
  city: 'Makati',
  intro: 'I enjoy easygoing museum visits and coffee walks.',
  bio: 'A patient local guide for relaxed afternoons.',
  strengths: ['Good listener', 'Local knowledge'],
  categories: ['Arts and culture', 'Food and cafés'],
}

describe('Friend Host search', () => {
  it('matches names, cities, Strengths, and activities without case sensitivity', () => {
    expect(matchesFriendHostSearch(host, 'maya')).toBe(true)
    expect(matchesFriendHostSearch(host, 'MAKATI')).toBe(true)
    expect(matchesFriendHostSearch(host, 'good listener')).toBe(true)
    expect(matchesFriendHostSearch(host, 'arts culture')).toBe(true)
    expect(matchesFriendHostSearch(host, '@maya_makati')).toBe(true)
  })

  it('requires every entered term to match the profile', () => {
    expect(matchesFriendHostSearch(host, 'museum patient')).toBe(true)
    expect(matchesFriendHostSearch(host, 'museum hiking')).toBe(false)
  })

  it('treats an empty query as unfiltered', () => {
    expect(matchesFriendHostSearch(host, '   ')).toBe(true)
  })

  it('puts an exact unique username match first', () => {
    const broadMatch = { ...host, username: 'maya_coffee', bio: 'Mentions maya_makati in this profile.' }
    expect(findFriendHosts([broadMatch, host], '@maya_makati')[0]).toBe(host)
  })
})
