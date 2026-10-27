import {
  productMapBoundsForRadius,
  productMapFocusZoom,
  productMapInitialView,
} from '@lets-be-friends/shared'

export const productMapPinZoom = 8
export const productMapBoundsPadding = 24

export type ProductMapCameraView = {
  /**
   * Flat LngLatBounds (`west`, `south`, `east`, `north`). When present the
   * native camera fits these bounds so the search circle fills the frame.
   */
  bounds: [number, number, number, number] | null
  center: [number, number]
  zoom: number
}

export function productMapCameraView({
  center,
  radiusKm,
  pinMode = false,
}: {
  center?: { latitude: number; longitude: number } | null
  radiusKm?: number
  pinMode?: boolean
}): ProductMapCameraView {
  const bounds = !pinMode && center && radiusKm ? productMapBoundsForRadius(center, radiusKm) : null

  return {
    bounds: bounds ? [bounds.west, bounds.south, bounds.east, bounds.north] : null,
    center: center ? [center.longitude, center.latitude] : [...productMapInitialView.center],
    zoom: pinMode
      ? productMapPinZoom
      : center
        ? productMapFocusZoom
        : productMapInitialView.zoom,
  }
}
