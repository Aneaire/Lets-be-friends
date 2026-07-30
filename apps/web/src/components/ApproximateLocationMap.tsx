import { ClientOnly } from '@tanstack/react-router'
import { lazy, Suspense, useId } from 'react'

const ApproximateLocationMapClient = lazy(() => import('./ApproximateLocationMap.client'))

type ApproximateLocation = {
  latitude: number
  longitude: number
}

function MapPlaceholder() {
  return <div className="approx-location-map-placeholder" aria-hidden="true" />
}

export function ApproximateLocationMap({ location }: { location: ApproximateLocation }) {
  const titleId = useId()

  return (
    <figure className="approx-location-figure" aria-labelledby={titleId}>
      <div className="approx-location-map-frame">
        <ClientOnly fallback={<MapPlaceholder />}>
          <Suspense fallback={<MapPlaceholder />}>
            <ApproximateLocationMapClient location={location} />
          </Suspense>
        </ClientOnly>
      </div>
      <figcaption className="approx-location-caption">
        <strong id={titleId}>Approximate area preview</strong>
        <span>This shows a general area, not an address or meeting point.</span>
      </figcaption>
    </figure>
  )
}
