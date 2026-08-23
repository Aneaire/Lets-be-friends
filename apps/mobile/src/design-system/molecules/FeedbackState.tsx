import { StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { AppText } from '../atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function InlineNotice({ title, children, tone = 'neutral' }: { title?: string; children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const theme = useAppTheme()
  const accent = tone === 'danger' ? theme.colors.danger : tone === 'success' ? theme.colors.success : tone === 'warning' ? theme.colors.warning : theme.colors.borderStrong
  return <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={[styles.notice, { borderColor: theme.colors.border, borderLeftColor: accent, backgroundColor: theme.colors.surfaceRaised }]}>{title ? <AppText variant="bodyStrong">{title}</AppText> : null}<AppText variant="caption" color={theme.colors.textMuted}>{children}</AppText></View>
}
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) { const theme = useAppTheme(); return <View style={styles.empty}>{icon}<AppText variant="bodyStrong">{title}</AppText>{description ? <AppText variant="caption" color={theme.colors.textMuted} style={styles.center}>{description}</AppText> : null}{action}</View> }
const styles = StyleSheet.create({ notice: { borderWidth: 1, borderLeftWidth: 3, borderRadius: 10, padding: 10, gap: density.textPairGap }, empty: { alignItems: 'center', padding: density.cardPadding, gap: density.textStackGap }, center: { textAlign: 'center', maxWidth: 300 } })
