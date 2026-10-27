// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// NOTE: aliased on purpose. The mock factory below uses the global `Map`
// constructor, and a top-level `Map` binding would shadow it inside the factory.
import { Map as ProductMap } from '../../src/design-system/primitives/map.client'

type MapHandler = (event?: unknown) => void

const mapHarness = vi.hoisted(() => ({
  instances: [] as Array<{
    handlers: Map<string, Set<MapHandler>>
    fire: (type: string, event?: unknown) => void
    fitBoundsCalls: Array<{ bounds: unknown; options?: unknown }>
  }>,
  workerUrls: [] as string[],
}))

vi.mock('maplibre-gl', () => {
  class FakeMap {
    handlers = new Map<string, Set<MapHandler>>()
    fitBoundsCalls: Array<{ bounds: unknown; options?: unknown }> = []

    constructor() {
      const handlers = this.handlers
      mapHarness.instances.push({
        handlers,
        fitBoundsCalls: this.fitBoundsCalls,
        fire: (type: string, event?: unknown) => {
          handlers.get(type)?.forEach((handler) => handler(event))
        },
      })
    }

    on(type: string, handler: MapHandler) {
      const handlers = this.handlers.get(type) ?? new Set<MapHandler>()
      handlers.add(handler)
      this.handlers.set(type, handlers)
      return this
    }

    off(type: string, handler: MapHandler) {
      this.handlers.get(type)?.delete(handler)
      return this
    }

    getCanvas() {
      return document.createElement('canvas')
    }

    jumpTo() {}

    fitBounds(bounds: unknown, options?: unknown) {
      this.fitBoundsCalls.push({ bounds, options })
    }

    resize() {}

    remove() {}
  }

  class FakeMarker {}

  return {
    Map: FakeMap,
    Marker: FakeMarker,
    setWorkerUrl: (url: string) => {
      mapHarness.workerUrls.push(url)
    },
  }
})

beforeEach(() => {
  mapHarness.instances.length = 0
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  // jsdom reports zero-size elements, which the map treats as unmounted.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(420)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function lastMap() {
  const instance = mapHarness.instances.at(-1)
  if (!instance) throw new Error('expected the map to be created')
  return instance
}

describe('Map search bounds', () => {
  it('fits the camera to the search circle so it fills the frame', () => {
    render(
      <ProductMap
        center={[120.68, 15.03]}
        zoom={11.5}
        bounds={{ west: 120.5, south: 14.9, east: 120.86, north: 15.16 }}
        boundsPadding={24}
        styleUrl="https://tiles.openfreemap.org/styles/liberty"
      />,
    )

    expect(lastMap().fitBoundsCalls).toEqual([
      {
        bounds: [[120.5, 14.9], [120.86, 15.16]],
        options: { padding: 24, animate: false },
      },
    ])
  })

  it('keeps the camera on the fixed view when no search circle is active', () => {
    render(
      <ProductMap
        center={[121.774, 12.8797]}
        zoom={5.2}
        styleUrl="https://tiles.openfreemap.org/styles/liberty"
      />,
    )

    expect(lastMap().fitBoundsCalls).toEqual([])
  })
})

describe('Map initial load errors', () => {
  it('points maplibre at the vendored worker bundle', () => {
    expect(mapHarness.workerUrls).toContain('/maplibre/maplibre-gl-worker.mjs')
  })

  it('ignores a single failed tile and stays silent when the map loads', () => {
    const onInitialLoadError = vi.fn()
    render(
      <ProductMap
        center={[121.774, 12.8797]}
        zoom={5.2}
        styleUrl="https://tiles.openfreemap.org/styles/liberty"
        onInitialLoadError={onInitialLoadError}
      />,
    )

    lastMap().fire('error', {
      type: 'error',
      error: new Error('tile request failed with status 500'),
      tile: { tileID: '5/25/14' },
      sourceId: 'openmaptiles',
    })
    expect(onInitialLoadError).not.toHaveBeenCalled()

    lastMap().fire('load', { type: 'load' })
    expect(onInitialLoadError).not.toHaveBeenCalled()
  })

  it('reports a failed tile source so the map can offer a retry', () => {
    const onInitialLoadError = vi.fn()
    render(
      <ProductMap
        center={[121.774, 12.8797]}
        zoom={5.2}
        styleUrl="https://tiles.openfreemap.org/styles/liberty"
        onInitialLoadError={onInitialLoadError}
      />,
    )

    lastMap().fire('error', {
      type: 'error',
      error: new Error('failed to fetch TileJSON'),
      sourceId: 'openmaptiles',
    })
    expect(onInitialLoadError).toHaveBeenCalledTimes(1)
  })

  it('reports a style-level failure without tile or source context', () => {
    const onInitialLoadError = vi.fn()
    render(
      <ProductMap
        center={[121.774, 12.8797]}
        zoom={5.2}
        styleUrl="https://tiles.openfreemap.org/styles/liberty"
        onInitialLoadError={onInitialLoadError}
      />,
    )

    lastMap().fire('error', {
      type: 'error',
      error: new Error('failed to fetch the style document'),
    })
    expect(onInitialLoadError).toHaveBeenCalledTimes(1)
  })

  it('reports when the map never finishes loading', () => {
    vi.useFakeTimers()
    const onInitialLoadError = vi.fn()
    render(
      <ProductMap
        center={[121.774, 12.8797]}
        zoom={5.2}
        styleUrl="https://tiles.openfreemap.org/styles/liberty"
        onInitialLoadError={onInitialLoadError}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(onInitialLoadError).toHaveBeenCalledTimes(1)
  })

  it('stays silent when the map loads before the timeout', () => {
    vi.useFakeTimers()
    const onInitialLoadError = vi.fn()
    render(
      <ProductMap
        center={[121.774, 12.8797]}
        zoom={5.2}
        styleUrl="https://tiles.openfreemap.org/styles/liberty"
        onInitialLoadError={onInitialLoadError}
      />,
    )

    lastMap().fire('load', { type: 'load' })
    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(onInitialLoadError).not.toHaveBeenCalled()
  })
})
