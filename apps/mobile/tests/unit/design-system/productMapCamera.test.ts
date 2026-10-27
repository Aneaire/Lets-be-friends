import { productMapBoundsForRadius, productMapFocusZoom, productMapInitialView } from '@lets-be-friends/shared'

import {
  productMapCameraView,
  productMapPinZoom,
} from '@/design-system/organisms/productMapCamera'

const center = { latitude: 15.03, longitude: 120.68 }

describe('product map camera view', () => {
  it('frames the search radius with bounds instead of a fixed zoom', () => {
    const view = productMapCameraView({ center, radiusKm: 25 })
    const bounds = productMapBoundsForRadius(center, 25)

    expect(view.bounds).toEqual([bounds.west, bounds.south, bounds.east, bounds.north])
    expect(view.center).toEqual([center.longitude, center.latitude])
    expect(view.zoom).toBe(productMapFocusZoom)
  })

  it('keeps the radius framing stable when the radius changes', () => {
    const wide = productMapCameraView({ center, radiusKm: 100 })
    const narrow = productMapCameraView({ center, radiusKm: 5 })

    expect(wide.bounds).not.toBeNull()
    expect(narrow.bounds).not.toBeNull()
    expect(wide.bounds![0]).toBeLessThan(narrow.bounds![0])
    expect(wide.bounds![2]).toBeGreaterThan(narrow.bounds![2])
    expect(wide.bounds![3] - wide.bounds![1]).toBeGreaterThan(narrow.bounds![3] - narrow.bounds![1])
  })

  it('falls back to the close-up view when no radius is set', () => {
    const view = productMapCameraView({ center })

    expect(view.bounds).toBeNull()
    expect(view.zoom).toBe(productMapFocusZoom)
  })

  it('keeps the pin zoom while choosing a location', () => {
    const view = productMapCameraView({ center, radiusKm: 25, pinMode: true })

    expect(view.bounds).toBeNull()
    expect(view.zoom).toBe(productMapPinZoom)
    expect(view.center).toEqual([center.longitude, center.latitude])
  })

  it('centers the pin view on the Philippines without a location', () => {
    const view = productMapCameraView({ center: null, pinMode: true })

    expect(view.center).toEqual([...productMapInitialView.center])
    expect(view.zoom).toBe(productMapPinZoom)
  })
})
