import { ClientOnly } from '@tanstack/react-router'
import { lazy, Suspense, useId } from 'react'
import { Maximize, Minimize } from 'lucide-react'
import { offsetCoordinates, type Coordinates } from '../lib/geo'

const ApproximateLocationMapClient = lazy(() => import('./ApproximateLocationMap.client'))

type MapTone = 'self' | 'social'

export type MapPerson = {
  key: string
  latitude: number
  longitude: number
  imageUrl?: string
  name: string
  city?: string
  intro?: string
  rating?: number
  reviewCount?: number
  strengths?: string[]
  status?: 'verified' | 'awaiting' | 'demo'
}

function MapPlaceholder() {
  return <div className="approx-location-map-placeholder" aria-hidden="true" />
}

export function ApproximateLocationMap({
  location,
  onChange,
  radiusKm,
  tone = 'self',
  title = 'Approximate area preview',
  description = 'This shows a general area, not an address or meeting point.',
  people,
  pinnable = false,
  onSelectPerson,
  expanded = false,
  onToggleExpand,
}: {
  location: Coordinates | null
  onChange?: (location: Coordinates) => void
  radiusKm?: number
  tone?: MapTone
  title?: string
  description?: string
  people?: MapPerson[]
  pinnable?: boolean
  onSelectPerson?: (key: string) => void
  expanded?: boolean
  onToggleExpand?: () => void
}) {
  const titleId = useId()
  const interactive = Boolean(onChange)
  const canPlacePin = interactive && pinnable
  const nudge = (northKm: number, eastKm: number) => {
    if (!location || !onChange) return
    onChange(offsetCoordinates(location, northKm, eastKm))
  }

  return (
    <figure className="approx-location-figure" aria-labelledby={titleId} data-tone={tone} data-expanded={expanded}>
      <div className="approx-location-map-frame">
        <ClientOnly fallback={<MapPlaceholder />}>
          <Suspense fallback={<MapPlaceholder />}>
            <ApproximateLocationMapClient
              location={location}
              radiusKm={radiusKm}
              tone={tone}
              interactive={interactive}
              pinnable={canPlacePin}
              onChange={onChange}
              people={people}
              onSelectPerson={onSelectPerson}
              expanded={expanded}
            />
          </Suspense>
        </ClientOnly>
      </div>
      <figcaption className="approx-location-caption">
        <span>
          <strong id={titleId}>{title}</strong>
          <span>{description}</span>
        </span>
        <span className="map-caption-actions">
          {onToggleExpand && (
            <button
              type="button"
              className="map-expand-toggle"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              aria-label={expanded ? 'Shrink map' : 'Enlarge map'}
            >
              {expanded ? <Minimize size={13} aria-hidden="true" /> : <Maximize size={13} aria-hidden="true" />}
              {expanded ? 'Shrink' : 'Enlarge'}
            </button>
          )}
          {canPlacePin && location && (
            <span className="map-pin-nudge" role="group" aria-label="Move pin in small steps">
              <button type="button" onClick={() => nudge(1, 0)} aria-label="Move pin north">N</button>
              <button type="button" onClick={() => nudge(0, -1)} aria-label="Move pin west">W</button>
              <button type="button" onClick={() => nudge(-1, 0)} aria-label="Move pin south">S</button>
              <button type="button" onClick={() => nudge(0, 1)} aria-label="Move pin east">E</button>
            </span>
          )}
        </span>
      </figcaption>
    </figure>
  )
}
