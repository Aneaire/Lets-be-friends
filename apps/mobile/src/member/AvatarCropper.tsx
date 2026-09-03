import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import {
  avatarCropPositionFromDrag,
  avatarPreviewGeometry,
  AVATAR_ZOOM_MAX,
  AVATAR_ZOOM_MIN,
  defaultAvatarCrop,
  stepAvatarZoom,
  type AvatarCrop,
} from './avatarCrop'

export function AvatarCropper({
  uri,
  crop,
  onChange,
  style,
}: {
  uri: string
  crop: AvatarCrop
  onChange: (crop: AvatarCrop) => void
  style?: ViewStyle
}) {
  const theme = useAppTheme()
  const { width } = useWindowDimensions()
  const previewSize = Math.max(200, Math.min(260, width - 72))
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [imageReady, setImageReady] = useState(false)
  const [frameWidth, setFrameWidth] = useState(previewSize)

  useEffect(() => {
    let active = true
    setImageSize({ width: 0, height: 0 })
    setImageReady(false)
    Image.getSize(
      uri,
      (imageWidth, imageHeight) => {
        if (!active) return
        setImageSize({ width: imageWidth, height: imageHeight })
        setImageReady(true)
      },
      () => {
        if (!active) return
        setImageReady(false)
      },
    )
    return () => { active = false }
  }, [uri])

  const geometry = avatarPreviewGeometry(imageSize.width, imageSize.height, crop, frameWidth)
  const geometryRef = useRef(geometry)
  geometryRef.current = geometry
  const cropRef = useRef(crop)
  cropRef.current = crop
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const dragStartCrop = useRef<AvatarCrop>(crop)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { dragStartCrop.current = cropRef.current },
      onPanResponderMove: (_event, gesture) => {
        const geometryNow = geometryRef.current
        const next = avatarCropPositionFromDrag(dragStartCrop.current, geometryNow, gesture.dx, gesture.dy)
        if (next.x !== cropRef.current.x || next.y !== cropRef.current.y) onChangeRef.current(next)
      },
    }),
  ).current

  const imageWidth = geometry.width > 0 ? geometry.width : frameWidth
  const imageHeight = geometry.height > 0 ? geometry.height : frameWidth

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, style]}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <AppText variant="bodyStrong">Choose your profile view</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Drag the photo to position it inside the circle.</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset avatar position"
          onPress={() => onChangeRef.current(defaultAvatarCrop)}
          style={({ pressed }) => [styles.reset, pressed && styles.pressed]}>
          <AppIcon name="refresh-outline" size={16} color={theme.colors.textMuted} />
          <AppText variant="caption" color={theme.colors.textMuted}>Reset</AppText>
        </Pressable>
      </View>

      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Avatar preview. Drag to position the photo."
        accessibilityHint="Drag the photo inside the circle. Use the zoom controls to adjust the crop."
        accessibilityValue={{ min: AVATAR_ZOOM_MIN, max: AVATAR_ZOOM_MAX, now: crop.zoom }}
        {...panResponder.panHandlers}
        style={[styles.frame, { width: frameWidth, height: frameWidth, backgroundColor: theme.colors.surfaceRaised }]}
        onLayout={(event: LayoutChangeEvent) => setFrameWidth(event.nativeEvent.layout.width)}>
        <View style={[styles.imageLayer, { width: frameWidth, height: frameWidth }]} pointerEvents="none">
          <Image
            source={{ uri }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            onLoad={() => setImageReady(true)}
            style={{
              width: imageWidth,
              height: imageHeight,
              left: (frameWidth - imageWidth) / 2 + geometry.offsetX,
              top: (frameWidth - imageHeight) / 2 + geometry.offsetY,
              backgroundColor: theme.colors.surface,
            }}
          />
          {!imageReady ? (
            <View style={[styles.loading, { backgroundColor: theme.colors.border }]}>
              <ActivityIndicator color={theme.colors.textMuted} />
            </View>
          ) : null}
        </View>
        <View pointerEvents="none" style={[styles.ring, { borderColor: theme.colors.accentText }]} />
      </View>

      <View style={styles.zoomRow}>
        <AppText variant="caption" color={theme.colors.textMuted}>Zoom</AppText>
        <View style={styles.zoomControls}>
          <ZoomStepButton
            label="Decrease avatar zoom"
            icon="remove-outline"
            disabled={crop.zoom <= AVATAR_ZOOM_MIN}
            onPress={() => onChange({ ...crop, zoom: stepAvatarZoom(crop.zoom, -1) })}
          />
          <AppText variant="caption" color={theme.colors.textMuted} style={styles.zoomValue}>{crop.zoom.toFixed(1)}×</AppText>
          <ZoomStepButton
            label="Increase avatar zoom"
            icon="add-outline"
            disabled={crop.zoom >= AVATAR_ZOOM_MAX}
            onPress={() => onChange({ ...crop, zoom: stepAvatarZoom(crop.zoom, 1) })}
          />
        </View>
      </View>

      <View style={styles.hint}>
        <AppText variant="caption" color={theme.colors.textMuted}>Zoom and position are applied to the saved profile photo.</AppText>
      </View>
    </View>
  )
}

function ZoomStepButton({ label, icon, disabled, onPress }: { label: string; icon: 'add-outline' | 'remove-outline'; disabled: boolean; onPress: () => void }) {
  const theme = useAppTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={2}
      style={({ pressed }) => [
        styles.zoomButton,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <AppIcon name={icon} size={18} color={theme.colors.selfText} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { gap: density.cardGap, borderWidth: 1, borderRadius: density.controlRadius, padding: density.compactCardPadding },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: density.cardGap },
  headingCopy: { flex: 1, gap: 1 },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingHorizontal: 2 },
  frame: { alignSelf: 'center', overflow: 'hidden', borderRadius: 999, borderWidth: 1 },
  imageLayer: { position: 'absolute', top: 0, left: 0 },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 0 },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: density.cardGap },
  zoomControls: { flexDirection: 'row', alignItems: 'center', gap: density.compactCardPadding },
  zoomValue: { minWidth: 36, textAlign: 'center', fontVariant: ['tabular-nums'] },
  zoomButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { alignItems: 'center', paddingTop: density.textStackGap },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.68 },
})
