import type { PropsWithChildren, ReactNode } from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardAvoidingViewProps,
  type PlatformOSType,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function keyboardAvoidingBehavior(platform: PlatformOSType): KeyboardAvoidingViewProps['behavior'] {
  return platform === 'ios' ? 'padding' : undefined
}

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
  content: { paddingHorizontal: density.screenGutter, paddingBottom: density.screenBottom },
  tabletContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: density.tabletGutter },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: density.screenGutter, paddingTop: 8 },
  section: { marginTop: density.sectionGap },
})
