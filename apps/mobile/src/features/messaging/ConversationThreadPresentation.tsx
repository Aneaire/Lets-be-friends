import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { Avatar } from '@/design-system/atoms/Avatar'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export function ConversationThreadHeader({
  name,
  imageUrl,
  paused = false,
  onBack,
  onSafety,
}: {
  name: string
  imageUrl?: string | null
  paused?: boolean
  onBack: () => void
  onSafety: () => void
}) {
  const theme = useAppTheme()

  return (
    <View style={[styles.threadHeader, { borderBottomColor: theme.colors.border }]}>
      <IconButton
        label="Back to conversations"
        icon="chevron-back"
        onPress={onBack}
        style={styles.back}
      />
      <Avatar uri={imageUrl ?? undefined} name={name} size={42} />
      <View style={styles.headerCopy}>
        <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
        {paused ? (
          <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
            Conversation paused
          </AppText>
        ) : null}
      </View>
      <IconButton
        label={`Safety options for ${name}`}
        icon="shield-outline"
        tone="self"
        onPress={onSafety}
        style={styles.safetyButton}
      />
    </View>
  )
}

export function BookingMessageShell({
  body,
  category,
  booking,
  reportAction,
  showBody = false,
}: {
  body?: string
  category: string
  booking?: ReactNode
  reportAction?: ReactNode
  /** Keep generated booking copy that is not already on the card, such as a cancellation reason. */
  showBody?: boolean
}) {
  const theme = useAppTheme()

  return (
    <View style={styles.bookingMessage}>
      {booking ? (
        <>
          {showBody && body ? <AppText variant="caption" color={theme.colors.textMuted}>{body}</AppText> : null}
          <View style={styles.bookingRow}>
            <View style={styles.bookingFlex}>{booking}</View>
            {reportAction}
          </View>
        </>
      ) : (
        <>
          {body ? <AppText variant="caption" color={theme.colors.textMuted}>{body}</AppText> : null}
          <View style={[styles.bookingSnapshot, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}>
            <AppText variant="bodyStrong">{category}</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>
              Booking details are not linked because your role in this booking could not be verified.
            </AppText>
          </View>
          {reportAction}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  threadHeader: {
    minHeight: 68,
    borderBottomWidth: 1,
    paddingHorizontal: density.compactCardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  back: { width: 44, height: 48 },
  headerCopy: { flex: 1, minWidth: 0 },
  safetyButton: { width: 44, height: 44 },
  bookingMessage: { gap: density.cardGap },
  bookingRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-end', gap: density.cardGap },
  bookingFlex: { flexGrow: 1, flexBasis: 240, minWidth: 0 },
  bookingSnapshot: {
    borderWidth: 1,
    borderRadius: 16,
    padding: density.cardPadding,
    gap: density.textStackGap,
  },
})
