import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native'
import { productMapInitialView, productMapStyleUrl, productMapZoomForRadius } from '@lets-be-friends/shared'
import { Pressable, StyleSheet, View } from 'react-native'

import type { ProductMapProps } from './ProductMap'
import { AppText } from '@/components/Typography'

export function ProductMap({ center, radiusKm, points = [], onSelectPoint }: ProductMapProps) {
  const mapCenter = center
    ? [center.longitude, center.latitude] as [number, number]
    : [...productMapInitialView.center] as [number, number]
  const radius = center && radiusKm ? circleFeature(center, radiusKm) : null

  return (
    <View style={styles.frame} accessibilityLabel="Nearby Companion map">
      <Map mapStyle={productMapStyleUrl} style={styles.map} attribution logo={false}>
        <Camera center={mapCenter} zoom={center ? productMapZoomForRadius(radiusKm) : productMapInitialView.zoom} duration={350} easing="ease" />
        {radius ? (
          <GeoJSONSource id="search-radius" data={radius}>
            <Layer id="search-radius-fill" type="fill" paint={{ 'fill-color': '#C1519C', 'fill-opacity': 0.12 }} />
            <Layer id="search-radius-line" type="line" paint={{ 'line-color': '#C1519C', 'line-width': 2 }} />
          </GeoJSONSource>
        ) : null}
        {center ? (
          <Marker id="search-origin" lngLat={[center.longitude, center.latitude]}>
            <View style={styles.originMarker}><View style={styles.originDot} /></View>
          </Marker>
        ) : null}
        {points.map((point) => (
          <Marker key={point.id} id={`companion-${point.id}`} lngLat={[point.longitude, point.latitude]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${point.name}'s profile`} onPress={() => onSelectPoint?.(point.id)} style={styles.personMarker}>
              <AppText variant="label" color="#FFFFFF">{initials(point.name)}</AppText>
            </Pressable>
          </Marker>
        ))}
      </Map>
    </View>
  )
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function circleFeature(center: { latitude: number; longitude: number }, radiusKm: number) {
  const coordinates: [number, number][] = []
  const latitudeRadius = radiusKm / 110.574
  const longitudeRadius = radiusKm / (111.32 * Math.cos(center.latitude * Math.PI / 180))
  for (let index = 0; index <= 64; index += 1) {
    const angle = index / 64 * Math.PI * 2
    coordinates.push([
      center.longitude + Math.cos(angle) * longitudeRadius,
      center.latitude + Math.sin(angle) * latitudeRadius,
    ])
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coordinates] },
  }
}

const styles = StyleSheet.create({
  frame: { height: 320, borderRadius: 18, overflow: 'hidden' },
  map: { flex: 1 },
  originMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#1093ED', alignItems: 'center', justifyContent: 'center' },
  originDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1093ED' },
  personMarker: { minWidth: 38, height: 38, paddingHorizontal: 7, borderRadius: 19, backgroundColor: '#C1519C', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
})
