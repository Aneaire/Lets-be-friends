import {
  nearbyOriginLabel,
  normalizeMapCoordinates,
  roundOriginCoordinates,
  sameOrigin,
  webPinOriginCandidates,
} from '@/features/discovery/nearbyOrigin'

describe('nearby search origin', () => {
  it('labels each origin mode', () => {
    expect(nearbyOriginLabel('device', '')).toBe('Current area')
    expect(nearbyOriginLabel('pin', '')).toBe('Placed pin')
    expect(nearbyOriginLabel('travel', '  Makati  ')).toBe('Makati')
  })

  it('normalizes a map lngLat tuple into latitude and longitude', () => {
    expect(normalizeMapCoordinates([120.9842, 14.5995])).toEqual({ latitude: 14.5995, longitude: 120.9842 })
  })

  it('normalizes a coordinates object from location APIs', () => {
    expect(normalizeMapCoordinates({ latitude: 14.5995, longitude: 120.9842 })).toEqual({ latitude: 14.5995, longitude: 120.9842 })
    expect(normalizeMapCoordinates({ lat: -3, lng: 42 })).toEqual({ latitude: -3, longitude: 42 })
  })

  it('rejects empty, non-numeric, and non-finite inputs', () => {
    expect(normalizeMapCoordinates(null)).toBeNull()
    expect(normalizeMapCoordinates(undefined)).toBeNull()
    expect(normalizeMapCoordinates([] as never)).toBeNull()
    expect(normalizeMapCoordinates([NaN, 2])).toBeNull()
    expect(normalizeMapCoordinates([Number.POSITIVE_INFINITY, 2])).toBeNull()
    expect(normalizeMapCoordinates({ latitude: 'x', longitude: 2 } as never)).toBeNull()
    expect(normalizeMapCoordinates({ latitude: 1 } as never)).toBeNull()
  })

  it('rounds origin coordinates to two decimal places', () => {
    expect(roundOriginCoordinates({ latitude: 14.599512, longitude: 120.9842123 })).toEqual({ latitude: 14.6, longitude: 120.98 })
  })

  it('compares origins by their rounded coordinates', () => {
    expect(sameOrigin({ latitude: 14.6, longitude: 120.98 }, { latitude: 14.6, longitude: 120.98 })).toBe(true)
    expect(sameOrigin({ latitude: 14.6, longitude: 120.98 }, { latitude: 14.6, longitude: 120.99 })).toBe(false)
  })

  it('offers a distinct grid of approximate web pin origins inside the country bounds', () => {
    const candidates = webPinOriginCandidates()
    expect(candidates).toHaveLength(9)
    const unique = new Set(candidates.map((candidate) => `${candidate.latitude}-${candidate.longitude}`))
    expect(unique.size).toBe(9)
    for (const candidate of candidates) {
      expect(candidate.latitude).toBeGreaterThanOrEqual(5)
      expect(candidate.latitude).toBeLessThanOrEqual(19.5)
      expect(candidate.longitude).toBeGreaterThanOrEqual(116.5)
      expect(candidate.longitude).toBeLessThanOrEqual(127)
      expect(candidate.label).toMatch(/^[\d.]+°N [\d.]+°E$/)
      expect(normalizeMapCoordinates([candidate.longitude, candidate.latitude])).toEqual({ latitude: candidate.latitude, longitude: candidate.longitude })
    }
  })
})
