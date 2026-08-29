import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { Brand } from '@/design-system/atoms/Brand'
import { useAppTheme } from '@/theme/ThemeProvider'

export function StartupLoadingScreen() {
  const theme = useAppTheme()

  return (
    <View
      accessibilityLabel="Finishing sign in"
      accessibilityRole="progressbar"
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <Brand />
      <ActivityIndicator color={theme.colors.textMuted} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
})
