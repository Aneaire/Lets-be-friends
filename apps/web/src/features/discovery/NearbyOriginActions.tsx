import { LocateFixed, MapPin } from 'lucide-react'
import { Button } from '../../design-system/atoms/Button'

export type NearbyOriginMode = 'device' | 'saved' | 'custom' | null

export function NearbyOriginActions({
  originMode,
  onUseCurrentLocation,
  onBeginTravelPin,
}: {
  originMode: NearbyOriginMode
  onUseCurrentLocation: () => void
  onBeginTravelPin: () => void
}) {
  // The member's location is the origin both when they share a fresh device
  // fix and when Explore starts from the approximate location they already
  // saved, so the location control reads as active in either case.
  const deviceActive = originMode === 'device' || originMode === 'saved'
  const pinActive = originMode === 'custom'

  return (
    <div className="nearby-search-origin-actions" aria-label="Search origin">
      <Button
        size="small"
        intent={deviceActive ? 'social' : 'neutral'}
        aria-pressed={deviceActive}
        onClick={onUseCurrentLocation}
        leadingIcon={<LocateFixed size={15} aria-hidden="true" />}
      >
        Use my location
      </Button>
      <Button
        size="small"
        intent={pinActive ? 'social' : 'neutral'}
        aria-pressed={pinActive}
        onClick={onBeginTravelPin}
        leadingIcon={<MapPin size={15} aria-hidden="true" />}
      >
        Place a pin
      </Button>
    </div>
  )
}
