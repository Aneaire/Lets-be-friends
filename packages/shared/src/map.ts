export const productMapStyleUrl = 'https://tiles.openfreemap.org/styles/liberty'

export const productMapInitialView = {
  center: [121.774, 12.8797] as const,
  zoom: 5.2,
} as const

export function productMapZoomForRadius(radiusKm?: number) {
  if (!radiusKm) return 11.5
  if (radiusKm <= 5) return 9.5
  if (radiusKm <= 10) return 8.5
  if (radiusKm <= 25) return 7.3
  if (radiusKm <= 50) return 6.3
  return 5.3
}
