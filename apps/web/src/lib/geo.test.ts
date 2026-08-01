import { describe, expect, it } from 'vitest'
import { circleCoordinates, clampCoordinates, distanceKm, offsetCoordinates, roundCoordinates } from './geo'

describe('privacy-safe geospatial helpers', () => {
  it('clamps and rounds coordinates before they are used as approximate pins', () => {
    expect(clampCoordinates({ latitude: 95, longitude: -190 })).toEqual({ latitude: 90, longitude: -180 })
    expect(roundCoordinates({ latitude: 10.315699, longitude: 123.885437 })).toEqual({
      latitude: 10.32,
      longitude: 123.89,
    })
  })

  it('measures haversine distance in kilometers', () => {
    const distance = distanceKm(
      { latitude: 10.3157, longitude: 123.8854 },
      { latitude: 10.7202, longitude: 122.5621 },
    )
    expect(distance).toBeGreaterThan(150)
    expect(distance).toBeLessThan(160)
  })

  it('offsets a pin predictably for keyboard controls', () => {
    const moved = offsetCoordinates({ latitude: 0, longitude: 0 }, 1, 1)
    expect(moved.latitude).toBeCloseTo(0.009, 3)
    expect(moved.longitude).toBeCloseTo(0.009, 3)
  })

  it('builds a closed radius ring around an origin', () => {
    const ring = circleCoordinates({ latitude: 10, longitude: 120 }, 25, 16)
    expect(ring).toHaveLength(17)
    expect(ring[0]).toEqual(ring[ring.length - 1])
    expect(distanceKm(
      { latitude: 10, longitude: 120 },
      { latitude: ring[4][1], longitude: ring[4][0] },
    )).toBeCloseTo(25, 0)
  })
})
