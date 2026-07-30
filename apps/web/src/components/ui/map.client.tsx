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
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const MapContext = createContext<maplibregl.Map | null>(null)

export function Map({
  center,
  zoom,
  styleUrl,
  children,
  onInitialLoadError,
}: {
  center: [longitude: number, latitude: number]
  zoom: number
  styleUrl: string
  children?: ReactNode
  onInitialLoadError?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onInitialLoadErrorRef = useRef(onInitialLoadError)
  const [map, setMap] = useState<maplibregl.Map | null>(null)

  useEffect(() => {
    onInitialLoadErrorRef.current = onInitialLoadError
  }, [onInitialLoadError])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    setMap(null)
    let instance: maplibregl.Map
    let didLoad = false
    let didReportError = false

    try {
      instance = new maplibregl.Map({
        container,
        style: styleUrl,
        center,
        zoom,
        interactive: false,
        renderWorldCopies: false,
        attributionControl: { compact: true },
      })
    } catch {
      onInitialLoadErrorRef.current?.()
      return
    }

    const canvas = instance.getCanvas()
    canvas.tabIndex = -1
    canvas.setAttribute('aria-hidden', 'true')

    const loadTimeout = window.setTimeout(() => {
      if (didLoad || didReportError) return
      didReportError = true
      onInitialLoadErrorRef.current?.()
    }, 15_000)

    const handleLoad = () => {
      didLoad = true
      window.clearTimeout(loadTimeout)
    }

    const handleError = () => {
      if (didLoad || didReportError) return
      didReportError = true
      onInitialLoadErrorRef.current?.()
    }

    instance.on('load', handleLoad)
    instance.on('error', handleError)
    setMap(instance)

    const resizeObserver = new ResizeObserver(() => instance.resize())
    resizeObserver.observe(container)

    return () => {
      window.clearTimeout(loadTimeout)
      resizeObserver.disconnect()
      instance.off('load', handleLoad)
      instance.off('error', handleError)
      instance.remove()
    }
  }, [center[0], center[1], styleUrl, zoom])

  return (
    <MapContext.Provider value={map}>
      <div ref={containerRef} className="approx-location-map-canvas" />
      {map && children}
    </MapContext.Provider>
  )
}

export function MapMarker({
  longitude,
  latitude,
  children,
}: {
  longitude: number
  latitude: number
  children: ReactNode
}) {
  const map = useContext(MapContext)
  const markerElementRef = useRef<HTMLDivElement | null>(null)

  if (!markerElementRef.current) {
    markerElementRef.current = document.createElement('div')
    markerElementRef.current.className = 'approx-location-map-marker-host'
  }

  useEffect(() => {
    if (!map || !markerElementRef.current) return

    const marker = new maplibregl.Marker({
      element: markerElementRef.current,
      anchor: 'center',
    })
      .setLngLat([longitude, latitude])
      .addTo(map)

    const markerElement = marker.getElement()
    markerElement.tabIndex = -1
    markerElement.removeAttribute('role')
    markerElement.setAttribute('aria-hidden', 'true')

    return () => {
      marker.remove()
    }
  }, [latitude, longitude, map])

  return createPortal(children, markerElementRef.current)
}
