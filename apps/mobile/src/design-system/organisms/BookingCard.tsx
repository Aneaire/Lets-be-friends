import type { BookingStatus } from '@lets-be-friends/shared'
import { Pressable, StyleSheet, View } from 'react-native'

import {
  bookingStatusPresentation,
  formatBookingSchedule,
  formatBookingTotal,
  formatDuration,
} from '@/data/bookingViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import { AppText } from '@/design-system/atoms/Typography'

export type BookingCardView = {
  id: string
  participantName: string
  participantPreposition?: 'with' | 'from'
  category: string
  mode: 'online' | 'in_person'
  requestedAt: number
  durationMinutes: number
  status: BookingStatus
  memberTotalCentavos?: number
}

export function BookingCard({ booking, onPress, compact = false }: { booking: BookingCardView; onPress: () => void; compact?: boolean }) {
  const theme = useAppTheme()
  const status = bookingStatusPresentation[booking.status]
  const total = formatBookingTotal(booking.memberTotalCentavos)
  const participantPreposition = booking.participantPreposition ?? 'with'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${booking.category} booking ${participantPreposition} ${booking.participantName}, ${status.label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border },
        compact && styles.compact,
        pressed && styles.pressed,
      ]}>
      <View style={styles.headingRow}>
        <View style={styles.copy}>
          <AppText variant="bodyStrong">{booking.category}</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>{participantPreposition} {booking.participantName}</AppText>
        </View>
        <View style={[styles.status, { backgroundColor: theme.colors.socialSoft }]}>
          <AppText variant="caption" color={theme.colors.socialText}>{status.label}</AppText>
        </View>
      </View>
      <AppText variant="caption">{formatBookingSchedule(booking.requestedAt)}</AppText>
      <AppText variant="caption" color={theme.colors.textMuted}>
        {booking.mode === 'in_person' ? 'In person' : 'Online'} · {formatDuration(booking.durationMinutes)}{total ? ` · ${total}` : ''}
      </AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: density.cardPadding, gap: density.textStackGap },
  compact: { borderRadius: density.controlRadius, padding: density.compactCardPadding },
  pressed: { opacity: 0.74 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  copy: { flex: 1, gap: density.textPairGap },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
})
