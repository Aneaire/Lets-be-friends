import { describe, expect, it } from 'vitest'
import {
  productMapBoundsForRadius,
  productMapFocusZoom,
  productMapInitialView,
  productMapStyleUrl,
} from '../../src/map'

describe('product map defaults', () => {
  it('uses a secure public style and a Philippines-wide initial view', () => {
    expect(productMapStyleUrl).toMatch(/^https:\/\//)
    expect(productMapInitialView.center).toEqual([121.774, 12.8797])
    expect(productMapInitialView.zoom).toBe(5.2)
    expect(productMapFocusZoom).toBe(11.5)
  })

  it('wraps a search circle in bounds that match its radius', () => {
    const center = { latitude: 15.03, longitude: 120.68 }
    const radiusKm = 25
    const bounds = productMapBoundsForRadius(center, radiusKm)

    expect(bounds.south).toBeLessThan(center.latitude)
    expect(bounds.north).toBeGreaterThan(center.latitude)
    expect(bounds.west).toBeLessThan(center.longitude)
    expect(bounds.east).toBeGreaterThan(center.longitude)
    expect(bounds.north - bounds.south).toBeCloseTo(2 * radiusKm / 110.574, 6)
    expect(bounds.east - bounds.west).toBeCloseTo(
      2 * radiusKm / (111.32 * Math.cos(center.latitude * Math.PI / 180)),
      6,
    )
  })

  it('keeps the longitude span finite near the poles', () => {
    const bounds = productMapBoundsForRadius({ latitude: 89.9999, longitude: 0 }, 50)
    expect(Number.isFinite(bounds.west)).toBe(true)
    expect(bounds.east - bounds.west).toBeCloseTo(2 * 50 / (111.32 * 0.01), 6)
  })
})
