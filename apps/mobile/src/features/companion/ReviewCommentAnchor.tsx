import { useEffect, useRef, type RefObject, type ReactNode } from 'react'
import { StyleSheet, View, type ScrollView } from 'react-native'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function ReviewCommentAnchor({ focused, scrollRef, children }: { focused: boolean; scrollRef: RefObject<ScrollView | null>; children: ReactNode }) {
  const theme = useAppTheme()
  const targetRef = useRef<View>(null)
  const focusComment = () => {
    const content = scrollRef.current?.getInnerViewNode()
    if (focused && content) targetRef.current?.measureLayout(content, (_x, y) => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true })
    }, () => undefined)
  }
  useEffect(() => {
    if (!focused) return
    const frame = requestAnimationFrame(focusComment)
    return () => cancelAnimationFrame(frame)
  }, [focused, scrollRef])
  return <View ref={targetRef} collapsable={false} onLayout={focusComment} accessibilityRole={focused ? 'summary' : undefined} style={[styles.comment, focused && { borderColor: theme.colors.socialText, borderWidth: 1, borderRadius: 8, padding: 8, backgroundColor: theme.colors.socialSoft }]}>{children}</View>
}


const styles = StyleSheet.create({
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: density.cardGap },
})
