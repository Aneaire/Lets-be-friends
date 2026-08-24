import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

type MessageBubbleProps = {
  direction: 'incoming' | 'outgoing'
  body?: string
  timestamp: string
  authorName?: string
  pending?: boolean
  attachments?: ReactNode
  footer?: ReactNode
}

export function MessageBubble({
  direction,
  body,
  timestamp,
  authorName = 'Member',
  pending = false,
  attachments,
  footer,
}: MessageBubbleProps) {
  const theme = useAppTheme()
  const author = direction === 'outgoing' ? 'You' : authorName
  const surfaceColor = direction === 'outgoing'
    ? theme.colors.surfaceRaised
    : theme.colors.surface

  return (
    <View style={[styles.wrap, direction === 'outgoing' ? styles.outgoing : styles.incoming]}>
      <View style={styles.column}>
        <View
          style={[
            styles.bubble,
            pending && styles.pending,
            { backgroundColor: surfaceColor, borderColor: theme.colors.border },
          ]}>
          {!body && attachments ? (
            <AppText
              variant="caption"
              color={theme.colors.textMuted}
              accessibilityLabel={`${author} sent an attachment`}>
              Attachment from {author}
            </AppText>
          ) : null}
          {attachments}
          {body ? <AppText accessibilityLabel={`${author} said: ${body}`}>{body}</AppText> : null}
          <AppText
            accessibilityLabel={pending ? `Sending, ${timestamp}` : `Sent ${timestamp}`}
            variant="caption"
            color={theme.colors.textMuted}
            style={styles.time}>
            {timestamp}{pending ? ' · Sending' : ''}
          </AppText>
        </View>
        {footer}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: '100%', minWidth: 0, flexDirection: 'row' },
  outgoing: { justifyContent: 'flex-end', paddingLeft: 48 },
  incoming: { justifyContent: 'flex-start', paddingRight: 48 },
  column: { maxWidth: '100%', minWidth: 0, flexShrink: 1, gap: density.textStackGap },
  bubble: {
    maxWidth: '100%',
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: density.textStackGap,
  },
  time: { alignSelf: 'flex-end' },
  pending: { borderStyle: 'dashed' },
})
