import { StyleSheet, View } from 'react-native'
import { AppText } from './Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'self' | 'social' | 'success' | 'warning' | 'danger' }) {
  const theme = useAppTheme()
  const color = tone === 'self' ? theme.colors.selfText : tone === 'social' ? theme.colors.socialText : tone === 'danger' ? theme.colors.danger : tone === 'success' || tone === 'warning' ? theme.colors.text : theme.colors.textMuted
  const backgroundColor = tone === 'self' ? theme.colors.selfSoft : tone === 'social' ? theme.colors.socialSoft : theme.colors.surface
  const borderStyle = tone === 'warning' ? 'dashed' as const : 'solid' as const
  return <View style={[styles.badge, { backgroundColor, borderColor: theme.colors.border, borderStyle }]}><AppText accessibilityLabel={`Status: ${label}`} variant="caption" color={color} style={styles.label}>{label}</AppText></View>
}

const styles = StyleSheet.create({ badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 }, label: { fontWeight: '700', lineHeight: 16 } })
