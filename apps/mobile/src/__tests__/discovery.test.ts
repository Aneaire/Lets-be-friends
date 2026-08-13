import { filterDiscoveryCompanions, fixtureDiscoveryCompanions } from '@/data/discovery'

const byId = (query = '', filter: Parameters<typeof filterDiscoveryCompanions>[2] = 'all') =>
  filterDiscoveryCompanions(fixtureDiscoveryCompanions, query, filter).map((companion) => companion.id)

describe('Companion discovery', () => {
  it('searches fields present in discovery results', () => {
    expect(byId('study partner')).toEqual(['sam-dela-cruz'])
    expect(byId('Makati')).toEqual(['mika-santos'])
    expect(byId('creative resets')).toEqual(['ines-garcia'])
  })

  it('combines search text with supported session format filters', () => {
    expect(byId('coffee', 'online')).toEqual(['mika-santos'])
    expect(byId('coffee', 'in_person')).toEqual(['mika-santos', 'paolo-reyes'])
  })

  it('ignores surrounding whitespace and casing', () => {
    expect(byId('  GOOD LISTENER  ')).toEqual(['mika-santos', 'sam-dela-cruz', 'ines-garcia'])
  })
})
