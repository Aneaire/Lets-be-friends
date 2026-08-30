import type { CommentThreadPosition } from '@lets-be-friends/shared'
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
  avatarAction,
  authorAction,
  children,
  action,
  replyContext,
  threadPosition = 'standalone',
  isLastReply = false,
}: {
  author: string
  imageUrl?: string | null
  timestamp: string
  avatarAction?: ReactNode
  authorAction?: ReactNode
  children: ReactNode
  action?: ReactNode
  replyContext?: ReactNode
  threadPosition?: CommentThreadPosition
  isLastReply?: boolean
}) {
  const theme = useAppTheme()
  const connected = threadPosition !== 'standalone'
  const showLineBelow = threadPosition === 'root' || (threadPosition === 'reply' && !isLastReply)
  const showDivider = threadPosition === 'standalone' || isLastReply

  return (
    <View
      style={[styles.comment, threadPosition === 'reply' && styles.reply, { borderBottomColor: showDivider ? theme.colors.border : 'transparent' }]}
    >
      <View style={styles.avatarSlot}>
        {threadPosition === 'reply' ? <View style={[styles.replyElbow, { borderColor: theme.colors.border }]} /> : null}
        {showLineBelow ? (
          <View style={[threadPosition === 'root' ? styles.rootLineBelow : styles.replyLineBelow, { backgroundColor: theme.colors.border }]} />
        ) : null}
        <View style={styles.avatarForeground}>
          {avatarAction ?? <Avatar uri={imageUrl ?? undefined} name={author} size={36} />}
        </View>
      </View>
      <View style={styles.copy}>
        <View style={styles.header}>
          {authorAction ?? <AppText variant="bodyStrong" numberOfLines={1}>{author}</AppText>}
          <AppText variant="caption" color={theme.colors.textMuted}>·</AppText>
          <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{timestamp}</AppText>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
        {connected && replyContext ? <View style={styles.replyContext}>{replyContext}</View> : null}
        <View style={styles.body}>{children}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: density.cardGap,
    paddingTop: 7,
    paddingBottom: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reply: {
    marginLeft: 28,
  },
  avatarSlot: {
    position: 'relative',
    width: 36,
    alignSelf: 'stretch',
  },
  avatarForeground: {
    zIndex: 1,
  },
  replyElbow: {
    position: 'absolute',
    top: -7,
    left: -10,
    width: 28,
    height: 25,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 10,
  },
  rootLineBelow: {
    position: 'absolute',
    top: 18,
    bottom: -7,
    left: 17.5,
    width: StyleSheet.hairlineWidth,
  },
  replyLineBelow: {
    position: 'absolute',
    top: 18,
    bottom: -7,
    left: -10,
    width: StyleSheet.hairlineWidth,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  body: {
    marginTop: 1,
  },
  replyContext: {
    marginTop: 1,
    marginBottom: 1,
  },
  action: {
    marginLeft: 'auto',
    marginVertical: -11,
  },
})
