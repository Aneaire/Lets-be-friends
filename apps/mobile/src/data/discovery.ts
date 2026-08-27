import { activityCategories, activityCategoriesMatch, activityCategoryOptions, friendStrengths, type ActivityCategory, type FriendStrength } from '@lets-be-friends/shared'

import type { DiscoveryCompanionViewModel, SessionMode } from './companionViewModels'

export type DiscoveryFilters = {
  mode: 'all' | SessionMode
  category?: ActivityCategory
  strength?: FriendStrength
  bookableOnly: boolean
}

export const defaultDiscoveryFilters: DiscoveryFilters = {
  mode: 'all',
  bookableOnly: true,
}

export function includeUnavailableCompanions(filters: DiscoveryFilters): DiscoveryFilters {
  return { ...filters, bookableOnly: false }
}

export const maximumPostMediaItems = 5
export const maximumPostImageBytes = 10 * 1024 * 1024
export const maximumPostVideoBytes = 50 * 1024 * 1024

export function postMediaValidationError(candidate: { type?: string | null; mimeType?: string | null; fileSize?: number | null }) {
  const pickerKind = candidate.type === 'image' ? 'image' : candidate.type === 'video' ? 'video' : null
  const mimeKind = candidate.mimeType?.startsWith('image/') ? 'image' : candidate.mimeType?.startsWith('video/') ? 'video' : null
  const kind = pickerKind ?? mimeKind
  if (!kind) return 'Community posts can include photos and videos only.'
  if (pickerKind && mimeKind && pickerKind !== mimeKind) return 'The selected media type could not be verified.'
  if (!candidate.mimeType || !candidate.mimeType.startsWith(`${kind}/`)) return `The selected ${kind === 'image' ? 'photo' : 'video'} type could not be verified.`
  if (typeof candidate.fileSize !== 'number' || !Number.isFinite(candidate.fileSize) || candidate.fileSize < 0) return `The selected ${kind === 'image' ? 'photo' : 'video'} size could not be verified.`
  if (kind === 'image' && candidate.fileSize > maximumPostImageBytes) return 'Photos must be 10 MB or smaller.'
  if (kind === 'video' && candidate.fileSize > maximumPostVideoBytes) return 'Videos must be 50 MB or smaller.'
  return null
}

export function dedupeFeedItems<T extends { itemKey: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.itemKey, item])).values()]
}

export const discoveryModes: ReadonlyArray<{ id: DiscoveryFilters['mode']; label: string }> = [
  { id: 'all', label: 'Any format' },
  { id: 'in_person', label: 'In person' },
  { id: 'online', label: 'Online' },
]

export const discoveryCategories = activityCategories
export const discoveryStrengths = friendStrengths

export function discoveryCategoryOptions(companions: ReadonlyArray<Pick<DiscoveryCompanionViewModel, 'categories'>>) {
  return activityCategoryOptions(...companions.map((companion) => companion.categories))
}

export const featuredCategories: ActivityCategory[] = [
  'Good company',
  'Coffee and meals',
  'Explore the city',
  'Study and coworking',
]

export function filterDiscoveryCompanions(
  companions: DiscoveryCompanionViewModel[],
  query = '',
  filters: DiscoveryFilters = defaultDiscoveryFilters,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return companions.filter((companion) => {
    if (filters.bookableOnly && !companion.bookable) return false
    if (filters.mode !== 'all' && !companion.sessionModes.includes(filters.mode)) return false
    if (filters.category && !companion.categories.some((category) => activityCategoriesMatch(category, filters.category!))) return false
    if (filters.strength && !companion.strengths.includes(filters.strength)) return false
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

export function activeDiscoveryFilterCount(filters: DiscoveryFilters) {
  return Number(filters.mode !== 'all') + Number(Boolean(filters.category)) + Number(Boolean(filters.strength)) + Number(filters.bookableOnly)
}
