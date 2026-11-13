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
import { StatusBadge } from '@/design-system/atoms/StatusBadge'

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
  /** Companion-side entitlement shown instead of the member total for the Companion viewer. */
  companionEarningsCentavos?: number
  /** False when the viewer is the Companion on this booking. Defaults to the member view. */
  viewerIsRequester?: boolean
  /** Set when the viewer already confirmed completion on an accepted booking. */
  viewerCompletedAt?: number
}

function companionPaymentCopy(status: BookingStatus, total: string) {
  if (status === 'request_sent' || status === 'verification_required' || status === 'pending_admin_review') {
    return `The member pays ${total} total when you accept, which includes the service fee.`
  }
  if (status === 'accepted') {
    return `The member has ${total} reserved, which includes the service fee.`
  }
  if (status === 'declined' || status === 'cancelled') {
    return 'No payment was taken.'
  }
  return `The member paid ${total} total, which includes the service fee.`
}

export function BookingCard({ booking, onPress, compact = false }: { booking: BookingCardView; onPress: () => void; compact?: boolean }) {
  const theme = useAppTheme()
  const status = booking.status === 'accepted' && booking.viewerCompletedAt !== undefined
    ? { label: 'Waiting for member', explanation: 'You confirmed completion. The member still needs to confirm.', tone: 'warning' as const }
    : bookingStatusPresentation[booking.status]
  const total = formatBookingTotal(booking.memberTotalCentavos)
  const viewerIsRequester = booking.viewerIsRequester ?? true
  const entitlement = formatBookingTotal(booking.companionEarningsCentavos)
  const priceLabel = !viewerIsRequester && entitlement ? 'Your earnings' : 'Total'
  const priceValue = !viewerIsRequester && entitlement ? entitlement : total
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
          <AppText variant="bodyStrong">{booking.participantName}</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>{booking.category}</AppText>
        </View>
        <StatusBadge label={status.label} tone={status.tone} />
      </View>
      <AppText variant="caption">{formatBookingSchedule(booking.requestedAt)}</AppText>
      <View style={styles.money}>
        {booking.status === 'declined' || booking.status === 'cancelled' ? (
          <>
            <AppText variant="bodyStrong">No payment</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>
              {viewerIsRequester ? 'You were not charged.' : 'The member was not charged.'} · {booking.mode === 'in_person' ? 'In person' : 'Online'} · {formatDuration(booking.durationMinutes)}
            </AppText>
          </>
        ) : priceValue ? (
          <>
            <AppText variant="bodyStrong">{priceLabel} {priceValue}</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>
              {!viewerIsRequester && total ? (
                <>{companionPaymentCopy(booking.status, total)}</>
              ) : (
                <>Includes service fee.</>
              )}
              {booking.mode === 'in_person' ? ' · In person' : ' · Online'} · {formatDuration(booking.durationMinutes)}
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="bodyStrong">Total to be confirmed</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>
              {booking.mode === 'in_person' ? 'In person' : 'Online'} · {formatDuration(booking.durationMinutes)}
            </AppText>
          </>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: density.compactCardPadding, gap: density.textStackGap },
  compact: { borderRadius: 10, padding: density.compactCardPadding },
  pressed: { opacity: 0.74 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  copy: { flex: 1, gap: density.textPairGap },
  money: { gap: density.textPairGap },
})
