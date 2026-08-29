import type { DiscoveryCompanionViewModel } from '@/data/companionViewModels'
import { dedupeFeedItems, defaultDiscoveryFilters, discoveryCategoryOptions, filterDiscoveryCompanions, includeUnavailableCompanions, nearbySearchOptionsLabel, postMediaValidationError, type DiscoveryFilters } from '@/data/discovery'

const liveCompanions: DiscoveryCompanionViewModel[] = [
  {
    id: 'mika',
    source: 'convex',
    name: 'Coffee Test Companion',
    location: 'Makati',
    intro: 'Coffee and city walks.',
    strengths: ['Good listener', 'Coffee companion'],
    categories: ['Coffee and meals', 'Explore the city'],
    sessionModes: ['online', 'in_person'],
    verified: true,
    bookable: true,
  },
  {
    id: 'paolo',
    source: 'convex',
    name: 'Food Test Companion',
    location: 'Quezon City',
    intro: 'Neighborhood coffee and food stories.',
    strengths: ['Food trip companion'],
    categories: ['Coffee and meals'],
    sessionModes: ['in_person'],
    verified: true,
    bookable: true,
  },
  {
    id: 'sam',
    source: 'convex',
    name: 'Study Test Companion',
    location: 'Pasig',
    intro: 'A steady study partner for focused sessions.',
    strengths: ['Study partner', 'Good listener'],
    categories: ['Study and coworking'],
    sessionModes: ['online'],
    verified: true,
    bookable: true,
  },
  {
    id: 'ines',
    source: 'convex',
    name: 'Creative Test Companion',
    location: 'Taguig',
    intro: 'Creative resets and gentle prompts.',
    strengths: ['Hobby mentor', 'Good listener'],
    categories: ['Arts and crafts'],
    sessionModes: ['online', 'in_person'],
    verified: true,
    bookable: false,
  },
]

const byId = (query = '', filters: Partial<DiscoveryFilters> = {}) => filterDiscoveryCompanions(
  liveCompanions,
  query,
  { ...defaultDiscoveryFilters, ...filters },
).map((companion) => companion.id)

describe('Companion discovery', () => {
  it('includes custom profile categories alongside the default filters', () => {
    const options = discoveryCategoryOptions([
      liveCompanions[0],
      { ...liveCompanions[1], categories: ['Board game nights'] },
    ])
    expect(options).toContain('Good company')
    expect(options).toContain('Board game nights')
    expect(options).not.toContain('Everything')
  })

  it('searches only fields present in live discovery results', () => {
    expect(byId('study partner')).toEqual(['sam'])
    expect(byId('Makati')).toEqual(['mika'])
    expect(byId('creative resets', { bookableOnly: false })).toEqual(['ines'])
  })

  it('combines search text with session format filters', () => {
    expect(byId('coffee', { mode: 'online' })).toEqual(['mika'])
    expect(byId('coffee', { mode: 'in_person' })).toEqual(['mika', 'paolo'])
  })

  it('applies category, Strength, and bookable filters together', () => {
    expect(byId('', { category: 'Coffee and meals', strength: 'Good listener' })).toEqual(['mika'])
    expect(byId('', { category: 'Arts and crafts' })).toEqual([])
    expect(byId('', { category: 'Arts and crafts', bookableOnly: false })).toEqual(['ines'])
    expect(filterDiscoveryCompanions(
      [{ ...liveCompanions[0], categories: ['Board Game Nights'] }],
      '',
      { ...defaultDiscoveryFilters, category: 'board game nights' },
    ).map((companion) => companion.id)).toEqual(['mika'])
  })

  it('turns the zero-result include action into an unavailable-inclusive filter', () => {
    const artsFilters: DiscoveryFilters = { ...defaultDiscoveryFilters, category: 'Arts and crafts' }
    expect(filterDiscoveryCompanions(liveCompanions, '', artsFilters)).toEqual([])
    expect(filterDiscoveryCompanions(liveCompanions, '', includeUnavailableCompanions(artsFilters)).map((companion) => companion.id)).toEqual(['ines'])
  })

  it('describes the hidden nearby options on the circular map control', () => {
    expect(nearbySearchOptionsLabel(25, '', defaultDiscoveryFilters)).toBe(
      'Open nearby search options. 25 km radius. 1 active option.',
    )
    expect(nearbySearchOptionsLabel(50, 'coffee', {
      ...defaultDiscoveryFilters,
      mode: 'in_person',
      strength: 'Good listener',
    })).toBe('Open nearby search options. 50 km radius. 4 active options.')
  })

  it('deduplicates reactive feed pages and validates media before upload grants', () => {
    expect(dedupeFeedItems([{ itemKey: 'post:1', value: 'old' }, { itemKey: 'post:2', value: 'safe' }, { itemKey: 'post:1', value: 'new' }])).toEqual([
      { itemKey: 'post:1', value: 'new' },
      { itemKey: 'post:2', value: 'safe' },
    ])
    expect(postMediaValidationError({ type: 'image', mimeType: 'image/jpeg', fileSize: 10 * 1024 * 1024 })).toBeNull()
    expect(postMediaValidationError({ type: 'image', mimeType: 'image/jpeg', fileSize: 10 * 1024 * 1024 + 1 })).toContain('10 MB')
    expect(postMediaValidationError({ type: 'video', mimeType: 'video/mp4', fileSize: 50 * 1024 * 1024 + 1 })).toContain('50 MB')
    expect(postMediaValidationError({ type: 'image', mimeType: 'application/pdf', fileSize: 100 })).toContain('could not be verified')
    expect(postMediaValidationError({ type: 'video', mimeType: 'image/jpeg', fileSize: 100 })).toContain('could not be verified')
  })

  it('ignores surrounding whitespace and casing while excluding demo sources', () => {
    expect(byId('  GOOD LISTENER  ', { bookableOnly: false })).toEqual(['mika', 'sam', 'ines'])
    expect(byId('should never appear', { bookableOnly: false })).toEqual([])
  })
})
