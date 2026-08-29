import { BlurView } from 'expo-blur'
import { useEffect, useRef, type RefObject } from 'react'
import {
  Animated,
  BackHandler,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconButton } from '@/design-system/atoms/IconButton'
import { useAppTheme } from '@/theme/ThemeProvider'
import { useReducedMotion } from '@/utils/accessibility'

export type PostViewerImage = {
  url: string
  index: number
  total: number
}

export function PostImageViewer({ image, blurTarget, onClose }: {
  image: PostViewerImage | null
  blurTarget: RefObject<View | null>
  onClose: () => void
}) {
  const theme = useAppTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current

  useEffect(() => {
    if (!image) return

    opacity.setValue(reduceMotion ? 1 : 0)
    if (!reduceMotion) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start()
    }

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })

    return () => backSubscription.remove()
  }, [image, onClose, opacity, reduceMotion])

  if (!image) return null

  const imageLabel = `Full-screen post image ${image.index + 1} of ${image.total}`

  return (
    <Animated.View
      accessible
      accessibilityLabel={imageLabel}
      accessibilityViewIsModal
      onAccessibilityEscape={onClose}
      style={[styles.viewer, { opacity }]}
    >
      <BlurView
        blurTarget={blurTarget}
        blurMethod="dimezisBlurViewSdk31Plus"
        blurReductionFactor={2}
        intensity={18}
        tint={theme.scheme === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: theme.colors.scrim }]} />
      <Pressable
        accessible={false}
        importantForAccessibility="no"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="box-none"
        style={[
          styles.content,
          {
            paddingTop: Math.max(12, insets.top + 8),
            paddingBottom: Math.max(12, insets.bottom + 8),
            paddingLeft: Math.max(12, insets.left + 8),
            paddingRight: Math.max(12, insets.right + 8),
          },
        ]}
      >
        <View pointerEvents="box-none" style={styles.toolbar}>
          <IconButton
            label="Close full-screen image"
            icon="close"
            onPress={onClose}
            style={{ backgroundColor: theme.colors.surfaceRaised }}
          />
        </View>
        <Image
          source={{ uri: image.url }}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel={imageLabel}
          style={styles.image}
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  viewer: { position: 'absolute', inset: 0, zIndex: 20, elevation: 20, backgroundColor: 'transparent' },
  scrim: { opacity: 0.3 },
  content: { flex: 1 },
  toolbar: { zIndex: 1, alignItems: 'flex-end' },
  image: { flex: 1, width: '100%', backgroundColor: 'transparent' },
})
