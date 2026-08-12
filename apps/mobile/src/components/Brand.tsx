import { StyleSheet, View } from 'react-native'

import { useAppTheme } from '@/theme/ThemeProvider'
import { AppText } from './Typography'

export function Brand({ compact = false }: { compact?: boolean }) {
  const theme = useAppTheme()

  return (
    <View accessibilityLabel="Let's Be Friends" style={styles.row}>
      <View style={styles.mark} accessibilityElementsHidden>
        <View style={[styles.thread, { backgroundColor: theme.colors.social }]} />
        <View style={[styles.dot, styles.topDot, { backgroundColor: theme.colors.self }]} />
        <View style={[styles.dot, styles.bottomDot, { backgroundColor: theme.colors.social }]} />
      </View>
      <AppText variant={compact ? 'bodyStrong' : 'heading'}>Let's Be Friends</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 22, height: 34, position: 'relative' },
  thread: { width: 2, height: 22, position: 'absolute', left: 10, top: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', left: 6 },
  topDot: { top: 0 },
  bottomDot: { bottom: 0 },
})
