import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { Avatar } from '@/design-system/atoms/Avatar'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function CommentBubble({
  author,
  imageUrl,
  timestamp,
  authorAction,
  children,
  action,
}: {
  author: string
  imageUrl?: string | null
  timestamp: string
  authorAction?: ReactNode
  children: ReactNode
  action?: ReactNode
}) {
  const theme = useAppTheme()

  return (
    <View style={[styles.comment, { borderBottomColor: theme.colors.border }]}>
      <Avatar uri={imageUrl ?? undefined} name={author} size={28} />
      <View style={styles.copy}>
        <View style={styles.header}>
          {authorAction ?? <AppText variant="bodyStrong" numberOfLines={1}>{author}</AppText>}
          <AppText variant="caption" color={theme.colors.textMuted}>·</AppText>
          <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{timestamp}</AppText>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
        <View>{children}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: density.cardGap,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: density.textPairGap,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  action: {
    marginLeft: 'auto',
    marginVertical: -11,
  },
})
