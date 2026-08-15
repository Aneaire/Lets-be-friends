import type { PropsWithChildren, ReactNode } from 'react'
import { ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewProps, type ViewStyle } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppTheme } from '@/theme/ThemeProvider'

export function Screen({ children, scroll = true, contentStyle, footer, ...props }: PropsWithChildren<ScrollViewProps & { scroll?: boolean; contentStyle?: ViewStyle; footer?: ReactNode }>) {
  const theme = useAppTheme()
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const responsiveStyle = width >= 768 ? styles.tabletContent : undefined

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          {...props}
          contentContainerStyle={[styles.content, responsiveStyle, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, responsiveStyle, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom + 8), backgroundColor: theme.colors.surfaceRaised, borderTopColor: theme.colors.border }]}>{footer}</View> : null}
    </SafeAreaView>
  )
}

export function Section({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.section, style]}>{children}</View>
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  tabletContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 28 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10 },
  section: { marginTop: 32 },
})
