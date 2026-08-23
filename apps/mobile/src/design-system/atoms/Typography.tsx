import type { PropsWithChildren } from 'react'
import { StyleSheet, Text, type TextProps } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import type { typography } from '@/theme/tokens'

type TextVariant = keyof typeof typography

export function AppText({ variant = 'body', color, style, children, ...props }: PropsWithChildren<TextProps & { variant?: TextVariant; color?: string }>) {
  const theme = useAppTheme()

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={2}
      {...props}
      style={[theme.typography[variant], { color: color ?? theme.colors.text }, styles.base, style]}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  base: { flexShrink: 1 },
})
