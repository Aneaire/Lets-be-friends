/*
 * Map lifecycle and marker patterns adapted from MapCN.
 * Copyright (c) 2025 Anmoldeep Singh
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { Map as MapLibreMap, Marker, setWorkerUrl, type MapMouseEvent, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { circleCoordinates, type Coordinates } from '../../lib/geo'

/*
 * MapLibre locates its web worker as a sibling of the bundled module
 * (`./maplibre-gl-worker.mjs` next to the importing chunk). Bundlers cannot
 * resolve that dynamic URL, so production builds 404 the worker and the map
 * never loads. The worker pair is vendored under `public/maplibre` (kept in
 * sync with the installed maplibre-gl version by `mapWorkerAssets.test.ts`)
 * and pointed at here.
 */
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')

const MapContext = createContext<MapLibreMap | null>(null)

export function useMap() {
  return useContext(MapContext)
}

export function Map({
  center,
  zoom,
  styleUrl,
  children,
  interactive = false,
  ariaLabel,
  onClick,
  onInitialLoadError,
}: {
  center: [longitude: number, latitude: number]
  zoom: number
  styleUrl: string
  children?: ReactNode
  interactive?: boolean
  ariaLabel?: string
  onClick?: (coordinates: Coordinates) => void
  onInitialLoadError?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onInitialLoadErrorRef = useRef(onInitialLoadError)
  const onClickRef = useRef(onClick)
  const [map, setMap] = useState<MapLibreMap | null>(null)

  useEffect(() => {
    onInitialLoadErrorRef.current = onInitialLoadError
    onClickRef.current = onClick
  }, [onClick, onInitialLoadError])

  useEffect(() => {
    if (!map) return
    map.jumpTo({ center, zoom })
  }, [center[0], center[1], map, zoom])

  useEffect(() => {
    if (!map) return
    const canvas = map.getCanvas()
    if (interactive) canvas.setAttribute('aria-label', ariaLabel ?? 'Interactive map')
  }, [ariaLabel, interactive, map])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    setMap(null)
    let instance: MapLibreMap
    let didLoad = false
    let didReportError = false

    try {
      instance = new MapLibreMap({
        container,
        style: styleUrl,
        center,
        zoom,
        interactive,
        renderWorldCopies: false,
        attributionControl: { compact: true },
      })
    } catch {
      onInitialLoadErrorRef.current?.()
      return
    }

    const canvas = instance.getCanvas()
    canvas.tabIndex = interactive ? 0 : -1
    if (interactive) {
      canvas.setAttribute('role', 'application')
      canvas.setAttribute('aria-label', ariaLabel ?? 'Interactive map')
    } else {
      canvas.setAttribute('aria-hidden', 'true')
    }

    const loadTimeout = window.setTimeout(() => {
      if (didLoad || didReportError) return
      didReportError = true
      onInitialLoadErrorRef.current?.()
    }, 15_000)

    const handleLoad = () => {
      didLoad = true
      window.clearTimeout(loadTimeout)
    }

    const handleError = (event: unknown) => {
      if (didLoad || didReportError) return
      // A single failed tile must not fail the whole map: MapLibre keeps
      // loading and still reaches `load` when other tiles succeed. Only
      // failures without tile context (style document, sprite, glyph, or a
      // whole tile source such as TileJSON) prevent the map from rendering.
      if (isRecoverableTileError(event)) return
      didReportError = true
      onInitialLoadErrorRef.current?.()
    }

    const handleClick = (event: MapMouseEvent) => {
      onClickRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      const next = instance.getCenter()
      onClickRef.current?.({ latitude: next.lat, longitude: next.lng })
    }

    instance.on('load', handleLoad)
    instance.on('error', handleError)
    instance.on('click', handleClick)
    canvas.addEventListener('keydown', handleKeyDown)
    setMap(instance)

    const resizeObserver = new ResizeObserver(() => instance.resize())
    resizeObserver.observe(container)

    return () => {
      window.clearTimeout(loadTimeout)
      resizeObserver.disconnect()
      instance.off('load', handleLoad)
      instance.off('error', handleError)
      instance.off('click', handleClick)
      canvas.removeEventListener('keydown', handleKeyDown)
      instance.remove()
    }
  }, [interactive, styleUrl])

  return (
    <MapContext.Provider value={map}>
      <div ref={containerRef} className="approx-location-map-canvas" />
      {map && children}
    </MapContext.Provider>
  )
}

/*
 * MapLibre reports a failed tile fetch on the map error event with the failing
 * tile attached (`tile_manager.ts` fires `ErrorEvent(err, {tile})`, bubbled up
 * with the source id). Errored tiles count as settled for `load`, so these
 * events are recoverable and must not fail the whole map. Events without tile
 * context (style document, sprite, glyph, or TileJSON source failures) mean the
 * map cannot render and stay fatal.
 */
function isRecoverableTileError(event: unknown): boolean {
  if (typeof event !== 'object' || event === null) return false
  return (event as { tile?: unknown }).tile != null
}

export function MapMarker({
  longitude,
  latitude,
  children,
  draggable = false,
  onDragEnd,
}: {
  longitude: number
  latitude: number
  children: ReactNode
  draggable?: boolean
  onDragEnd?: (coordinates: Coordinates) => void
}) {
  const map = useContext(MapContext)
  const markerElementRef = useRef<HTMLDivElement | null>(null)
  const onDragEndRef = useRef(onDragEnd)

  if (!markerElementRef.current) {
    markerElementRef.current = document.createElement('div')
    markerElementRef.current.className = 'approx-location-map-marker-companion'
  }

  useEffect(() => {
    onDragEndRef.current = onDragEnd
  }, [onDragEnd])

  useEffect(() => {
    if (!map || !markerElementRef.current) return

    const marker = new Marker({
      element: markerElementRef.current,
      anchor: 'center',
      draggable,
    })
      .setLngLat([longitude, latitude])
      .addTo(map)

    const markerElement = marker.getElement()
    markerElement.tabIndex = -1
    markerElement.removeAttribute('role')
    markerElement.setAttribute('aria-hidden', 'true')

    const handleDragEnd = () => {
      const next = marker.getLngLat()
      onDragEndRef.current?.({ latitude: next.lat, longitude: next.lng })
    }
    marker.on('dragend', handleDragEnd)

    return () => {
      marker.off('dragend', handleDragEnd)
      marker.remove()
    }
  }, [draggable, latitude, longitude, map])

  return createPortal(children, markerElementRef.current)
}

export function MapRadius({ center, radiusKm, color }: { center: Coordinates; radiusKm: number; color: string }) {
  const map = useContext(MapContext)
  const reactId = useId()
  const sourceId = `nearby-radius-${reactId}`
  const layerId = `${sourceId}-fill`
  const geometryRef = useRef(radiusFeature(center, radiusKm))
  geometryRef.current = radiusFeature(center, radiusKm)

  useEffect(() => {
    if (!map) return

    const addRadius = () => {
      if (!map.getStyle() || map.getSource(sourceId)) return
      map.addSource(sourceId, {
        type: 'geojson',
        data: geometryRef.current,
      })
      map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': color,
          'fill-opacity': 0.12,
          'fill-outline-color': color,
        },
      })
    }

    if (map.isStyleLoaded()) addRadius()
    else map.once('load', addRadius)

    return () => {
      map.off('load', addRadius)
      try {
        if (!map.getStyle()) return
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      } catch {
        // Parent map teardown can destroy the style before child effect cleanup runs.
      }
    }
  }, [color, layerId, map, sourceId])

  useEffect(() => {
    if (!map || !map.getStyle()) return
    const source = map.getSource(sourceId) as GeoJSONSource | undefined
    source?.setData(geometryRef.current)
  }, [center.latitude, center.longitude, map, radiusKm, sourceId])

  return null
}

function radiusFeature(center: Coordinates, radiusKm: number) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [circleCoordinates(center, radiusKm)],
    },
  }
}
