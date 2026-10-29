import { useMemo, useRef } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { useAppTheme } from '@/theme/ThemeProvider'

import { isMessageSwipeGesture, messageSwipeAction, MESSAGE_SWIPE_THRESHOLD } from './messageSwipe'

const MAX_LEFT_OFFSET = 88
const MAX_RIGHT_OFFSET = 72

export function SwipeableMessageRow({ children, onReply, onOpenActions }: {
  children: React.ReactNode
  onReply?: () => void
  onOpenActions?: () => void
}) {
  const theme = useAppTheme()
  const translateX = useRef(new Animated.Value(0)).current
  const replyRef = useRef(onReply)
  const actionsRef = useRef(onOpenActions)
  replyRef.current = onReply
  actionsRef.current = onOpenActions

  const reset = useMemo(() => () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 18,
    }).start()
  }, [translateX])

  const panResponder = useMemo(() => {
    const shouldClaim = (dx: number, dy: number) => (
      isMessageSwipeGesture(dx, dy) && (
        (dx > 0 && Boolean(replyRef.current)) || (dx < 0 && Boolean(actionsRef.current))
      )
    )
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) => shouldClaim(gesture.dx, gesture.dy),
      onMoveShouldSetPanResponderCapture: (_event, gesture) => shouldClaim(gesture.dx, gesture.dy),
      onPanResponderMove: (_event, gesture) => {
        if (gesture.dx > 0) {
          translateX.setValue(Math.min(gesture.dx * 0.7, MAX_RIGHT_OFFSET))
          return
        }
        translateX.setValue(actionsRef.current ? Math.max(gesture.dx, -MAX_LEFT_OFFSET) : 0)
      },
      onPanResponderRelease: (_event, gesture) => {
        const action = messageSwipeAction(gesture.dx)
        if (action === 'reply' && replyRef.current) {
          replyRef.current()
        } else if (action === 'actions' && actionsRef.current) {
          actionsRef.current()
        }
        reset()
      },
      onPanResponderTerminate: reset,
      onPanResponderTerminationRequest: () => false,
    })
  }, [reset, translateX])

  const replyOpacity = translateX.interpolate({
    inputRange: [0, MESSAGE_SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })
  const actionsOpacity = translateX.interpolate({
    inputRange: [-MESSAGE_SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  return (
    <View style={styles.wrap}>
      <View style={styles.hints}>
        <Animated.View style={[styles.hint, { opacity: replyOpacity }]}>
          <AppIcon name="arrow-undo-outline" size={20} color={theme.colors.socialText} />
        </Animated.View>
        {onOpenActions ? (
          <Animated.View style={[styles.hint, styles.hintRight, { opacity: actionsOpacity }]}>
            <AppIcon name="ellipsis-horizontal" size={20} color={theme.colors.textMuted} />
          </Animated.View>
        ) : null}
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable accessible={false} delayLongPress={350} onLongPress={onOpenActions}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  hints: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  hint: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  hintRight: { marginLeft: 'auto' },
})
