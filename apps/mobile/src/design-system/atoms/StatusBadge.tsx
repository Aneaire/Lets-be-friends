import { StyleSheet, View } from 'react-native'
import { AppText } from './Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'self' | 'social' | 'success' | 'warning' | 'danger' }) {
  const theme = useAppTheme()
  const color = tone === 'self' ? theme.colors.selfText : tone === 'social' ? theme.colors.socialText : tone === 'danger' ? theme.colors.danger : tone === 'success' ? theme.colors.success : tone === 'warning' ? theme.colors.warning : theme.colors.textMuted
  const backgroundColor = tone === 'self' ? theme.colors.selfSoft : tone === 'social' ? theme.colors.socialSoft : tone === 'success' ? theme.colors.successSoft : tone === 'warning' ? theme.colors.warningSoft : theme.colors.surface
  return <View style={[styles.badge, { backgroundColor, borderColor: theme.colors.border }]}><AppText accessibilityLabel={`Status: ${label}`} variant="caption" color={color} style={styles.label}>{label}</AppText></View>
}

const styles = StyleSheet.create({ badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 }, label: { fontWeight: '700', lineHeight: 16 } })
