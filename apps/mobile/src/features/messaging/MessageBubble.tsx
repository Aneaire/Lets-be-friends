import { StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function MessageBubble({ direction, body, timestamp, authorName = 'Member', pending = false, attachments, footer }: { direction: 'incoming' | 'outgoing'; body?: string; timestamp: string; authorName?: string; pending?: boolean; attachments?: ReactNode; footer?: ReactNode }) {
  const theme = useAppTheme()
  const author = direction === 'outgoing' ? 'You' : authorName
  return <View style={[styles.wrap, direction === 'outgoing' ? styles.outgoing : styles.incoming, pending && styles.pending]}><View style={styles.column}><View style={[styles.bubble, { backgroundColor: direction === 'outgoing' ? theme.colors.surfaceRaised : theme.colors.socialSoft, borderColor: theme.colors.border }]}>{!body && attachments ? <AppText variant="caption" color={theme.colors.textMuted} accessibilityLabel={`${author} sent an attachment`}>Attachment from {author}</AppText> : null}{attachments}{body ? <AppText accessibilityLabel={`${author} said: ${body}`}>{body}</AppText> : null}<AppText accessibilityLabel={`Sent ${timestamp}`} variant="caption" color={theme.colors.textMuted} style={styles.time}>{timestamp}</AppText></View>{footer}</View></View>
}
const styles = StyleSheet.create({ wrap: { flexDirection: 'row' }, outgoing: { justifyContent: 'flex-end', paddingLeft: 48 }, incoming: { justifyContent: 'flex-start', paddingRight: 48 }, column: { maxWidth: '100%', gap: density.textStackGap }, bubble: { maxWidth: '100%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 8, gap: density.textStackGap }, time: { alignSelf: 'flex-end' }, pending: { opacity: 0.64 } })
