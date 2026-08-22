import type { BookingStatus } from '@lets-be-friends/shared'
import { Pressable, StyleSheet, View } from 'react-native'

import {
  bookingStatusPresentation,
  formatBookingSchedule,
  formatBookingTotal,
  formatDuration,
} from '@/data/bookingViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'
import { AppText } from './Typography'

export type BookingCardView = {
  id: string
  companionName: string
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${booking.category} booking with ${booking.companionName}, ${status.label}`}
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
          <AppText variant="caption" color={theme.colors.textMuted}>with {booking.companionName}</AppText>
        </View>
        <View style={[styles.status, { backgroundColor: theme.colors.socialSoft }]}>
          <AppText variant="caption" color={theme.colors.social}>{status.label}</AppText>
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
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 8 },
  compact: { borderRadius: 16, padding: 14 },
  pressed: { opacity: 0.74 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  copy: { flex: 1, gap: 2 },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
})
