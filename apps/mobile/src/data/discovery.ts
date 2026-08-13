import type { ActivityCategory } from '@lets-be-friends/shared'

import { companions } from './companions'
import { mapFixtureDiscoveryCompanion, type DiscoveryCompanionViewModel, type SessionMode } from './companionViewModels'

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

export const fixtureDiscoveryCompanions = companions.map(mapFixtureDiscoveryCompanion)

export function filterDiscoveryCompanions(
  companions: DiscoveryCompanionViewModel[] = fixtureDiscoveryCompanions,
  query = '',
  filter: DiscoveryFilter = 'all',
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return companions.filter((companion) => {
    const matchesFilter = filter === 'all' || companion.sessionModes.includes(filter)
    if (!matchesFilter) return false
    if (!normalizedQuery) return true

    const searchable = [
      companion.name,
      companion.location,
      companion.intro,
      ...companion.categories,
      ...companion.strengths,
    ].join(' ').toLocaleLowerCase()

    return searchable.includes(normalizedQuery)
  })
}
