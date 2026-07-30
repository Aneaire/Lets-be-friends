import { useCallback, useEffect, useState } from 'react'
import { Map, MapMarker } from './ui/map.client'

type ThemeChoice = 'light' | 'dark'

const mapStyles: Record<ThemeChoice, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

function currentTheme(): ThemeChoice {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export default function ApproximateLocationMapClient({
  location,
}: {
  location: { latitude: number; longitude: number }
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
  }, [location.latitude, location.longitude, theme])

  const handleInitialLoadError = useCallback(() => {
    setMapUnavailable(true)
  }, [])

  if (mapUnavailable) {
    return (
      <div className="approx-location-map-error" role="status">
        Map preview unavailable. Your approximate location is still added.
      </div>
    )
  }

  return (
    <Map
      center={[location.longitude, location.latitude]}
      zoom={11.5}
      styleUrl={mapStyles[theme]}
      onInitialLoadError={handleInitialLoadError}
    >
      <MapMarker longitude={location.longitude} latitude={location.latitude}>
        <span className="approx-location-map-marker" aria-hidden="true">
          <span className="approx-location-map-marker-dot" />
        </span>
      </MapMarker>
    </Map>
  )
}
