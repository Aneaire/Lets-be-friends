import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Star, User } from 'lucide-react'
import { productMapInitialView, productMapStyleUrl, productMapZoomForRadius } from '@lets-be-friends/shared'
import { clampCoordinates, type Coordinates } from '../../lib/geo'
import { Map, MapMarker, MapRadius, useMap } from '../primitives/map.client'
import type { MapPerson } from './ApproximateLocationMap'

type ThemeChoice = 'light' | 'dark'
type MapTone = 'self' | 'social'

const mapStyles: Record<ThemeChoice, string> = {
  light: productMapStyleUrl,
  dark: productMapStyleUrl,
}

const philippinesInitialView = {
  center: [...productMapInitialView.center] as [longitude: number, latitude: number],
  zoom: productMapInitialView.zoom,
}

function currentTheme(): ThemeChoice {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export default function ApproximateLocationMapClient({
  location,
  radiusKm,
  tone,
  interactive,
  pinnable,
  onChange,
  people,
  onSelectPerson,
}: {
  location: Coordinates | null
  radiusKm?: number
  tone: MapTone
  interactive: boolean
  pinnable: boolean
  onChange?: (location: Coordinates) => void
  people?: MapPerson[]
  onSelectPerson?: (key: string) => void
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
    : philippinesInitialView.center

  return (
    <Map
      center={center}
      zoom={location ? productMapZoomForRadius(radiusKm) : philippinesInitialView.zoom}
      styleUrl={mapStyles[theme]}
      interactive={interactive}
      ariaLabel={pinnable
        ? 'Interactive location map. Pan and zoom, then click or press Enter to place the pin at map center.'
        : 'Location map. Pan and zoom to browse; the pin stays fixed.'}
      onClick={pinnable ? updateLocation : undefined}
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
          draggable={pinnable}
          onDragEnd={pinnable ? updateLocation : undefined}
        >
          <span className="approx-location-map-marker" data-tone={tone} aria-hidden="true">
            <span className="approx-location-map-marker-dot" />
          </span>
        </MapMarker>
      )}
      {people?.map((person) => (
        <PersonPin key={person.key} person={person} onSelect={onSelectPerson} />
      ))}
      <MapResizer />
    </Map>
  )
}

function MapResizer() {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    const frame = requestAnimationFrame(() => map.resize())
    return () => cancelAnimationFrame(frame)
  }, [map])

  return null
}

function PersonPin({ person, onSelect }: { person: MapPerson; onSelect?: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const map = useMap()

  useEffect(() => {
    if (!open || !map) return
    const update = () => {
      try {
        const point = map.project([person.longitude, person.latitude])
        const rect = map.getContainer().getBoundingClientRect()
        setAnchor({ x: rect.left + point.x, y: rect.top + point.y })
      } catch {
        setAnchor(null)
      }
    }
    update()
    map.on('move', update)
    map.on('zoom', update)
    return () => {
      map.off('move', update)
      map.off('zoom', update)
    }
  }, [map, open, person.longitude, person.latitude])

  return (
    <MapMarker longitude={person.longitude} latitude={person.latitude}>
      <button
        type="button"
        className="approx-location-map-person"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => onSelect?.(person.key)}
        aria-label={`Open ${person.name}'s profile`}
      >
        {person.imageUrl ? (
          <img src={person.imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="approx-location-map-person-fallback" aria-hidden="true"><User aria-hidden="true" /></span>
        )}
      </button>
      {open && anchor && createPortal(
        <span className="map-person-popover-anchor" style={{ left: anchor.x, top: anchor.y }}>
          <PersonPopover person={person} />
        </span>,
        document.body,
      )}
    </MapMarker>
  )
}

function PersonPopover({ person }: { person: MapPerson }) {
  return (
    <div className="map-person-popover">
      <div className="map-person-popover-head">
        <span className="profile-photo">
          {person.imageUrl ? <img src={person.imageUrl} alt="" /> : <User aria-hidden="true" />}
        </span>
        <span className="map-person-popover-name">
          <strong>{person.name}</strong>
          {person.city && <small>{person.city}</small>}
        </span>
      </div>
      <span className="trust-chip" data-state={person.status ?? 'awaiting'}>
        <span className="trust-chip-dot" aria-hidden="true" />
        {trustLabel(person.status)}
      </span>
      {typeof person.rating === 'number' && (
        <span className="map-person-popover-rating">
          <Star size={12} fill="currentColor" aria-hidden="true" />
          <strong>{person.rating.toFixed(1)}</strong>
          <span>· {person.reviewCount ?? 0} {person.reviewCount === 1 ? 'review' : 'reviews'}</span>
        </span>
      )}
      {person.strengths && person.strengths.length > 0 && (
        <ul className="map-person-popover-strengths">
          {person.strengths.slice(0, 3).map((strength) => <li key={strength}>{strength}</li>)}
        </ul>
      )}
      {person.intro && <p className="map-person-popover-intro">{person.intro}</p>}
    </div>
  )
}

function trustLabel(state?: MapPerson['status']) {
  if (state === 'verified') return 'Identity checked'
  if (state === 'awaiting') return 'Review in progress'
  return 'Review in progress'
}
