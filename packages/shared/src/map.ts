export const productMapStyleUrl = 'https://tiles.openfreemap.org/styles/liberty'

export const productMapInitialView = {
  center: [121.774, 12.8797] as const,
  zoom: 5.2,
} as const

/**
 * Close-up view used when a location is known but no search radius is set.
 * A radius is framed with `productMapBoundsForRadius` instead, so the circle
 * fills whatever map frame it is rendered in.
 */
export const productMapFocusZoom = 11.5

export type ProductMapCoordinates = {
  latitude: number
  longitude: number
}

export type ProductMapBounds = {
  west: number
  south: number
  east: number
  north: number
}

const kilometersPerLatitudeDegree = 110.574
const kilometersPerLongitudeDegree = 111.32
// Keeps the longitude span finite near the poles, where meridians converge.
const minimumLongitudeScale = 0.01

/**
 * Tight geographic bounds around a search radius. Both map surfaces fit their
 * camera to these bounds, so the radius circle fills the frame at any frame
 * size instead of relying on a fixed zoom level per radius.
 */
export function productMapBoundsForRadius(
  center: ProductMapCoordinates,
  radiusKm: number,
): ProductMapBounds {
  const latitudeRadius = radiusKm / kilometersPerLatitudeDegree
  const longitudeRadius = radiusKm / (
    kilometersPerLongitudeDegree
    * Math.max(minimumLongitudeScale, Math.cos(center.latitude * Math.PI / 180))
  )

  return {
    west: center.longitude - longitudeRadius,
    south: center.latitude - latitudeRadius,
    east: center.longitude + longitudeRadius,
    north: center.latitude + latitudeRadius,
  }
}
