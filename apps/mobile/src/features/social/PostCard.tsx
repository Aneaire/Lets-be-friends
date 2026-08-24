import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { Avatar } from '@/design-system/atoms/Avatar'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function PostCard({
  author,
  imageUrl,
  timestamp,
  avatarAction,
  authorAction,
  meta,
  headerAction,
  children,
  footer,
}: {
  author: string
  imageUrl?: string | null
  timestamp: string
  avatarAction?: ReactNode
  authorAction?: ReactNode
  meta?: ReactNode
  headerAction?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  const theme = useAppTheme()

  return (
    <View
      style={[
        styles.post,
        {
          borderBottomColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceRaised,
        },
      ]}
    >
      <View style={styles.header}>
        {avatarAction ?? <Avatar uri={imageUrl ?? undefined} name={author} size={38} />}
        <View style={styles.identityLine}>
          {authorAction ?? <AppText variant="bodyStrong" numberOfLines={1}>{author}</AppText>}
          <AppText variant="caption" color={theme.colors.textMuted}>·</AppText>
          <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{timestamp}</AppText>
          {meta}
        </View>
        {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
      </View>
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  post: {
    gap: density.textStackGap,
    paddingHorizontal: density.compactCardPadding,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    minWidth: 0,
  },
  header: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: density.cardGap,
  },
  identityLine: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  headerAction: {
    marginRight: -8,
    marginVertical: -10,
  },
  footer: {
    marginTop: density.textPairGap,
  },
})
