export type CoordinatePair = {
  latitude: number
  longitude: number
}

/**
 * How far a stored approximate location may sit from the real device fix, in
 * kilometers. Every save re-rolls a fresh offset inside this radius so the
 * saved point is near the member without ever being a stable label of their
 * real spot.
 */
export const approximateLocationJitterKm = 1

const approximateLocationDecimals = 2
const kmPerDegreeLatitude = 110.574
const kmPerDegreeLongitudeAtEquator = 111.32

export function roundApproximateCoordinates({ latitude, longitude }: CoordinatePair): CoordinatePair {
  return {
    latitude: roundToDecimals(latitude),
    longitude: roundToDecimals(longitude),
  }
}

/**
 * Draws a random point uniformly inside a disc of `radiusKm` around the true
 * fix, then rounds it to the stored precision. Every direction and distance is
 * equally likely, so the saved point hides the real location within the radius
 * while still staying close to it.
 *
 * Pass `random` to make the draw deterministic in tests.
 */
export function fuzzApproximateCoordinates(
  origin: CoordinatePair,
  options: { radiusKm?: number; random?: () => number } = {},
): CoordinatePair {
  const radiusKm = options.radiusKm ?? approximateLocationJitterKm
  const random = options.random ?? Math.random
  // sqrt keeps the density even across the disc; without it the center would
  // be favored and the real location easier to guess.
  const distanceKm = radiusKm * Math.sqrt(clamp01(random()))
  const angle = 2 * Math.PI * clamp01(random())
  const northKm = distanceKm * Math.cos(angle)
  const eastKm = distanceKm * Math.sin(angle)
  const longitudeScale = Math.max(0.01, Math.cos(toRadians(origin.latitude)))

  return roundApproximateCoordinates({
    latitude: clamp(origin.latitude + northKm / kmPerDegreeLatitude, -90, 90),
    longitude: clamp(origin.longitude + eastKm / (kmPerDegreeLongitudeAtEquator * longitudeScale), -180, 180),
  })
}

function roundToDecimals(value: number) {
  const factor = 10 ** approximateLocationDecimals
  return Math.round(value * factor) / factor
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function clamp01(value: number) {
  return clamp(value, 0, 1)
}

function toRadians(value: number) {
  return value * Math.PI / 180
}
