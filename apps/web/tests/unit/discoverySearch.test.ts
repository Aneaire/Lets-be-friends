import { describe, expect, it } from 'vitest'
import { findCompanions, matchesCompanionSearch, type SearchableCompanion } from '../../src/lib/discoverySearch'

const companion: SearchableCompanion = {
  username: 'maya_makati',
  displayName: 'Maya Santos',
  city: 'Makati',
  intro: 'I enjoy easygoing museum visits and coffee walks.',
  bio: 'A patient local guide for relaxed afternoons.',
  strengths: ['Good listener', 'Local knowledge'],
  categories: ['Arts and culture', 'Food and cafés'],
}

describe('Companion search', () => {
  it('matches names, cities, Strengths, and activities without case sensitivity', () => {
    expect(matchesCompanionSearch(companion, 'maya')).toBe(true)
    expect(matchesCompanionSearch(companion, 'MAKATI')).toBe(true)
    expect(matchesCompanionSearch(companion, 'good listener')).toBe(true)
    expect(matchesCompanionSearch(companion, 'arts culture')).toBe(true)
    expect(matchesCompanionSearch(companion, '@maya_makati')).toBe(true)
  })

  it('requires every entered term to match the profile', () => {
    expect(matchesCompanionSearch(companion, 'museum patient')).toBe(true)
    expect(matchesCompanionSearch(companion, 'museum hiking')).toBe(false)
  })

  it('treats an empty query as unfiltered', () => {
    expect(matchesCompanionSearch(companion, '   ')).toBe(true)
  })

  it('puts an exact unique username match first', () => {
    const broadMatch = { ...companion, username: 'maya_coffee', bio: 'Mentions maya_makati in this profile.' }
    expect(findCompanions([broadMatch, companion], '@maya_makati')[0]).toBe(companion)
  })
})
