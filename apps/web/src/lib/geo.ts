export type Coordinates = {
  latitude: number
  longitude: number
}

export const nearbyRadiusOptions = [5, 10, 25, 50, 100] as const
export type NearbyRadiusKm = (typeof nearbyRadiusOptions)[number]

export function geolocationErrorMessage(code: number) {
  if (code === 1) {
    return 'Location permission is blocked. Allow location in your browser site settings, reload, then try again. You can also place a pin on the map.'
  }
  if (code === 2) {
    return 'Your browser could not determine your location. Try again, use another browser, or place a pin on the map.'
  }
  if (code === 3) {
    return 'Finding your location timed out. Try again or place a pin on the map.'
  }
  return 'Device location could not be read. Try again or place a pin on the map.'
}

const earthRadiusKm = 6371

export function clampCoordinates({ latitude, longitude }: Coordinates): Coordinates {
  return {
    latitude: Math.min(90, Math.max(-90, latitude)),
    longitude: Math.min(180, Math.max(-180, longitude)),
  }
}

export function roundCoordinates({ latitude, longitude }: Coordinates, decimalPlaces = 2): Coordinates {
  const factor = 10 ** decimalPlaces
  return {
    latitude: Math.round(latitude * factor) / factor,
    longitude: Math.round(longitude * factor) / factor,
  }
}

export function distanceKm(origin: Coordinates, destination: Coordinates) {
  const dLat = toRadians(destination.latitude - origin.latitude)
  const dLon = toRadians(destination.longitude - origin.longitude)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(origin.latitude))
      * Math.cos(toRadians(destination.latitude))
      * Math.sin(dLon / 2) ** 2

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function offsetCoordinates(origin: Coordinates, northKm: number, eastKm: number): Coordinates {
  const latitudeOffset = northKm / 110.574
  const longitudeScale = Math.max(0.01, Math.cos(toRadians(origin.latitude)))
  const longitudeOffset = eastKm / (111.32 * longitudeScale)
  return clampCoordinates({
    latitude: origin.latitude + latitudeOffset,
    longitude: origin.longitude + longitudeOffset,
  })
}

export function circleCoordinates(center: Coordinates, radiusKm: number, segments = 64): [number, number][] {
  const points: [number, number][] = []
  for (let index = 0; index <= segments; index += 1) {
    const angle = index / segments * Math.PI * 2
    const point = offsetCoordinates(center, Math.cos(angle) * radiusKm, Math.sin(angle) * radiusKm)
    points.push([point.longitude, point.latitude])
  }
  return points
}

function toRadians(value: number) {
  return value * Math.PI / 180
}
