import { useEffect, useRef, useState, type RefObject } from 'react'
import { ActivityIndicator, Animated, BackHandler, Image, PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { useReducedMotion } from '@/utils/accessibility'
import { clampImageOffset, clampImageScale, containedImageSize, type ImageSize } from './imageViewerGeometry'

export type PostViewerImage = { url: string; index: number; total: number }

function touchDistance(touches: readonly { pageX: number; pageY: number }[]) {
  if (touches.length < 2) return 0
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY)
}

export function PostImageViewer({ image, blurTarget: _blurTarget, onClose }: {
  image: PostViewerImage | null
  blurTarget: RefObject<View | null>
  onClose: () => void
}) {
  const theme = useAppTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current
  const [viewport, setViewport] = useState<ImageSize>({ width: 0, height: 0 })
  const [naturalSize, setNaturalSize] = useState<ImageSize>({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [imageError, setImageError] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const zoomRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const gestureRef = useRef({ distance: 0, scale: 1, x: 0, y: 0, pinch: false })
  const translateX = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  const geometry = useRef({ image: naturalSize, viewport })
  const contained = containedImageSize(naturalSize, viewport)
  geometry.current = { image: contained, viewport }

  function setOffset(x: number, y: number, nextScale: number) {
    const { image: size, viewport: frame } = geometry.current
    const next = {
      x: clampImageOffset(x, size.width, frame.width, nextScale),
      y: clampImageOffset(y, size.height, frame.height, nextScale),
    }
    offsetRef.current = next
    translateX.setValue(next.x)
    translateY.setValue(next.y)
  }

  function setImageZoom(value: number) {
    const next = clampImageScale(value)
    zoomRef.current = next
    scale.setValue(next)
    setZoom(next)
    setOffset(offsetRef.current.x, offsetRef.current.y, next)
  }

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      gestureRef.current = { distance: touchDistance(event.nativeEvent.touches), scale: zoomRef.current, x: offsetRef.current.x, y: offsetRef.current.y, pinch: event.nativeEvent.touches.length >= 2 }
    },
    onPanResponderMove: (event, gesture) => {
      const distance = touchDistance(event.nativeEvent.touches)
      if (distance > 0) {
        if (!gestureRef.current.pinch || gestureRef.current.distance === 0) {
          gestureRef.current.distance = distance
          gestureRef.current.scale = zoomRef.current
          gestureRef.current.pinch = true
        }
        setImageZoom(gestureRef.current.scale * distance / gestureRef.current.distance)
      } else if (zoomRef.current > 1) {
        if (gestureRef.current.pinch) {
          gestureRef.current.pinch = false
          gestureRef.current.x = offsetRef.current.x - gesture.dx
          gestureRef.current.y = offsetRef.current.y - gesture.dy
        }
        setOffset(gestureRef.current.x + gesture.dx, gestureRef.current.y + gesture.dy, zoomRef.current)
      }
    },
    onPanResponderTerminationRequest: () => false,
  })).current

  useEffect(() => {
    if (!image) return
    let mounted = true
    setNaturalSize({ width: 0, height: 0 })
    setImageError(false)
    setImageZoom(1)
    Image.getSize(image.url, (width, height) => { if (mounted) setNaturalSize({ width, height }) }, () => { if (mounted) setImageError(true) })
    opacity.setValue(reduceMotion ? 1 : 0)
    if (!reduceMotion) Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start()
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onCloseRef.current(); return true })
    return () => { mounted = false; subscription.remove() }
  }, [image?.url, opacity, reduceMotion])

  if (!image) return null
  const imageLabel = `Full-screen post image ${image.index + 1} of ${image.total}`
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setViewport({ width, height })
  }

  return <Animated.View accessibilityViewIsModal onAccessibilityEscape={onClose} style={[styles.viewer, { opacity, backgroundColor: theme.colors.background }]}>
    <Pressable accessible={false} importantForAccessibility="no" onPress={onClose} style={StyleSheet.absoluteFill} />
    <View pointerEvents="box-none" style={[styles.toolbar, { paddingTop: Math.max(12, insets.top + 8), paddingLeft: Math.max(12, insets.left + 8), paddingRight: Math.max(12, insets.right + 8) }]}>
      <AppText variant="bodyStrong">{image.index + 1} / {image.total}</AppText>
      <IconButton label="Close full-screen image" icon="close" onPress={onClose} style={{ backgroundColor: theme.colors.surfaceRaised }} />
    </View>
    <View style={styles.stage} onLayout={onLayout}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close image viewer" onPress={onClose} style={StyleSheet.absoluteFill} />
      {imageError ? <AppText color={theme.colors.textMuted}>This image could not be loaded.</AppText> : null}
      {!imageError && (contained.width <= 0 || contained.height <= 0) ? <ActivityIndicator accessibilityLabel="Loading image" color={theme.colors.textMuted} /> : null}
      {!imageError && contained.width > 0 && contained.height > 0 ? <Animated.View {...responder.panHandlers} style={{ width: contained.width, height: contained.height, transform: [{ translateX }, { translateY }, { scale }] }}>
        <Image source={{ uri: image.url }} resizeMode="contain" onError={() => setImageError(true)} accessibilityRole="image" accessibilityLabel={imageLabel} style={styles.image} />
      </Animated.View> : null}
    </View>
    <View pointerEvents="box-none" style={[styles.controls, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
      <IconButton label="Zoom out" icon="remove" disabled={zoom <= 1} onPress={() => setImageZoom(zoomRef.current - 0.5)} style={{ backgroundColor: theme.colors.surfaceRaised }} />
      <AppText variant="caption" color={theme.colors.textMuted}>{Math.round(zoom * 100)}%</AppText>
      <IconButton label="Zoom in" icon="add" disabled={zoom >= 4} onPress={() => setImageZoom(zoomRef.current + 0.5)} style={{ backgroundColor: theme.colors.surfaceRaised }} />
    </View>
  </Animated.View>
}

const styles = StyleSheet.create({
  viewer: { position: 'absolute', inset: 0, zIndex: 20, elevation: 20 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingTop: 8 },
})
