import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native'
import { productMapInitialView, productMapStyleUrl, productMapZoomForRadius } from '@lets-be-friends/shared'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import type { ProductMapProps } from './ProductMap'
import { normalizeMapCoordinates } from '@/features/discovery/nearbyOrigin'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

export function ProductMap({ center, radiusKm, points = [], onSelectPoint, onPickLocation, pinMode = false, expanded = false }: ProductMapProps) {
  const theme = useAppTheme()
  const [failed, setFailed] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const mapCenter = center
    ? [center.longitude, center.latitude] as [number, number]
    : [...productMapInitialView.center] as [number, number]
  const radius = center && radiusKm ? circleFeature(center, radiusKm) : null

  function retry() {
    setFailed(false)
    setMapKey((key) => key + 1)
  }

  return (
    <View style={[styles.frame, expanded && styles.expandedFrame]} accessibilityLabel="Nearby Companion map">
      {!failed ? (
        <Map
          key={mapKey}
          mapStyle={productMapStyleUrl}
          style={styles.map}
          attribution
          logo={false}
          onDidFailLoadingMap={() => setFailed(true)}
          onDidFinishLoadingMap={() => setFailed(false)}
          onPress={pinMode ? (event) => {
            const origin = normalizeMapCoordinates(event.nativeEvent.lngLat)
            if (origin) onPickLocation?.(origin)
          } : undefined}
        >
          <Camera center={mapCenter} zoom={pinMode ? 8 : center ? productMapZoomForRadius(radiusKm) : productMapInitialView.zoom} duration={350} easing="ease" />
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
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${point.name}'s profile`} onPress={() => onSelectPoint?.(point.id)} style={[styles.personMarker, { backgroundColor: theme.colors.socialControl }]}>
                <AppText variant="label" color={theme.colors.accentText}>{initials(point.name)}</AppText>
              </Pressable>
            </Marker>
          ))}
        </Map>
      ) : (
        <View style={[styles.failure, { backgroundColor: theme.colors.surfaceRaised }]}>
          <AppText variant="bodyStrong">The map could not load</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Check your connection and try again. Your search area and results are still available.</AppText>
          <ActionButton label="Try map again" onPress={retry} intent="neutral" secondary compact />
        </View>
      )}
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
  expandedFrame: { height: 420 },
  map: { flex: 1 },
  failure: { flex: 1, padding: 18, alignItems: 'flex-start', justifyContent: 'center', gap: 8 },
  originMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#1093ED', alignItems: 'center', justifyContent: 'center' },
  originDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1093ED' },
  personMarker: { minWidth: 48, height: 48, paddingHorizontal: 9, borderRadius: 24, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
})
