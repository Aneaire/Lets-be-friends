import { filterDiscoveryHosts, fixtureDiscoveryHosts } from '@/data/discovery'

const byId = (query = '', filter: Parameters<typeof filterDiscoveryHosts>[2] = 'all') =>
  filterDiscoveryHosts(fixtureDiscoveryHosts, query, filter).map((host) => host.id)

describe('Friend Host discovery', () => {
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
