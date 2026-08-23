import { StyleSheet, View, type ViewProps } from 'react-native'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function Surface({ compact = false, sunk = false, style, ...props }: ViewProps & { compact?: boolean; sunk?: boolean }) {
  const theme = useAppTheme()
  return <View {...props} style={[styles.base, compact && styles.compact, { borderColor: theme.colors.border, backgroundColor: sunk ? theme.colors.surface : theme.colors.surfaceRaised }, style]} />
}
const styles = StyleSheet.create({ base: { borderWidth: 1, borderRadius: 14, padding: density.cardPadding }, compact: { padding: density.compactCardPadding } })
