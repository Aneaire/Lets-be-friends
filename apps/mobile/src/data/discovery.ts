import type { ActivityCategory } from '@lets-be-friends/shared'

import { friendHosts } from './hosts'
import { mapFixtureDiscoveryHost, type DiscoveryHostViewModel, type SessionMode } from './hostViewModels'

export type DiscoveryFilter = 'all' | SessionMode

export const discoveryFilters: ReadonlyArray<{ id: DiscoveryFilter; label: string }> = [
  { id: 'all', label: 'For you' },
  { id: 'in_person', label: 'In person' },
  { id: 'online', label: 'Online' },
]

export const featuredCategories: ActivityCategory[] = [
  'Good company',
  'Coffee and meals',
  'Explore the city',
  'Study and coworking',
]

export const fixtureDiscoveryHosts = friendHosts.map(mapFixtureDiscoveryHost)

export function filterDiscoveryHosts(
  hosts: DiscoveryHostViewModel[] = fixtureDiscoveryHosts,
  query = '',
  filter: DiscoveryFilter = 'all',
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return hosts.filter((host) => {
    const matchesFilter = filter === 'all' || host.sessionModes.includes(filter)
    if (!matchesFilter) return false
    if (!normalizedQuery) return true

    const searchable = [
      host.name,
      host.location,
      host.intro,
      ...host.categories,
      ...host.strengths,
    ].join(' ').toLocaleLowerCase()

    return searchable.includes(normalizedQuery)
  })
}
