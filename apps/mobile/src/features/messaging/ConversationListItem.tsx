import { Pressable, StyleSheet, View } from 'react-native'

import { Avatar } from '@/design-system/atoms/Avatar'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type ConversationListItemProps = {
  name: string
  imageUrl?: string | null
  preview: string
  timeLabel?: string
  unreadCount?: number
  suspended?: boolean
  onPress: () => void
}

export function ConversationListItem({
  name,
  imageUrl,
  preview,
  timeLabel,
  unreadCount = 0,
  suspended = false,
  onPress,
}: ConversationListItemProps) {
  const theme = useAppTheme()
  const hasUnread = unreadCount > 0
  const displayedPreview = suspended ? 'Messaging unavailable' : preview
  const unreadLabel = hasUnread ? `, ${unreadCount} unread message${unreadCount === 1 ? '' : 's'}` : ''
  const timeDescription = timeLabel ? ` ${timeLabel}.` : ''
  const safetyDescription = suspended ? ' Conversation paused for safety.' : ''

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${name}${unreadLabel}. ${displayedPreview}.${timeDescription}${safetyDescription}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.colors.border },
        pressed && styles.pressed,
      ]}>
      <Avatar uri={imageUrl ?? undefined} name={name} size={52} />
      <View style={styles.copy}>
        <View style={styles.heading}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>{name}</AppText>
          {timeLabel ? <AppText variant="caption" color={theme.colors.textMuted}>{timeLabel}</AppText> : null}
        </View>
        <AppText
          numberOfLines={2}
          color={suspended ? theme.colors.textMuted : hasUnread ? theme.colors.text : theme.colors.textMuted}>
          {displayedPreview}
        </AppText>
        <AppText variant="caption" color={suspended ? theme.colors.danger : theme.colors.textMuted}>
          {suspended ? 'Conversation paused for safety' : 'Private member conversation'}
        </AppText>
      </View>
      {hasUnread ? (
        <View
          accessibilityLabel={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
          style={[styles.unread, { backgroundColor: theme.colors.socialControl }]}>
          <AppText variant="caption" color={theme.colors.accentText}>{unreadCount}</AppText>
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 82,
    minWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: density.compactCardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: density.compactCardPadding,
  },
  copy: { flex: 1, minWidth: 0, gap: density.textPairGap },
  heading: { minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: density.cardGap },
  name: { flex: 1, minWidth: 0 },
  unread: {
    minWidth: 24,
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: density.textSectionGap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.62 },
})
