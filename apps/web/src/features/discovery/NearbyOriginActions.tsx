import { LocateFixed, MapPin } from 'lucide-react'
import { Button } from '../../design-system/atoms/Button'

export type NearbyOriginMode = 'device' | 'custom' | null

export function NearbyOriginActions({
  originMode,
  onUseCurrentLocation,
  onBeginTravelPin,
}: {
  originMode: NearbyOriginMode
  onUseCurrentLocation: () => void
  onBeginTravelPin: () => void
}) {
  const deviceActive = originMode === 'device'
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
