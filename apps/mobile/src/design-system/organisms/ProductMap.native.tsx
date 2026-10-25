import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native'
import { productMapInitialView, productMapStyleUrl, productMapZoomForRadius } from '@lets-be-friends/shared'
import { useEffect, useRef, useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'

import type { ProductMapProps } from './ProductMap'
import { createMapInteractionTracker } from './productMapInteraction'
import { normalizeMapCoordinates } from '@/features/discovery/nearbyOrigin'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

const zoomStep = 1
const minimumInteractiveZoom = 2
const maximumInteractiveZoom = 19

export function ProductMap({ center, radiusKm, points = [], onSelectPoint, onPickLocation, onInteractionChange, pinMode = false, expanded = false }: ProductMapProps) {
  const theme = useAppTheme()
  const [failed, setFailed] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const cameraRef = useRef<CameraRef>(null)
  const mapCenter = center
    ? [center.longitude, center.latitude] as [number, number]
    : [...productMapInitialView.center] as [number, number]
  const mapZoom = pinMode ? 8 : center ? productMapZoomForRadius(radiusKm) : productMapInitialView.zoom
  // Zoom buttons read the live zoom from a ref so gestures never re-render the
  // map and re-apply the declarative camera stop.
  const currentZoom = useRef(mapZoom)
  const onInteractionChangeRef = useRef(onInteractionChange)
  const interaction = useRef(createMapInteractionTracker((active) => onInteractionChangeRef.current?.(active)))
  const radius = center && radiusKm ? circleFeature(center, radiusKm) : null

  useEffect(() => {
    onInteractionChangeRef.current = onInteractionChange
  }, [onInteractionChange])

  useEffect(() => {
    currentZoom.current = mapZoom
  }, [mapZoom])

  useEffect(() => () => interaction.current.reset(), [])

  function retry() {
    setFailed(false)
    setMapKey((key) => key + 1)
  }

  function zoomBy(step: number) {
    const next = Math.min(maximumInteractiveZoom, Math.max(minimumInteractiveZoom, currentZoom.current + step))
    if (next === currentZoom.current) return
    currentZoom.current = next
    void cameraRef.current?.zoomTo(next, { duration: 220 })
  }

  return (
    <View style={[styles.frame, expanded && styles.expandedFrame]} accessibilityLabel="Nearby Companion map">
      {!failed ? (
        <View
          style={styles.mapSurface}
          onTouchStart={() => interaction.current.start()}
          onTouchEnd={() => interaction.current.end()}
          onTouchCancel={() => interaction.current.end()}>
          <Map
            key={mapKey}
            mapStyle={productMapStyleUrl}
            style={styles.map}
            attribution
            logo={false}
            dragPan
            touchZoom
            doubleTapZoom
            onDidFailLoadingMap={() => setFailed(true)}
            onDidFinishLoadingMap={() => setFailed(false)}
            onRegionDidChange={(event) => { currentZoom.current = event.nativeEvent.zoom }}
            onPress={pinMode ? (event) => {
              const origin = normalizeMapCoordinates(event.nativeEvent.lngLat)
              if (origin) onPickLocation?.(origin)
            } : undefined}
          >
            <Camera ref={cameraRef} center={mapCenter} zoom={mapZoom} duration={350} easing="ease" />
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
              <Marker
                key={point.id}
                id={`companion-${point.id}`}
                lngLat={[point.longitude, point.latitude]}
                onPress={() => onSelectPoint?.(point.id)}>
                <View
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${point.name}'s details`}
                  style={[styles.personMarker, { backgroundColor: theme.colors.socialControl, borderColor: theme.colors.surfaceRaised }]}>
                  {point.imageUrl
                    ? <Image accessibilityLabel={`Portrait of ${point.name}`} source={{ uri: point.imageUrl }} style={styles.personPhoto} />
                    : <AppText variant="label" color={theme.colors.accentText}>{initials(point.name)}</AppText>}
                </View>
              </Marker>
            ))}
          </Map>
          <View style={styles.zoomControls} pointerEvents="box-none">
            <ZoomButton label="Zoom in" icon="add-outline" onPress={() => zoomBy(zoomStep)} />
            <ZoomButton label="Zoom out" icon="remove-outline" onPress={() => zoomBy(-zoomStep)} />
          </View>
        </View>
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

function ZoomButton({ label, icon, onPress }: { label: string; icon: 'add-outline' | 'remove-outline'; onPress: () => void }) {
  const theme = useAppTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.zoomButton,
        { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border },
        pressed && styles.zoomButtonPressed,
      ]}>
      <AppIcon name={icon} size={20} color={theme.colors.text} />
    </Pressable>
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
  mapSurface: { flex: 1 },
  map: { flex: 1 },
  zoomControls: { position: 'absolute', top: 12, right: 12, gap: 8 },
  zoomButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  zoomButtonPressed: { opacity: 0.72 },
  failure: { flex: 1, padding: 18, alignItems: 'flex-start', justifyContent: 'center', gap: 8 },
  originMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#1093ED', alignItems: 'center', justifyContent: 'center' },
  originDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1093ED' },
  personMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  personPhoto: { width: 40, height: 40 },
})
