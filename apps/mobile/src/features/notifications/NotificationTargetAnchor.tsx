import { NOTIFICATION_HIGHLIGHT_MS } from '@lets-be-friends/shared'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { View, type ScrollView, type StyleProp, type ViewStyle } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'

/**
 * Scrolls a notification target into view and highlights it briefly. The
 * highlight is deliberately temporary so the screen does not look permanently
 * focused after the member arrives.
 */
export function NotificationTargetAnchor({
  focused,
  scrollRef,
  style,
  children,
}: {
  focused: boolean
  scrollRef?: RefObject<ScrollView | null>
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const theme = useAppTheme()
  const targetRef = useRef<View>(null)
  const scrolledRef = useRef(false)
  const [highlighted, setHighlighted] = useState(false)

  const scrollToTarget = () => {
    if (!focused) return
    const content = scrollRef?.current?.getInnerViewNode()
    if (!content) return
    targetRef.current?.measureLayout(content, (_x, y) => {
      scrollRef?.current?.scrollTo({ y: Math.max(0, y - 24), animated: true })
    }, () => undefined)
  }

  useEffect(() => {
    if (!focused) {
      scrolledRef.current = false
      setHighlighted(false)
      return
    }
    setHighlighted(true)
    const timer = setTimeout(() => setHighlighted(false), NOTIFICATION_HIGHLIGHT_MS)
    const frame = requestAnimationFrame(() => {
      if (scrolledRef.current) return
      scrolledRef.current = true
      scrollToTarget()
    })
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [focused, scrollRef])

  return (
    <View
      ref={targetRef}
      collapsable={false}
      accessibilityRole={focused ? 'summary' : undefined}
      onLayout={() => {
        if (scrolledRef.current) return
        scrolledRef.current = true
        scrollToTarget()
      }}
      style={[
        style,
        highlighted && {
          backgroundColor: theme.colors.socialSoft,
          borderColor: theme.colors.socialText,
          borderWidth: 1,
          borderRadius: 8,
          padding: 4,
        },
      ]}
    >
      {children}
    </View>
  )
}
