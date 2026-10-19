import { describe, expect, it } from 'vitest'
import {
  approximateLocationJitterKm,
  fuzzApproximateCoordinates,
  roundApproximateCoordinates,
} from '../../src/location'

// Rounds along a great-circle-ish haversine so containment can be asserted.
function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371
  const toRadians = (value: number) => value * Math.PI / 180
  const dLat = toRadians(to.latitude - from.latitude)
  const dLon = toRadians(to.longitude - from.longitude)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const cebu = { latitude: 10.32, longitude: 123.89 }

describe('approximate location fuzzing', () => {
  it('rounds coordinates to the stored two decimal precision', () => {
    expect(roundApproximateCoordinates({ latitude: 10.315699, longitude: 123.885437 }))
      .toEqual({ latitude: 10.32, longitude: 123.89 })
  })

  it('reports the true point rounded when the offset collapses to zero', () => {
    expect(fuzzApproximateCoordinates(cebu, { random: () => 0 }))
      .toEqual({ latitude: 10.32, longitude: 123.89 })
  })

  it('draws a fresh nearby point for different randomness', () => {
    const first = fuzzApproximateCoordinates(cebu, { random: () => 0.15 })
    const second = fuzzApproximateCoordinates(cebu, { random: () => 0.85 })
    expect(first).not.toEqual(second)
  })

  it('keeps the saved point within the jitter radius plus rounding slop', () => {
    for (let step = 0; step < 200; step += 1) {
      const point = fuzzApproximateCoordinates(cebu, { radiusKm: approximateLocationJitterKm })
      expect(Math.round(point.latitude * 100) / 100).toBe(point.latitude)
      expect(Math.round(point.longitude * 100) / 100).toBe(point.longitude)
      // 1 km jitter, and two-decimal rounding can add at most ~0.8 km diagonally.
      expect(distanceKm(cebu, point)).toBeLessThanOrEqual(approximateLocationJitterKm + 1)
    }
  })

  it('never returns a coordinate outside the valid range near the poles', () => {
    const northern = fuzzApproximateCoordinates({ latitude: 89.999, longitude: 0 })
    expect(northern.latitude).toBeLessThanOrEqual(90)
    const southern = fuzzApproximateCoordinates({ latitude: -89.999, longitude: 180 })
    expect(southern.latitude).toBeGreaterThanOrEqual(-90)
    expect(southern.longitude).toBeGreaterThanOrEqual(-180)
    expect(southern.longitude).toBeLessThanOrEqual(180)
  })
})
