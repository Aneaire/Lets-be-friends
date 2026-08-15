import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'

import { AppText } from './Typography'

export function AppHeader({ title, subtitle, back = false, onBack, action }: {
  title: string
  subtitle?: string
  back?: boolean
  onBack?: () => void
  action?: ReactNode
}) {
  const theme = useAppTheme()

  return (
    <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack ?? (() => router.back())}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <AppText variant="heading">‹</AppText>
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        <AppText variant="heading" numberOfLines={1}>{title}</AppText>
        {subtitle ? <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : back ? <View style={styles.spacer} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 1 },
  action: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  spacer: { width: 44 },
  pressed: { opacity: 0.62 },
})
