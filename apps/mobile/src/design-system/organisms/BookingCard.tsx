import type { BookingStatus } from '@lets-be-friends/shared'
import { Pressable, StyleSheet, View } from 'react-native'

import {
  bookingStatusPresentation,
  formatBookingSchedule,
  formatBookingTotal,
  formatDuration,
} from '@/data/bookingViewModels'
import { companionMoneyCopy } from '@/data/bookingMoney'
import { ActionButton } from '@/design-system/atoms/ActionButton'
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
  settlementState?: string
  memberIdentityApproved?: boolean
}


export function BookingCard({ booking, onPress, compact = false }: { booking: BookingCardView; onPress: () => void; compact?: boolean }) {
  const theme = useAppTheme()
  const viewerIsRequester = booking.viewerIsRequester ?? true
  const status = !viewerIsRequester && booking.status === 'request_sent'
    ? { label: 'Needs decision', explanation: 'The member is waiting for your reply.', tone: 'social' as const }
    : booking.status === 'accepted' && booking.viewerCompletedAt !== undefined
      ? { label: 'Waiting for member', explanation: 'You confirmed completion. The member still needs to confirm.', tone: 'warning' as const }
      : bookingStatusPresentation[booking.status]
  const total = formatBookingTotal(booking.memberTotalCentavos)
  const entitlement = formatBookingTotal(booking.companionEarningsCentavos)
  const priceLabel = !viewerIsRequester && entitlement ? 'Your earnings' : 'Total'
  const priceValue = !viewerIsRequester && entitlement ? entitlement : total
  const participantPreposition = booking.participantPreposition ?? 'with'
  const money = !viewerIsRequester ? companionMoneyCopy({
    bookingStatus: booking.status,
    settlementState: booking.settlementState,
    memberTotalCentavos: booking.memberTotalCentavos,
    companionEarningsCentavos: booking.companionEarningsCentavos,
  }) : null
  const meta = `${booking.mode === 'in_person' ? 'In person' : 'Online'} · ${formatDuration(booking.durationMinutes)}`

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
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong">{booking.participantName}</AppText>
            {!viewerIsRequester && booking.memberIdentityApproved ? <StatusBadge label="Identity verified" tone="neutral" /> : null}
          </View>
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
              {viewerIsRequester ? 'You were not charged.' : 'The member was not charged.'}
            </AppText>
          </>
        ) : priceValue ? (
          <>
            <View style={styles.priceRow}>
              <AppText variant="bodyStrong">{priceLabel} {priceValue}</AppText>
              {money ? <StatusBadge label={money.label} tone={money.tone} /> : null}
            </View>
            <AppText variant="caption" color={theme.colors.textMuted}>
              {money
                ? booking.status === 'request_sent' && total && entitlement
                  ? `Member pays ${total}. You receive ${entitlement} after both confirm.`
                  : money.memberCopy
                : 'Includes service fee.'}
            </AppText>
          </>
        ) : (
          <AppText variant="bodyStrong">Total to be confirmed</AppText>
        )}
        <AppText variant="caption" color={theme.colors.textMuted}>{meta}</AppText>
      </View>
      {!viewerIsRequester && booking.status === 'request_sent' ? (
        <ActionButton label="Review request" intent="social" compact style={styles.action} onPress={onPress} />
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: density.compactCardPadding, gap: density.textStackGap },
  compact: { borderRadius: 10, padding: density.compactCardPadding },
  pressed: { opacity: 0.74 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  copy: { flex: 1, gap: density.textPairGap },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  money: { gap: density.textPairGap },
  priceRow: { alignItems: 'flex-start', gap: 4 },
  action: { marginTop: 4 },
})
