export type NearbyOriginMode = 'device' | 'travel' | 'pin'

export type Coordinates = {
  latitude: number
  longitude: number
}

export function nearbyOriginLabel(mode: NearbyOriginMode, travelArea: string) {
  if (mode === 'device') return 'Current area'
  if (mode === 'pin') return 'Placed pin'
  return travelArea.trim()
}

type CoordinateInput = Coordinates | [number, number] | { lng: number; lat: number } | null | undefined

export function normalizeMapCoordinates(input: CoordinateInput): Coordinates | null {
  if (!input) return null

  if (Array.isArray(input)) {
    const [longitude, latitude] = input
    if (typeof longitude !== 'number' || typeof latitude !== 'number') return null
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null
    return { latitude, longitude }
  }

  if (typeof input === 'object') {
    const candidate = input as { latitude?: unknown; longitude?: unknown; lng?: unknown; lat?: unknown }
    const latitude = candidate.latitude ?? candidate.lat
    const longitude = candidate.longitude ?? candidate.lng
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return { latitude, longitude }
  }

  return null
}

export function roundOriginCoordinates(origin: Coordinates): Coordinates {
  return {
    latitude: Math.round(origin.latitude * 100) / 100,
    longitude: Math.round(origin.longitude * 100) / 100,
  }
}

export function sameOrigin(left: Coordinates, right: Coordinates) {
  return left.latitude === right.latitude && left.longitude === right.longitude
}

export type WebOriginCandidate = {
  latitude: number
  longitude: number
  label: string
}

const WEB_PIN_LAT_RANGE = [5, 19.5] as const
const WEB_PIN_LNG_RANGE = [116.5, 127] as const
const WEB_PIN_STEPS = 3

export function webPinOriginCandidates(): WebOriginCandidate[] {
  const candidates: WebOriginCandidate[] = []
  const latStep = (WEB_PIN_LAT_RANGE[1] - WEB_PIN_LAT_RANGE[0]) / (WEB_PIN_STEPS - 1)
  const lngStep = (WEB_PIN_LNG_RANGE[1] - WEB_PIN_LNG_RANGE[0]) / (WEB_PIN_STEPS - 1)
  for (let row = 0; row < WEB_PIN_STEPS; row += 1) {
    for (let column = 0; column < WEB_PIN_STEPS; column += 1) {
      const latitude = roundToTwo(WEB_PIN_LAT_RANGE[0] + row * latStep)
      const longitude = roundToTwo(WEB_PIN_LNG_RANGE[0] + column * lngStep)
      candidates.push({ latitude, longitude, label: `${latitude.toFixed(1)}°N ${longitude.toFixed(1)}°E` })
    }
  }
  return candidates
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}
