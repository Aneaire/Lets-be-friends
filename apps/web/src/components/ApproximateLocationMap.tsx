import { ClientOnly } from '@tanstack/react-router'
import { lazy, Suspense, useId } from 'react'
import { offsetCoordinates, type Coordinates } from '../lib/geo'

const ApproximateLocationMapClient = lazy(() => import('./ApproximateLocationMap.client'))

type MapTone = 'self' | 'social'

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
}: {
  location: Coordinates | null
  onChange?: (location: Coordinates) => void
  radiusKm?: number
  tone?: MapTone
  title?: string
  description?: string
}) {
  const titleId = useId()
  const interactive = Boolean(onChange)
  const nudge = (northKm: number, eastKm: number) => {
    if (!location || !onChange) return
    onChange(offsetCoordinates(location, northKm, eastKm))
  }

  return (
    <figure className="approx-location-figure" aria-labelledby={titleId} data-tone={tone}>
      <div className="approx-location-map-frame">
        <ClientOnly fallback={<MapPlaceholder />}>
          <Suspense fallback={<MapPlaceholder />}>
            <ApproximateLocationMapClient
              location={location}
              radiusKm={radiusKm}
              tone={tone}
              interactive={interactive}
              onChange={onChange}
            />
          </Suspense>
        </ClientOnly>
      </div>
      <figcaption className="approx-location-caption">
        <span>
          <strong id={titleId}>{title}</strong>
          <span>{description}</span>
        </span>
        {interactive && location && (
          <span className="map-pin-nudge" role="group" aria-label="Move pin in small steps">
            <button type="button" onClick={() => nudge(1, 0)} aria-label="Move pin north">N</button>
            <button type="button" onClick={() => nudge(0, -1)} aria-label="Move pin west">W</button>
            <button type="button" onClick={() => nudge(-1, 0)} aria-label="Move pin south">S</button>
            <button type="button" onClick={() => nudge(0, 1)} aria-label="Move pin east">E</button>
          </span>
        )}
      </figcaption>
    </figure>
  )
}
