import type { ProductMapPoint } from '@/design-system/organisms/ProductMap'
import type { DiscoveryCompanionViewModel } from '@/data/companionViewModels'

/**
 * Pins only carry presentation data: the map never decides what a selection
 * means, the Nearby screen opens the Companion detail sheet instead.
 */
export function nearbyMapPoints(companions: DiscoveryCompanionViewModel[]): ProductMapPoint[] {
  return companions.flatMap((companion) => (
    typeof companion.latitude === 'number' && typeof companion.longitude === 'number'
      ? [{
          id: companion.id,
          name: companion.name,
          imageUrl: companion.imageUrl,
          latitude: companion.latitude,
          longitude: companion.longitude,
        }]
      : []
  ))
}

export function nearbyCompanionMeta(companion: DiscoveryCompanionViewModel): string {
  return [companion.location, companion.distanceLabel].filter(Boolean).join(' · ')
}

export function nearbyCompanionRating(companion: DiscoveryCompanionViewModel): string {
  const reviewCount = companion.reviewCount
  if (typeof companion.rating === 'number' && reviewCount) {
    return `${companion.rating.toFixed(1)} ★ (${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})`
  }
  return 'New Companion'
}

export function nearbyCompanionStrengths(companion: DiscoveryCompanionViewModel, limit = 3): string[] {
  return companion.strengths.slice(0, limit)
}
