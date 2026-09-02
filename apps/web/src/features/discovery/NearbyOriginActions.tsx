import { LocateFixed, MapPin } from 'lucide-react'

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
      <button
        type="button"
        className={`btn btn-sm ${deviceActive ? 'btn-social' : 'btn-neutral'}`}
        aria-pressed={deviceActive}
        onClick={onUseCurrentLocation}
      >
        <LocateFixed size={15} aria-hidden="true" />
        Use my location
      </button>
      <button
        type="button"
        className={`btn btn-sm ${pinActive ? 'btn-social' : 'btn-neutral'}`}
        aria-pressed={pinActive}
        onClick={onBeginTravelPin}
      >
        <MapPin size={15} aria-hidden="true" />
        Place a pin
      </button>
    </div>
  )
}
