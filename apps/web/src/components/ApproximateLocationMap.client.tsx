import { useCallback, useEffect, useState } from 'react'
import { clampCoordinates, type Coordinates } from '../lib/geo'
import { Map, MapMarker, MapRadius } from './ui/map.client'

type ThemeChoice = 'light' | 'dark'
type MapTone = 'self' | 'social'

const mapStyles: Record<ThemeChoice, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

function currentTheme(): ThemeChoice {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function zoomForRadius(radiusKm?: number) {
  if (!radiusKm) return 11.5
  if (radiusKm <= 5) return 9.5
  if (radiusKm <= 10) return 8.5
  if (radiusKm <= 25) return 7.3
  if (radiusKm <= 50) return 6.3
  return 5.3
}

export default function ApproximateLocationMapClient({
  location,
  radiusKm,
  tone,
  interactive,
  onChange,
}: {
  location: Coordinates | null
  radiusKm?: number
  tone: MapTone
  interactive: boolean
  onChange?: (location: Coordinates) => void
}) {
  const [theme, setTheme] = useState<ThemeChoice>(currentTheme)
  const [mapUnavailable, setMapUnavailable] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setTheme(currentTheme()))
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setMapUnavailable(false)
  }, [location?.latitude, location?.longitude, radiusKm, theme])

  const handleInitialLoadError = useCallback(() => {
    setMapUnavailable(true)
  }, [])

  const updateLocation = useCallback((next: Coordinates) => {
    onChange?.(clampCoordinates(next))
  }, [onChange])

  if (mapUnavailable) {
    return (
      <div className="approx-location-map-error" role="status">
        Map unavailable. You can still use your device location or try again later.
      </div>
    )
  }

  const center: [number, number] = location
    ? [location.longitude, location.latitude]
    : [0, 20]

  return (
    <Map
      center={center}
      zoom={location ? zoomForRadius(radiusKm) : 1.4}
      styleUrl={mapStyles[theme]}
      interactive={interactive}
      ariaLabel={interactive ? 'Interactive location map. Pan and zoom, then click or press Enter to place the pin at map center.' : undefined}
      onClick={interactive ? updateLocation : undefined}
      onInitialLoadError={handleInitialLoadError}
    >
      {location && radiusKm && (
        <MapRadius
          center={location}
          radiusKm={radiusKm}
          color={tone === 'social' ? '#C1519C' : '#1093ED'}
        />
      )}
      {location && (
        <MapMarker
          longitude={location.longitude}
          latitude={location.latitude}
          draggable={interactive}
          onDragEnd={interactive ? updateLocation : undefined}
        >
          <span className="approx-location-map-marker" data-tone={tone} aria-hidden="true">
            <span className="approx-location-map-marker-dot" />
          </span>
        </MapMarker>
      )}
    </Map>
  )
}
